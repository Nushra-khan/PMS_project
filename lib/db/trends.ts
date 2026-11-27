import { getDirectReportIds, runWithClient, toNumber } from "@/lib/db/helpers";
import { AppSession } from "@/lib/types";

export type TrendPoint = {
  /** First day of the month, YYYY-MM-01. */
  month: string;
  value: number | null;
  count: number;
};

export type DashboardTrends = {
  feedbackScore: TrendPoint[];
  flagsRaised: TrendPoint[] | null;
};

const MONTHS = 6;

function monthKeys(today = new Date()) {
  const keys: string[] = [];

  for (let offset = MONTHS - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - offset, 1));
    keys.push(date.toISOString().slice(0, 10));
  }

  return keys;
}

/**
 * Six months of feedback scores (monthly average) and flags raised, scoped
 * like the rest of the dashboard: Admin sees everyone, managers see
 * themselves and their direct reports, employees see feedback about
 * themselves. Employees never see flag counts.
 */
export async function getDashboardTrends(session: AppSession): Promise<DashboardTrends> {
  const months = monthKeys();
  const empty = months.map((month) => ({ month, value: null, count: 0 }));

  return runWithClient<DashboardTrends>(
    { feedbackScore: empty, flagsRaised: session.role === "employee" ? null : empty },
    async (client) => {
      const scope =
        session.role === "admin"
          ? null
          : session.role === "manager"
            ? [session.userId, ...(await getDirectReportIds(client, session.userId))]
            : [session.userId];

      const scores = await client.query<{ month: string; average: string | null; count: string }>(
        `
          select to_char(date_trunc('month', created_at), 'YYYY-MM-DD') as month,
                 avg(score) as average,
                 count(*) as count
          from public.feedback_submissions
          where created_at >= $1::date
            and ($2::uuid[] is null or target_profile_id = any($2::uuid[]))
          group by 1
        `,
        [months[0], scope]
      );

      const flags =
        session.role === "employee"
          ? null
          : await client.query<{ month: string; count: string }>(
              `
                select to_char(date_trunc('month', created_at), 'YYYY-MM-DD') as month,
                       count(*) as count
                from public.flags
                where created_at >= $1::date
                  and ($2::uuid[] is null or employee_profile_id = any($2::uuid[]))
                group by 1
              `,
              // Flags about yourself are never shown, matching the flags page.
              [months[0], scope?.filter((id) => id !== session.userId) ?? null]
            );

      const scoreByMonth = new Map(scores.rows.map((row) => [row.month, row]));
      const flagsByMonth = new Map((flags?.rows ?? []).map((row) => [row.month, row]));

      return {
        feedbackScore: months.map((month) => {
          const row = scoreByMonth.get(month);
          return {
            month,
            value: row?.average == null ? null : Math.round(toNumber(row.average) * 10) / 10,
            count: toNumber(row?.count ?? 0)
          };
        }),
        flagsRaised: flags
          ? months.map((month) => {
              const count = toNumber(flagsByMonth.get(month)?.count ?? 0);
              return { month, value: count, count };
            })
          : null
      };
    }
  );
}
