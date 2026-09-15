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

  // Time In / Time Out arrive as America/Chicago wall-clock values from a
  // datetime-local input ("YYYY-MM-DDTHH:MM"). Required to close or resolve.
  const LOCAL_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
  const timeIn = String(payload.timeIn ?? "").trim();
  const timeOut = String(payload.timeOut ?? "").trim();
  const needsTimes = ["closed", "resolved"].includes(String(payload.status ?? "Resolved").toLowerCase());
  if (needsTimes && (!timeIn || !timeOut)) {
    return NextResponse.json(
      { error: "Time In and Time Out are required to close or resolve a work order" },
      { status: 400 }
    );
  }
  if ((timeIn && !LOCAL_DT.test(timeIn)) || (timeOut && !LOCAL_DT.test(timeOut))) {
    return NextResponse.json(
      { error: "Time In and Time Out must be valid date/times (YYYY-MM-DDTHH:MM)" },
      { status: 400 }
    );
  }
  if (timeIn && timeOut && timeOut.padEnd(19, ":00") <= timeIn.padEnd(19, ":00")) {
    return NextResponse.json({ error: "Time Out must be after Time In" }, { status: 400 });
  }
  payload.timeIn = timeIn || null;
  payload.timeOut = timeOut || null;

  try {
    const ok = await closeWorkOrder(workOrderId, payload);
    if (!ok) {
      return NextResponse.json(
        { error: `Work order ${workOrderId} not found` },
        { status: 404 }
      );
    }
  } catch (e) {
    // 23514 = check_violation (e.g. DST fall-back makes Time Out land before Time In)
    if ((e as { code?: string }).code === "23514") {
      return NextResponse.json({ error: "Time Out must be after Time In" }, { status: 400 });
    }
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
