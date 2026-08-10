import { NextResponse } from "next/server";
import { buildReport, type Period, TZ } from "@/lib/reports";
import { renderReportEmail, reportSubject } from "@/lib/reportEmail";
import { sendEmailTo, reportRecipients } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VALID: Period[] = ["weekly", "monthly", "quarterly", "annual"];

/**
 * Which reports are due today?
 *
 * The schedule is Monday-based:
 *   weekly    — every Monday
 *   monthly   — first Monday of every month
 *   quarterly — first Monday of Jan / Apr / Jul / Oct
 *   annual    — first Monday of January
 *
 * This is decided here rather than in cron syntax on purpose. Standard cron
 * (which Vercel follows) ORs day-of-month against day-of-week, so an expression
 * like `0 12 1-7 * 1` fires every Monday AND every 1st-7th — not the first
 * Monday. Gating in code is unambiguous.
 *
 * Note: on the first Monday of January all four are due, so four emails go out.
 */
export function dueOn(date: Date, tz: string = TZ): Period[] {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "numeric",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";

  if (get("weekday") !== "Mon") return [];

  const day = Number(get("day"));
  const month = Number(get("month"));
  const firstMonday = day <= 7;

  const due: Period[] = ["weekly"];
  if (firstMonday) {
    due.push("monthly");
    if (month === 1 || month === 4 || month === 7 || month === 10) due.push("quarterly");
    if (month === 1) due.push("annual");
  }
  return due;
}

function authorized(req: Request, dryRun: boolean): string | null {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    const alt = req.headers.get("x-cron-secret") ?? "";
    if (auth !== `Bearer ${secret}` && alt !== secret) return "Unauthorized";
    return null;
  }
  if (process.env.NODE_ENV === "production" && !dryRun) {
    return "CRON_SECRET is not configured; refusing to send.";
  }
  return null;
}

async function sendOne(period: Period, offset: number) {
  const report = await buildReport(period, new Date(), offset);
  const html = renderReportEmail(report);
  const subject = reportSubject(report);
  const to = reportRecipients();
  const result = await sendEmailTo(to, subject, html);
  return { period, label: report.bounds.label, subject, recipients: to.length, ...result };
}

/**
 * Scheduled executive report.
 *
 * Cron calls this with `?auto=1` every Monday; the route then decides which of
 * the four reports are actually due. The in-app "Email this report" button
 * calls it with an explicit `period`.
 *
 * `offset=-1` (the default) reports on the period that just finished, so a
 * Monday morning run covers last week rather than the few hours of this one.
 * `?dryRun=1` renders the email and returns it instead of sending.
 */
async function handle(req: Request) {
  const url = new URL(req.url);
  const auto = url.searchParams.get("auto") === "1";
  const dryRun = url.searchParams.get("dryRun") === "1";
  const offset = Number(url.searchParams.get("offset") ?? "-1");

  const authErr = authorized(req, dryRun);
  if (authErr) {
    return NextResponse.json({ error: authErr }, { status: authErr === "Unauthorized" ? 401 : 500 });
  }
  if (!Number.isFinite(offset) || offset > 0 || offset < -24) {
    return NextResponse.json({ error: "offset must be between -24 and 0" }, { status: 400 });
  }

  try {
    // ── Scheduled run: send everything due today ──
    if (auto) {
      const due = dueOn(new Date());
      if (due.length === 0) {
        return NextResponse.json({ skipped: true, reason: "No report is scheduled for today." });
      }
      const results = [];
      for (const p of due) results.push(await sendOne(p, offset));
      return NextResponse.json({ due, results });
    }

    // ── Manual run: one explicit period ──
    const period = (url.searchParams.get("period") ?? "weekly") as Period;
    if (!VALID.includes(period)) {
      return NextResponse.json({ error: `Invalid period: ${period}` }, { status: 400 });
    }

    if (dryRun) {
      const report = await buildReport(period, new Date(), offset);
      return new NextResponse(renderReportEmail(report), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return NextResponse.json(await sendOne(period, offset));
  } catch (e) {
    console.error("[reports/send]", e);
    return NextResponse.json({ error: "Failed to send report" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
