import { NextRequest } from "next/server";

import { requireSession } from "@/lib/auth/session";
import { getReportExport, isReportDataset } from "@/lib/db/reports";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { dataset: string } }
) {
  const session = await requireSession();

  if (!isReportDataset(params.dataset)) {
    return new Response("Unknown report dataset.", { status: 404 });
  }

  const exportFile = await getReportExport(session, params.dataset);

  return new Response(exportFile.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFile.filename}"`
    }
  });
}
