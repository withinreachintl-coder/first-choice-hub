import { query } from "./db";

// ─────────────────────────────────────────────────────────────────────────────
// Executive reporting over the first_choice schema.
//
// Every figure is computed for the selected period AND the immediately prior
// period of the same length, so the app and the email can show direction, not
// just a number. All period math runs in America/Chicago (where the properties
// are) rather than UTC, so a Sunday-night work order lands in the right week.
// ─────────────────────────────────────────────────────────────────────────────

export const TZ = "America/Chicago";
export type Period = "weekly" | "monthly" | "quarterly" | "annual";

const UNIT: Record<Period, string> = {
  weekly: "week",
  monthly: "month",
  quarterly: "quarter",
  annual: "year",
};

const STEP: Record<Period, string> = {
  weekly: "1 week",
  monthly: "1 month",
  quarterly: "3 months",
  annual: "1 year",
};

export type Bounds = {
  period: Period;
  start: string; // ISO timestamptz
  end: string; // exclusive
  prevStart: string;
  prevEnd: string;
  label: string;
  prevLabel: string;
};

type Row = Record<string, unknown>;

const n = (v: unknown) => (v == null ? 0 : Number(v));
const s = (v: unknown) => (v == null ? "" : String(v));

/**
 * Resolve period boundaries in Chicago local time.
 * `offset` of 0 = the period containing `asOf`; -1 = the previous one (used by
 * the scheduler so a Monday 7am run reports on the week that just finished).
 */
export async function resolveBounds(
  period: Period,
  asOf: Date = new Date(),
  offset = 0
): Promise<Bounds> {
  const unit = UNIT[period];
  const step = STEP[period];

  const rows = await query<Row>(
    `with anchor as (
       select (date_trunc($1, ($2::timestamptz at time zone $3))
               + ($4::int * $5::interval)) as s_local
     )
     select
       (s_local at time zone $3)                          as start_ts,
       ((s_local + $5::interval) at time zone $3)          as end_ts,
       ((s_local - $5::interval) at time zone $3)          as prev_start_ts,
       (s_local at time zone $3)                           as prev_end_ts,
       s_local                                             as s_local,
       (s_local - $5::interval)                            as p_local
     from anchor`,
    [unit, asOf.toISOString(), TZ, offset, step]
  );

  const r = rows[0];
  return {
    period,
    start: new Date(r.start_ts as string).toISOString(),
    end: new Date(r.end_ts as string).toISOString(),
    prevStart: new Date(r.prev_start_ts as string).toISOString(),
    prevEnd: new Date(r.prev_end_ts as string).toISOString(),
    label: labelFor(period, new Date(r.s_local as string)),
    prevLabel: labelFor(period, new Date(r.p_local as string)),
  };
}

export function labelFor(period: Period, localStart: Date): string {
  // localStart is the naive local start rendered as a Date; read it in UTC to
  // avoid the host timezone shifting the label.
  const y = localStart.getUTCFullYear();
  const m = localStart.getUTCMonth();
  const d = localStart.getUTCDate();
  const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  if (period === "annual") return String(y);
  if (period === "quarterly") return `Q${Math.floor(m / 3) + 1} ${y}`;
  if (period === "monthly") return `${MON[m]} ${y}`;
  const end = new Date(Date.UTC(y, m, d + 6));
  const endStr =
    end.getUTCMonth() === m
      ? String(end.getUTCDate())
      : `${MON[end.getUTCMonth()]} ${end.getUTCDate()}`;
  return `${MON[m]} ${d}–${endStr}, ${y}`;
}

// ─── Core scalar aggregates for one window ───────────────────────────────────

export type Core = {
  opened: number;
  closed: number;
  netBacklog: number;
  openAtEnd: number;
  emergencies: number;
  hazards: number;
  spend: number;
  closuresWithCost: number;
  avgCostPerClosure: number;
  avgDaysToClose: number | null;
  medianDaysToClose: number | null;
  p90DaysToClose: number | null;
  closuresWithPhoto: number;
  rideBys: number;
  rideByProperties: number;
};

