import { NextResponse } from "next/server";
import { listWorkOrders, insertOpenWorkOrder } from "@/lib/workOrders";
import { sendEmail, slackAlert } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/work-orders -> array of work orders (same shape the dashboard expects)
export async function GET() {
  try {
    const data = await listWorkOrders();
    return NextResponse.json(data);
  } catch (e) {
    console.error("[work-orders GET]", e);
    return NextResponse.json({ error: "Failed to load work orders" }, { status: 500 });
  }
}

// POST /api/work-orders -> create (open) a work order
export async function POST(req: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const workOrderId = String(payload.workOrderId ?? "");
  if (!workOrderId) {
    return NextResponse.json({ error: "Missing workOrderId" }, { status: 400 });
  }

  try {
    await insertOpenWorkOrder(payload);
  } catch (e) {
    console.error("[work-orders POST]", e);
    return NextResponse.json({ error: "Failed to save work order" }, { status: 500 });
  }

  // Best-effort notifications — never fail the request on these.
  try {
    const loc = String(payload.location ?? "");
    const cat = String(payload.category ?? "");
    const pri = String(payload.priority ?? "");
    const desc = String(payload.description ?? "");
    const by = String(payload.requesterName ?? "");
    await sendEmail(
      `New Work Order ${workOrderId} — ${cat} (${pri})`,
      `<h2>New Work Order ${workOrderId}</h2>
       <p><b>Location:</b> ${loc}<br/>
       <b>Category:</b> ${cat}<br/>
       <b>Priority:</b> ${pri}<br/>
       <b>Submitted by:</b> ${by}</p>
       <p><b>Description:</b><br/>${desc}</p>`
    );
    if (payload.isEmergency) {
      await slackAlert(`🚨 EMERGENCY work order ${workOrderId} — ${cat} at ${loc}\n${desc}`);
    }
  } catch (e) {
    console.error("[work-orders POST notify]", e);
  }

  return NextResponse.json({ status: "received", workOrderId });
}
