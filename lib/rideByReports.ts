import { query } from "./db";

// On-demand ride-by report: coverage summary + the individual logs.
// Reads first_choice.ride_bys joined to first_choice.properties. Dates are
// plain `date` values already recorded in local terms, so no time zone shift.

export type RideByFilters = {
  classification: string | null; // "Land" | "Building" | null = all
  propertyId: string | null; // null = all
  from: string; // YYYY-MM-DD, inclusive
  to: string; // YYYY-MM-DD, inclusive
};

type Row = Record<string, unknown>;

/** Active properties, for the filter dropdowns. */
export async function listRideByProperties() {
  const rows = await query<Row>(
    `select id, address, coalesce(classification,'') as classification
       from first_choice.properties
      where active is not false
      order by address asc`
  );
  return rows.map((r) => ({
    id: String(r.id),
    address: String(r.address ?? ""),
    classification: String(r.classification ?? ""),
  }));
}

export async function buildRideByReport(f: RideByFilters) {
  const scope: string[] = ["p.active is not false"];
  const params: unknown[] = [f.from, f.to];
  if (f.classification) {
    params.push(f.classification);
    scope.push(`p.classification = $${params.length}`);
  }
  if (f.propertyId) {
    params.push(f.propertyId);
    scope.push(`p.id = $${params.length}::uuid`);
  }
  const where = scope.join(" and ");

  // Individual logs inside the range.
  const rows = await query<Row>(
    `select r.id, p.id as property_id, p.address, coalesce(p.classification,'') as classification,
            r.occurred_on::text as occurred_on, coalesce(r.logged_by,'') as logged_by,
            coalesce(r.note,'') as note, (r.photo_path is not null) as has_photo
       from first_choice.ride_bys r
       join first_choice.properties p on p.id = r.property_id
      where ${where} and r.occurred_on between $1::date and $2::date
      order by p.address asc, r.occurred_on asc`,
    params
  );

  // Coverage per property in scope: visits in range, and the last visit on or
  // before Date To (which may predate the range — that is what a gap means).
  const coverage = await query<Row>(
    `select p.id, p.address, coalesce(p.classification,'') as classification,
            count(r.id) filter (where r.occurred_on between $1::date and $2::date)::int as visits,
            max(r.occurred_on) filter (where r.occurred_on <= $2::date)::text as last_visit,
            ($2::date - max(r.occurred_on) filter (where r.occurred_on <= $2::date))::int as days_since
       from first_choice.properties p
       left join first_choice.ride_bys r on r.property_id = p.id
      where ${where}
      group by p.id, p.address, p.classification
      order by p.address asc`,
    params
  );

  const props = coverage.map((r) => ({
    propertyId: String(r.id),
    address: String(r.address ?? ""),
    classification: String(r.classification ?? ""),
    visits: Number(r.visits ?? 0),
    lastVisit: r.last_visit ? String(r.last_visit) : null,
    daysSince: r.days_since != null ? Number(r.days_since) : null,
  }));

  const visited = props.filter((p) => p.visits > 0);
  const gaps = props.map((p) => p.daysSince).filter((d): d is number => d != null);

  return {
    rows: rows.map((r) => ({
      id: String(r.id),
      propertyId: String(r.property_id),
      address: String(r.address ?? ""),
      classification: String(r.classification ?? ""),
      occurredOn: String(r.occurred_on ?? ""),
      loggedBy: String(r.logged_by ?? ""),
      note: String(r.note ?? ""),
      hasPhoto: !!r.has_photo,
    })),
    properties: props,
    summary: {
      rideBys: rows.length,
      propertiesInScope: props.length,
      propertiesVisited: visited.length,
      neverVisited: props.filter((p) => p.lastVisit == null).length,
      longestGapDays: gaps.length ? Math.max(...gaps) : null,
    },
  };
}