async function core(start: string, end: string): Promise<Core> {
  const rows = await query<Row>(
    `select
       count(*) filter (where submitted_at >= $1 and submitted_at < $2) as opened,
       count(*) filter (where closed_at   >= $1 and closed_at   < $2) as closed,
       count(*) filter (where submitted_at < $2
                          and (closed_at is null or closed_at >= $2))  as open_at_end,
       count(*) filter (where submitted_at >= $1 and submitted_at < $2
                          and (is_emergency or priority = 'emergency')) as emergencies,
       count(*) filter (where submitted_at >= $1 and submitted_at < $2
                          and safety_hazard)                            as hazards,
       coalesce(sum(cost_amount) filter (where closed_at >= $1 and closed_at < $2), 0) as spend,
       count(*) filter (where closed_at >= $1 and closed_at < $2
                          and cost_amount is not null)                  as closures_with_cost,
       count(*) filter (where closed_at >= $1 and closed_at < $2
                          and coalesce(completion_photo_count,0) > 0)   as closures_with_photo,
       avg(extract(epoch from (closed_at - submitted_at))/86400)
         filter (where closed_at >= $1 and closed_at < $2)              as avg_days,
       percentile_cont(0.5) within group (
         order by extract(epoch from (closed_at - submitted_at))/86400)
         filter (where closed_at >= $1 and closed_at < $2)              as median_days,
       percentile_cont(0.9) within group (
         order by extract(epoch from (closed_at - submitted_at))/86400)
         filter (where closed_at >= $1 and closed_at < $2)              as p90_days
     from first_choice.work_orders`,
    [start, end]
  );

  const rb = await query<Row>(
    `select count(*) as rides, count(distinct property_id) as props
       from first_choice.ride_bys
      where occurred_on >= ($1::timestamptz at time zone $3)::date
        and occurred_on <  ($2::timestamptz at time zone $3)::date`,
    [start, end, TZ]
  );

  const r = rows[0] ?? {};
  const opened = n(r.opened);
  const closed = n(r.closed);
  const spend = n(r.spend);
  const withCost = n(r.closures_with_cost);

  return {
    opened,
    closed,
    netBacklog: opened - closed,
    openAtEnd: n(r.open_at_end),
    emergencies: n(r.emergencies),
    hazards: n(r.hazards),
    spend,
    closuresWithCost: withCost,
    avgCostPerClosure: withCost ? spend / withCost : 0,
    avgDaysToClose: r.avg_days == null ? null : Number(Number(r.avg_days).toFixed(1)),
    medianDaysToClose: r.median_days == null ? null : Number(Number(r.median_days).toFixed(1)),
    p90DaysToClose: r.p90_days == null ? null : Number(Number(r.p90_days).toFixed(1)),
    closuresWithPhoto: n(r.closures_with_photo),
    rideBys: n(rb[0]?.rides),
    rideByProperties: n(rb[0]?.props),
  };
}

// ─── Breakdowns (current window only) ────────────────────────────────────────

export type GroupRow = {
  name: string;
  opened: number;
  closed: number;
  openAtEnd: number;
  spend: number;
};

async function byColumn(col: "location_group" | "location" | "category", start: string, end: string, limit?: number) {
  const rows = await query<Row>(
    `select coalesce(nullif(${col}, ''), 'Unspecified') as name,
            count(*) filter (where submitted_at >= $1 and submitted_at < $2) as opened,
            count(*) filter (where closed_at   >= $1 and closed_at   < $2) as closed,
            count(*) filter (where submitted_at < $2
                               and (closed_at is null or closed_at >= $2)) as open_at_end,
            coalesce(sum(cost_amount) filter (where closed_at >= $1 and closed_at < $2), 0) as spend
       from first_choice.work_orders
      where (submitted_at >= $1 and submitted_at < $2)
         or (closed_at   >= $1 and closed_at   < $2)
         or (submitted_at < $2 and (closed_at is null or closed_at >= $2))
      group by 1
      having count(*) > 0
      order by opened desc, open_at_end desc, name asc
      ${limit ? `limit ${Number(limit)}` : ""}`,
    [start, end]
  );
  return rows.map<GroupRow>((r) => ({
    name: s(r.name),
    opened: n(r.opened),
    closed: n(r.closed),
    openAtEnd: n(r.open_at_end),
    spend: n(r.spend),
  }));
}

export type Aging = { bucket: string; count: number; color: string };

