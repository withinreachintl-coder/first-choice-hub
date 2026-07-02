import { NextResponse } from "next/server";
import { listProperties } from "@/lib/properties";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/properties -> active properties (single source for the location list)
export async function GET() {
  try {
    const data = await listProperties();
    return NextResponse.json(data);
  } catch (e) {
    console.error("[properties GET]", e);
    return NextResponse.json({ error: "Failed to load properties" }, { status: 500 });
  }
}
