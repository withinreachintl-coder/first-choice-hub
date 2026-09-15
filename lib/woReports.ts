import { query } from "./db";

// On-demand Open / Closed work order reports. Reads the
// first_choice.v_open_wo_report and first_choice.v_closed_wo_report views
// (dates already converted to America/Chicago in the views).

export type WoReportType = "open" | "closed";

export type WoReportFilters = {
  type: WoReportType;
  group: string | null; // location_group, null = all
  sub: string | null; // location_sub, null = all
  from: string; // YYYY-MM-DD, inclusive
  to: string; // YYYY-MM-DD, inclusive
};

type Row = Record<string, unknown>;

const fmtTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "America/Chicago",
});

function ts(v: unknown): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(String(v));
  return isNaN(d.getTime()) ? "" : fmtTime.format(d);
}

export async function listReportLocations() {
  const rows = await query<Row>(
    `select distinct coalesce(location_group,'') as location_group, coalesce(location_sub,'') as location_sub
       from first_choice.work_orders
      where coalesce(location_group,'') <> ''
      order by 1, 2`
  );
  return rows.map((r) => ({ group: String(r.location_group), sub: String(r.location_sub) }));
}

export async function buildWoReport(f: WoReportFilters) {
  const view = f.type === "open" ? "first_choice.v_open_wo_report" : "first_choice.v_closed_wo_report";
  const dateCol = f.type === "open" ? "date_opened" : "date_closed";

  const params: unknown[] = [f.from, f.to];
  let where = `${dateCol} between $1::date and $2::date`;
  if (f.group) {
    params.push(f.group);
    where += ` and location_group = $${params.length}`;
  }
  if (f.sub) {
    params.push(f.sub);
    where += ` and location_sub = $${params.length}`;
  }

  // Dates cast to text so node-pg does not shift them through the server time zone.
  const cols =
    f.type === "open"
      ? `work_order_id, location_group, location_sub, location,
         date_opened::text as date_opened, days_open, priority, category`
      : `work_order_id, status, location_group, location_sub, location,
         date_opened::text as date_opened, date_closed::text as date_closed,
         time_in, time_out, hours::text as hours, tech_name, cost_amount::text as cost_amount`;

  const rows = await query<Row>(
    `select ${cols} from ${view}
      where ${where}
      order by location_group nulls last, location_sub nulls last, ${dateCol}, work_order_id`,
    params
  );

  return rows.map((r) => ({
    workOrderId: String(r.work_order_id ?? ""),
    locationGroup: String(r.location_group ?? ""),
    locationSub: String(r.location_sub ?? ""),
    location: String(r.location ?? ""),
    dateOpened: String(r.date_opened ?? ""),
    ...(f.type === "open"
      ? {
          daysOpen: r.days_open != null ? Number(r.days_open) : null,
          priority: String(r.priority ?? ""),
          category: String(r.category ?? ""),
        }
      : {
          status: String(r.status ?? ""),
          dateClosed: String(r.date_closed ?? ""),
          timeIn: ts(r.time_in),
          timeOut: ts(r.time_out),
          hours: r.hours != null ? Number(r.hours) : null,
          techName: String(r.tech_name ?? ""),
          costAmount: r.cost_amount != null ? Number(r.cost_amount) : null,
        }),
  }));
}