async function aging(end: string): Promise<Aging[]> {
  const rows = await query<Row>(
    `select
       count(*) filter (where age_days <= 7)                    as b0,
       count(*) filter (where age_days >  7 and age_days <= 30) as b1,
       count(*) filter (where age_days > 30 and age_days <= 90) as b2,
       count(*) filter (where age_days > 90)                    as b3
     from (
       select extract(epoch from ($1::timestamptz - submitted_at))/86400 as age_days
         from first_choice.work_orders
        where submitted_at < $1 and (closed_at is null or closed_at >= $1)
     ) t`,
    [end]
  );
  const r = rows[0] ?? {};
  return [
    { bucket: "0–7 days", count: n(r.b0), color: "#15803D" },
    { bucket: "8–30 days", count: n(r.b1), color: "#B45309" },
    { bucket: "31–90 days", count: n(r.b2), color: "#CC0000" },
    { bucket: "90+ days", count: n(r.b3), color: "#7F1D1D" },
  ];
}

export type OldOpen = {
  workOrderId: string;
  location: string;
  category: string;
  priority: string;
  ageDays: number;
  safetyHazard: boolean;
};

async function oldestOpen(end: string, limit = 5): Promise<OldOpen[]> {
  const rows = await query<Row>(
    `select work_order_id, coalesce(nullif(location,''), location_sub, 'Unspecified') as location,
            category, priority, safety_hazard,
            round((extract(epoch from ($1::timestamptz - submitted_at))/86400)::numeric, 0) as age_days
       from first_choice.work_orders
      where submitted_at < $1 and (closed_at is null or closed_at >= $1)
      order by submitted_at asc
      limit ${Number(limit)}`,
    [end]
  );
  return rows.map((r) => ({
    workOrderId: s(r.work_order_id),
    location: s(r.location),
    category: s(r.category),
    priority: s(r.priority),
    ageDays: n(r.age_days),
    safetyHazard: !!r.safety_hazard,
  }));
}

/** Properties with no ride-by inside the window — the coverage gap. */
async function rideByGaps(start: string, end: string) {
  const rows = await query<Row>(
    `select count(*) as uncovered,
            (select count(*) from first_choice.properties where active is not false) as total
       from first_choice.properties p
      where p.active is not false
        and not exists (
          select 1 from first_choice.ride_bys r
           where r.property_id = p.id
             and r.occurred_on >= ($1::timestamptz at time zone $3)::date
             and r.occurred_on <  ($2::timestamptz at time zone $3)::date
        )`,
    [start, end, TZ]
  );
  const r = rows[0] ?? {};
  return { uncovered: n(r.uncovered), total: n(r.total) };
}

/** Time-sensitive work orders past their needed-by date and still open. */
async function overdueCommitments(end: string) {
  const rows = await query<Row>(
    `select count(*) as n
       from first_choice.work_orders
      where time_sensitive
        and needed_by_date is not null
        and needed_by_date < ($1::timestamptz at time zone $2)::date
        and (closed_at is null or closed_at >= $1)`,
    [end, TZ]
  );
  return n(rows[0]?.n);
}

// ─── Public report shape ─────────────────────────────────────────────────────

export type Report = {
  bounds: Bounds;
  generatedAt: string;
  current: Core;
  previous: Core;
  deltas: Record<string, number | null>;
  byGroup: GroupRow[];
  byLocation: GroupRow[];
  byCategory: GroupRow[];
  aging: Aging[];
  oldestOpen: OldOpen[];
  coverage: { uncovered: number; total: number };
  overdueCommitments: number;
  headlines: string[];
  dataGaps: string[];
};

/** Percent change, guarded against divide-by-zero. Null means "no basis". */
function pct(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return Math.round(((cur - prev) / prev) * 100);
}

export async function buildReport(
  period: Period,
  asOf: Date = new Date(),
  offset = 0
): Promise<Report> {
  const bounds = await resolveBounds(period, asOf, offset);

  const [cur, prev, byGroup, byLocation, byCategory, ag, oldest, cov, overdue] =
    await Promise.all([
      core(bounds.start, bounds.end),
      core(bounds.prevStart, bounds.prevEnd),
      byColumn("location_group", bounds.start, bounds.end),
      byColumn("location", bounds.start, bounds.end, 8),
      byColumn("category", bounds.start, bounds.end, 8),
      aging(bounds.end),
      oldestOpen(bounds.end, 5),
      rideByGaps(bounds.start, bounds.end),
      overdueCommitments(bounds.end),
    ]);

  const deltas: Record<string, number | null> = {
    opened: pct(cur.opened, prev.opened),
    closed: pct(cur.closed, prev.closed),
    openAtEnd: pct(cur.openAtEnd, prev.openAtEnd),
    spend: pct(cur.spend, prev.spend),
    avgDaysToClose:
      cur.avgDaysToClose != null && prev.avgDaysToClose
        ? Math.round(((cur.avgDaysToClose - prev.avgDaysToClose) / prev.avgDaysToClose) * 100)
        : null,
  };

  return {
    bounds,
    generatedAt: new Date().toISOString(),
    current: cur,
    previous: prev,
    deltas,
    byGroup,
    byLocation,
    byCategory,
    aging: ag,
    oldestOpen: oldest,
    coverage: cov,
    overdueCommitments: overdue,
    headlines: headlines(cur, prev, ag, oldest, overdue),
    dataGaps: dataGaps(cur, cov),
  };
}

