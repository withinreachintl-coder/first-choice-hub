import { NextResponse } from "next/server";
import { buildReport, type Period } from "@/lib/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID: Period[] = ["weekly", "monthly", "quarterly", "annual"];

// GET /api/reports?period=monthly&offset=0
//   offset 0  = the period we are currently inside
//   offset -1 = the previous, fully completed period
export async function GET(req: Request) {
  const url = new URL(req.url);
  const period = (url.searchParams.get("period") ?? "monthly") as Period;
  const offset = Number(url.searchParams.get("offset") ?? "0");

  if (!VALID.includes(period)) {
    return NextResponse.json(
      { error: `Invalid period. Use one of: ${VALID.join(", ")}` },
      { status: 400 }
    );
  }
  if (!Number.isFinite(offset) || offset > 0 || offset < -24) {
    return NextResponse.json({ error: "offset must be between -24 and 0" }, { status: 400 });
  }

  try {
    const report = await buildReport(period, new Date(), offset);
    return NextResponse.json(report);
  } catch (e) {
    console.error("[reports GET]", e);
    return NextResponse.json({ error: "Failed to build report" }, { status: 500 });
  }
}
