import { query } from "./db";
import { uploadBase64, signedUrl, signedUrls } from "./storage";

const TBL = "first_choice.work_orders";

// Restaurants are in TN/MS (Central). Match the client's formatTs() style.
const fmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "America/Chicago",
});
function formatTs(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return typeof d === "string" ? d : "";
  return fmt.format(date);
}

type Row = Record<string, unknown>;
type Photo = { photo: string; photoName?: string };

function contentTypeFor(name: string | undefined): string {
  const ext = (name ?? "").toLowerCase().split(".").pop() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic") return "image/heic";
  return "image/jpeg";
}

/** Map a DB row to the camelCase shape the dashboard already consumes. */
async function mapRow(r: Row) {
  return {
    workOrderId: r.work_order_id ?? "",
    formType: r.form_type ?? "",
    submittedAt: formatTs(r.submitted_at as string),
    location: r.location ?? "",
    locationGroup: r.location_group ?? "",
    locationSub: r.location_sub ?? "",
    requesterName: r.requester_name ?? "",
    contactMethod: r.contact_method ?? "",
    category: r.category ?? "",
    description: r.description ?? "",
    priority: r.priority ?? "",
    safetyHazard: r.safety_hazard ? "TRUE" : "FALSE",
    isEmergency: !!r.is_emergency,
    bestTimeToAccess: r.best_time_to_access ?? "",
    neededByDate: r.needed_by_date ?? "",
    photoCount: r.photo_count ?? 0,
    photoUrls: await signedUrls((r.photo_urls as string[]) ?? []),
    pdfUrl: await signedUrl((r.pdf_url as string) ?? ""),
    status: r.status ?? "Open",
    techName: r.tech_name ?? "",
    closedAt: formatTs(r.closed_at as string),
    completionNotes: r.completion_notes ?? "",
    partsUsed: r.parts_used ?? "",
    completionPhotoUrl: (await signedUrls((r.completion_photo_urls as string[]) ?? []))[0] ?? "",
    closurePdfUrl: await signedUrl((r.closure_pdf_url as string) ?? ""),
  };
}

export async function listWorkOrders() {
  const rows = await query<Row>(
    `select * from ${TBL} order by submitted_at desc nulls last`
  );
  return Promise.all(rows.map(mapRow));
}

export async function insertOpenWorkOrder(p: Record<string, unknown>) {
  const id = String(p.workOrderId);
  const photos = (p.photos as Photo[]) ?? [];

  const photoKeys: string[] = [];
  for (let i = 0; i < photos.length; i++) {
    const name = photos[i].photoName ?? `photo-${i}.jpg`;
    const key = `${id}/photo-${i}-${name}`;
    await uploadBase64(key, photos[i].photo, contentTypeFor(name));
    photoKeys.push(key);
  }

  let pdfKey = "";
  if (p.pdfBase64) {
    pdfKey = `${id}/open.pdf`;
    await uploadBase64(pdfKey, String(p.pdfBase64), "application/pdf");
  }

  await query(
    `insert into ${TBL} (
       work_order_id, form_type, submitted_at, location, location_group,
       location_sub, requester_name, contact_method, category, description,
       priority, safety_hazard, is_emergency, best_time_to_access,
       time_sensitive, needed_by_date, photo_count, photo_urls, pdf_url, status
     ) values (
       $1,$2,now(),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'Open'
     )
     on conflict (work_order_id) do nothing`,
    [
      id,
      p.formType ?? "rm_request",
      p.location ?? "",
      p.locationGroup ?? "",
      p.locationSub ?? "",
      p.requesterName ?? "",
      p.contactMethod ?? null,
      p.category ?? "",
      p.description ?? "",
      p.priority ?? "",
      !!p.safetyHazard,
      !!p.isEmergency,
      p.bestTimeToAccess ?? null,
      !!p.timeSensitive,
      p.neededByDate ?? null,
      photos.length,
      photoKeys,
      pdfKey || null,
    ]
  );
}

export async function closeWorkOrder(id: string, p: Record<string, unknown>) {
  const photos = (p.completionPhotos as Photo[]) ?? [];
  const photoKeys: string[] = [];
  for (let i = 0; i < photos.length; i++) {
    const name = photos[i].photoName ?? `completion-${i}.jpg`;
    const key = `${id}/completion-${i}-${name}`;
    await uploadBase64(key, photos[i].photo, contentTypeFor(name));
    photoKeys.push(key);
  }

  let pdfKey = "";
  if (p.pdfBase64) {
    pdfKey = `${id}/close.pdf`;
    await uploadBase64(pdfKey, String(p.pdfBase64), "application/pdf");
  }

  const rows = await query<Row>(
    `update ${TBL} set
       status = $2,
       tech_name = $3,
       closed_at = now(),
       completion_notes = $4,
       parts_used = $5,
       completion_photo_count = $6,
       completion_photo_urls = $7,
       closure_pdf_url = $8
     where work_order_id = $1
     returning work_order_id`,
    [
      id,
      p.status ?? "Resolved",
      p.techName ?? "",
      p.completionNotes ?? "",
      p.partsUsed ?? null,
      photos.length,
      photoKeys,
      pdfKey || null,
    ]
  );
  return rows.length > 0;
}