// ─── Narrative ───────────────────────────────────────────────────────────────
// The CEO reads three lines, not thirty numbers. These are ranked by what
// actually needs a decision, and only fire when the underlying data supports
// the claim.

function headlines(
  c: Core,
  p: Core,
  ag: Aging[],
  oldest: OldOpen[],
  overdue: number
): string[] {
  const out: string[] = [];
  const stale = (ag[2]?.count ?? 0) + (ag[3]?.count ?? 0);

  if (c.emergencies > 0 || c.hazards > 0) {
    out.push(
      `${c.emergencies + c.hazards} safety or emergency item${c.emergencies + c.hazards === 1 ? "" : "s"} came in this period. These bypass normal priority and should be confirmed closed.`
    );
  }
  if (c.netBacklog > 0) {
    out.push(
      `Backlog grew by ${c.netBacklog}. ${c.opened} opened against ${c.closed} closed, leaving ${c.openAtEnd} open at period end.`
    );
  } else if (c.netBacklog < 0) {
    out.push(
      `Backlog shrank by ${Math.abs(c.netBacklog)}. ${c.closed} closed against ${c.opened} opened, leaving ${c.openAtEnd} open at period end.`
    );
  } else if (c.opened > 0) {
    out.push(`Backlog held flat at ${c.openAtEnd} open. ${c.opened} opened and ${c.closed} closed.`);
  }
  if (stale > 0) {
    const o = oldest[0];
    out.push(
      `${stale} open work order${stale === 1 ? " has" : "s have"} been sitting more than 30 days${o ? `, the oldest ${o.ageDays} days at ${o.location}` : ""}.`
    );
  }
  if (overdue > 0) {
    out.push(`${overdue} time-sensitive work order${overdue === 1 ? " is" : "s are"} past the date the requester needed it by.`);
  }
  if (c.spend > 0) {
    const dir =
      p.spend > 0 ? (c.spend > p.spend ? "up from" : c.spend < p.spend ? "down from" : "flat against") : null;
    out.push(
      `Recorded spend was ${money(c.spend)} across ${c.closuresWithCost} closure${c.closuresWithCost === 1 ? "" : "s"}${dir ? `, ${dir} ${money(p.spend)} last period` : ""}.`
    );
  }
  if (c.avgDaysToClose != null) {
    out.push(
      `Average time to close was ${c.avgDaysToClose} days${c.medianDaysToClose != null ? ` (median ${c.medianDaysToClose})` : ""}.`
    );
  }
  return out.slice(0, 5);
}

/**
 * Honest reporting of what the numbers cannot tell you yet. A CEO acting on a
 * spend figure derived from 18% of closures needs to know that.
 */
function dataGaps(c: Core, cov: { uncovered: number; total: number }): string[] {
  const out: string[] = [];
  if (c.closed > 0) {
    const rate = Math.round((c.closuresWithCost / c.closed) * 100);
    if (rate < 80) {
      out.push(
        `Cost was recorded on ${c.closuresWithCost} of ${c.closed} closures (${rate}%). Spend figures are a floor, not a total.`
      );
    }
    const prate = Math.round((c.closuresWithPhoto / c.closed) * 100);
    if (prate < 50) {
      out.push(`${c.closuresWithPhoto} of ${c.closed} closures (${prate}%) included a completion photo.`);
    }
  }
  if (cov.total > 0 && cov.uncovered > 0) {
    out.push(
      `${cov.uncovered} of ${cov.total} active properties had no ride-by logged this period.`
    );
  }
  return out;
}

function money(v: number) {
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}
