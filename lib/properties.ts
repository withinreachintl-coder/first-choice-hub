import { query } from "./db";
import { uploadBase64, signedUrl } from "./storage";

const PROPS = "first_choice.properties";
const RIDES = "first_choice.ride_bys";

type Row = Record<string, unknown>;

/** All active properties — the single source for the location list + picker. */
export async function listProperties() {
  const rows = await query<Row>(
    `select id, address, tax_parcel, classification, grp, active
       from ${PROPS} where active is not false order by address asc`
  );
  return rows.map(r => ({
    id: r.id as string,
    address: (r.address as string) ?? "",
    taxParcel: (r.tax_parcel as string) ?? "",
    classification: (r.classification as string) ?? "",
    grp: (r.grp as string) ?? "Misc. Facilities/Properties",
    active: r.active !== false,
  }));
}

/** Insert a ride-by log; optionally upload a photo to the shared bucket. */
export async function insertRideBy(p: Record<string, unknown>) {
  let photoPath: string | null = null;
  const photo = p.photo as { b64?: string; name?: string } | undefined;
  if (photo?.b64) {
    const name = photo.name ?? "ride-by.jpg";
    const key = `ride-bys/${String(p.propertyId ?? "unknown")}/${Date.now()}-${name}`;
    await uploadBase64(key, photo.b64, "image/jpeg");
    photoPath = key;
  }
  await query(
    `insert into ${RIDES}
       (property_id, property_label, occurred_on, logged_by, note, photo_path)
     values ($1,$2,coalesce($3, current_date),$4,$5,$6)`,
    [
      p.propertyId ?? null,
      p.propertyLabel ?? "",
      p.occurredOn ?? null,
      p.loggedBy ?? "",
      p.note ?? null,
      photoPath,
    ]
  );
  return true;
}

/** Per-property ride-by counts + most-recent date (all properties, 0 included). */
export async function rideByStats() {
  const rows = await query<Row>(
    `select p.id, p.address, p.classification,
            count(r.id)::int as cnt,
            to_char(max(r.occurred_on),'YYYY-MM-DD') as last_on
       from ${PROPS} p
       left join ${RIDES} r on r.property_id = p.id
      where p.active is not false
      group by p.id, p.address, p.classification`
  );
  return rows.map(r => ({
    propertyId: r.id as string,
    address: (r.address as string) ?? "",
    classification: (r.classification as string) ?? "",
    count: (r.cnt as number) ?? 0,
    lastOn: (r.last_on as string) ?? null,
  }));
}

/** Resolve a stored ride-by photo key to a signed URL. */
export async function rideByPhotoUrl(key: string) {
  return signedUrl(key);
}
