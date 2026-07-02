import { NextResponse } from "next/server";
import { insertRideBy, rideByStats } from "@/lib/properties";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/ride-bys -> per-property ride-by counts + last date
export async function GET() {
  try {
    const data = await rideByStats();
    return NextResponse.json(data);
  } catch (e) {
    console.error("[ride-bys GET]", e);
    return NextResponse.json({ error: "Failed to load ride-by stats" }, { status: 500 });
  }
}

// POST /api/ride-bys -> log a ride-by
export async function POST(req: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.propertyId && !payload.propertyLabel) {
    return NextResponse.json({ error: "Missing property" }, { status: 400 });
  }

  try {
    await insertRideBy(payload);
  } catch (e) {
    console.error("[ride-bys POST]", e);
    return NextResponse.json({ error: "Failed to save ride-by" }, { status: 500 });
  }

  return NextResponse.json({ status: "logged" });
}
