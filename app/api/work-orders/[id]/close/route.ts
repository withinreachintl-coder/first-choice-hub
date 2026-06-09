import { NextResponse } from "next/server";
import { closeWorkOrder } from "@/lib/workOrders";
import { sendEmail } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/work-orders/[id]/close -> close an existing work order
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const workOrderId = decodeURIComponent(id).trim().toUpperCase();

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const ok = await closeWorkOrder(workOrderId, payload);
    if (!ok) {
      return NextResponse.json(
        { error: `Work order ${workOrderId} not found` },
        { status: 404 }
      );
    }
  } catch (e) {
    console.error("[work-orders close]", e);
    return NextResponse.json({ error: "Failed to close work order" }, { status: 500 });
  }

  try {
    await sendEmail(
      `Work Order ${workOrderId} closed — ${String(payload.status ?? "Resolved")}`,
      `<h2>Work Order ${workOrderId} closed</h2>
       <p><b>Status:</b> ${String(payload.status ?? "")}<br/>
       <b>Technician:</b> ${String(payload.techName ?? "")}</p>
       <p><b>Completion notes:</b><br/>${String(payload.completionNotes ?? "")}</p>`
    );
  } catch (e) {
    console.error("[work-orders close notify]", e);
  }

  return NextResponse.json({ status: "closed", workOrderId });
}
