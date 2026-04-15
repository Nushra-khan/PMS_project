import Link from "next/link";
import { ReactNode } from "react";
import {
  BellDot,
  ClipboardList,
  Flag,
  Gauge,
  Goal,
  LogOut,
  ShieldCheck,
  TimerReset
} from "lucide-react";

import { AppSession, Role } from "@/lib/types";
import { cn } from "@/lib/utils";

type AppShellProps = {
  session: AppSession;
  title: string;
  description: string;
  children: ReactNode;
};

const navigation: Array<{
  href: string;
  label: string;
  icon: ReactNode;
  roles: Role[];
}> = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: <Gauge className="h-4 w-4" />,
    roles: ["employee", "manager", "admin"]
  },
  {
    href: "/goals",
    label: "Goals",
    icon: <Goal className="h-4 w-4" />,
    roles: ["employee", "manager", "admin"]
  },
  {
    href: "/goals/approvals",
    label: "Approvals",
    icon: <ClipboardList className="h-4 w-4" />,
    roles: ["manager", "admin"]
  },
  {
    href: "/probation",
    label: "Probation",
    icon: <TimerReset className="h-4 w-4" />,
    roles: ["employee", "manager", "admin"]
  },
  {
    href: "/reviews",
    label: "Reviews",
    icon: <BellDot className="h-4 w-4" />,
    roles: ["employee", "manager", "admin"]
  },
  {
    href: "/flags",
    label: "Flags",
    icon: <Flag className="h-4 w-4" />,
    roles: ["manager", "admin"]
  },
  {
    href: "/admin/settings",
    label: "Admin",
    icon: <ShieldCheck className="h-4 w-4" />,
    roles: ["admin"]
  }
];

function roleLabel(role: Role) {
  if (role === "admin") {
    return "Admin (HR)";
  }

  if (role === "manager") {
    return "Manager";
  }

  return "Employee";
}

export function AppShell({
  session,
  title,
  description,
  children
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-canvas bg-dashboard-radial text-ink">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-[2rem] border border-ink/10 bg-ink px-6 py-8 text-white shadow-soft">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/60">
              PMS Platform
            </p>
            <h1 className="mt-3 text-3xl font-semibold">Performance cockpit</h1>
            <p className="mt-3 text-sm leading-6 text-white/72">
              Unified workflows for goals, probation, review cycles, flags, and
              audit-heavy HR decisions.
            </p>
          </div>

          <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-white/50">
              Signed in as
            </p>
            <p className="mt-2 text-lg font-medium">{session.profile.name}</p>
            <p className="text-sm text-white/70">{roleLabel(session.role)}</p>
          </div>

          <nav className="mt-8 space-y-2">
            {navigation
              .filter((item) => item.roles.includes(session.role))
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-white/78 transition",
                    "hover:bg-white/10 hover:text-white"
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
          </nav>

          <form action="/api/logout" method="post" className="mt-10">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-white/78 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Exit workspace
            </button>
          </form>
        </aside>

        <main className="space-y-6">
          <header className="rounded-[2rem] border border-ink/10 bg-panel/95 p-8 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-tide">
              {roleLabel(session.role)} workspace
            </p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight text-ink">
              {title}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-ink/70">
              {description}
            </p>
            {session.sessionMode === "auth_preview" ? (
              <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-950">
                You are signed in with real Supabase auth, but this account is still
                viewing a seeded preview workspace until the live PMS profile and
                tables are fully connected.
              </div>
            ) : null}
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
