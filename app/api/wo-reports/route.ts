import { NextResponse } from "next/server";
import { buildWoReport, listReportLocations, type WoReportType } from "@/lib/woReports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/wo-reports?type=open|closed&group=&sub=&from=YYYY-MM-DD&to=YYYY-MM-DD
//   Returns { rows, locations }. group/sub empty = all locations.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = (url.searchParams.get("type") ?? "open") as WoReportType;
  const group = url.searchParams.get("group")?.trim() || null;
  const sub = url.searchParams.get("sub")?.trim() || null;
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";

  if (type !== "open" && type !== "closed") {
    return NextResponse.json({ error: "type must be open or closed" }, { status: 400 });
  }
  if (!DATE.test(from) || !DATE.test(to)) {
    return NextResponse.json({ error: "from and to must be YYYY-MM-DD" }, { status: 400 });
  }
  if (from > to) {
    return NextResponse.json({ error: "Date From must be on or before Date To" }, { status: 400 });
  }

  try {
    const [rows, locations] = await Promise.all([
      buildWoReport({ type, group, sub, from, to }),
      listReportLocations(),
    ]);
    return NextResponse.json({ rows, locations });
  } catch (e) {
    console.error("[wo-reports GET]", e);
    return NextResponse.json({ error: "Failed to build report" }, { status: 500 });
  }
}
