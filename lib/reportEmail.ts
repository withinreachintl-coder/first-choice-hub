import type { Report } from "./reports";

// ─────────────────────────────────────────────────────────────────────────────
// Executive report email.
//
// Built with tables and inline styles only — Outlook and Gmail strip flexbox,
// grid, and <style> blocks. Colors and type mirror app/ui/theme.js so the email
// and the in-app Reports tab read as the same document.
// ─────────────────────────────────────────────────────────────────────────────

const K = {
  red: "#CC0000",
  charcoal: "#232325",
  ink: "#171718",
  ink2: "#3F3F46",
  ink3: "#6B7280",
  ink4: "#9CA3AF",
  line: "#E7E7EA",
  bg: "#F6F6F7",
  surface: "#FFFFFF",
  green: "#15803D",
  amber: "#B45309",
  blue: "#1D4ED8",
  crimson: "#7F1D1D",
};

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

const money = (v: number) =>
  (Number(v) || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

const PERIOD_WORD: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

function deltaTag(d: number | null | undefined, invert = false) {
  if (d == null || d === 0) return "";
  const good = invert ? d < 0 : d > 0;
  const color = good ? K.green : K.red;
  const arrow = d > 0 ? "&#9650;" : "&#9660;";
  return `<span style="font-size:11px;font-weight:700;color:${color};white-space:nowrap;">&nbsp;${arrow} ${Math.abs(d)}%</span>`;
}

function kpiCell(label: string, value: string, accent: string, delta = "", sub = "") {
  return `
  <td width="50%" valign="top" style="padding:0 6px 12px 6px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:${K.surface};border:1px solid ${K.line};border-left:3px solid ${accent};border-radius:10px;">
      <tr><td style="padding:12px 14px;">
        <div style="font:700 10px/1.2 ${FONT};letter-spacing:.09em;text-transform:uppercase;color:${K.ink3};padding-bottom:6px;">${esc(label)}</div>
        <div style="font:800 25px/1 ${FONT};letter-spacing:-.02em;color:${accent};">${value}${delta}</div>
        ${sub ? `<div style="font:500 11px/1.35 ${FONT};color:${K.ink3};padding-top:5px;">${esc(sub)}</div>` : ""}
      </td></tr>
    </table>
  </td>`;
}

function sectionTitle(text: string) {
  return `<tr><td style="padding:22px 0 10px 0;font:700 11px/1.2 ${FONT};letter-spacing:.09em;text-transform:uppercase;color:${K.ink3};">${esc(text)}</td></tr>`;
}

function table(headers: string[], rows: string[][], aligns: string[] = []) {
  const th = headers
    .map(
      (h, i) =>
        `<th align="${aligns[i] === "r" ? "right" : "left"}" style="padding:8px 12px;font:700 10px/1.2 ${FONT};letter-spacing:.07em;text-transform:uppercase;color:${K.ink3};border-bottom:1px solid ${K.line};">${esc(h)}</th>`
    )
    .join("");
  const tr = rows
    .map(
      (r) =>
        `<tr>${r
          .map(
            (c, i) =>
              `<td align="${aligns[i] === "r" ? "right" : "left"}" style="padding:9px 12px;font:${i === 0 ? "600" : "400"} 13px/1.4 ${FONT};color:${i === 0 ? K.ink : K.ink2};border-bottom:1px solid ${K.line};">${c}</td>`
          )
          .join("")}</tr>`
    )
    .join("");
  return `<tr><td style="padding-bottom:4px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:${K.surface};border:1px solid ${K.line};border-radius:10px;border-collapse:separate;overflow:hidden;">
      <tr>${th}</tr>${tr}
    </table></td></tr>`;
}

export function reportSubject(r: Report): string {
  const w = PERIOD_WORD[r.bounds.period] ?? "Report";
  const net =
    r.current.netBacklog > 0
      ? `backlog +${r.current.netBacklog}`
      : r.current.netBacklog < 0
        ? `backlog ${r.current.netBacklog}`
        : "backlog flat";
  return `${w} Facilities Report — ${r.bounds.label} — ${r.current.openAtEnd} open, ${net}`;
}

export function renderReportEmail(r: Report): string {
  const c = r.current;
  const word = PERIOD_WORD[r.bounds.period] ?? "Report";
  const staleCount = (r.aging[2]?.count ?? 0) + (r.aging[3]?.count ?? 0);

  const headlines = r.headlines
    .map(
      (h) => `<tr><td style="padding:0 0 9px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="top" style="width:16px;padding-top:6px;"><div style="width:5px;height:5px;border-radius:3px;background:${K.red};"></div></td>
          <td style="font:400 14px/1.55 ${FONT};color:${K.ink2};">${esc(h)}</td>
        </tr></table></td></tr>`
    )
    .join("");

  const gaps = r.dataGaps.length
    ? `<tr><td style="padding:18px 0 0 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;">
          <tr><td style="padding:13px 15px;">
            <div style="font:700 10px/1.2 ${FONT};letter-spacing:.09em;text-transform:uppercase;color:${K.amber};padding-bottom:7px;">What these numbers cannot tell you</div>
            ${r.dataGaps.map((g) => `<div style="font:400 13px/1.5 ${FONT};color:#78350F;padding-bottom:4px;">${esc(g)}</div>`).join("")}
          </td></tr>
        </table></td></tr>`
    : "";

  const agingRows = r.aging.map((a) => [
    `<span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${a.color};margin-right:7px;"></span>${esc(a.bucket)}`,
    String(a.count),
  ]);

  const groupRows = r.byGroup.map((g) => [
    esc(g.name),
    String(g.opened),
    String(g.closed),
    String(g.openAtEnd),
    g.spend > 0 ? money(g.spend) : "—",
  ]);

  const catRows = r.byCategory
    .slice(0, 6)
    .map((g) => [esc(g.name), String(g.opened), String(g.openAtEnd), g.spend > 0 ? money(g.spend) : "—"]);

  const oldRows = r.oldestOpen.map((o) => [
    `${esc(o.location)}${o.safetyHazard ? ` <span style="color:${K.red};font-weight:700;">&#9888;</span>` : ""}<div style="font:400 11px/1.3 ${FONT};color:${K.ink4};padding-top:2px;">${esc(o.workOrderId)} · ${esc(o.category || "Uncategorized")}</div>`,
    `<span style="font-weight:700;color:${o.ageDays > 90 ? K.crimson : o.ageDays > 30 ? K.red : K.ink2};">${o.ageDays}d</span>`,
  ]);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(reportSubject(r))}</title></head>
<body style="margin:0;padding:0;background:${K.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(r.headlines[0] ?? "")}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${K.bg};">
<tr><td align="center" style="padding:20px 12px;">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;">

  <!-- Header -->
  <tr><td style="background:${K.charcoal};border-radius:12px 12px 0 0;padding:20px 22px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td>
        <div style="font:800 16px/1 ${FONT};letter-spacing:-.01em;">
          <span style="color:#FF4D4D;">first </span><span style="color:#ffffff;">choice</span>
        </div>
        <div style="font:600 9.5px/1.2 ${FONT};letter-spacing:.07em;text-transform:uppercase;color:#8E8E96;padding-top:4px;">Facilities Hub</div>
      </td>
      <td align="right" valign="top">
        <div style="font:700 11px/1.2 ${FONT};letter-spacing:.09em;text-transform:uppercase;color:#8E8E96;">${esc(word)} Report</div>
        <div style="font:700 15px/1.2 ${FONT};color:#ffffff;padding-top:5px;">${esc(r.bounds.label)}</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="height:3px;background:${K.red};font-size:0;line-height:0;">&nbsp;</td></tr>

  <!-- Body -->
  <tr><td style="background:${K.bg};padding:22px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

      <tr><td style="font:800 21px/1.25 ${FONT};letter-spacing:-.02em;color:${K.ink};padding-bottom:4px;">The headline</td></tr>
      <tr><td style="font:400 12.5px/1.4 ${FONT};color:${K.ink3};padding-bottom:14px;">
        Compared against ${esc(r.bounds.prevLabel)}. Generated automatically from the Facilities Hub.
      </td></tr>
      ${headlines || `<tr><td style="font:400 14px/1.55 ${FONT};color:${K.ink3};padding-bottom:9px;">No work order activity was recorded this period.</td></tr>`}
      ${gaps}

      ${sectionTitle("The numbers")}
      <tr><td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 -6px;">
          <tr>
            ${kpiCell("Open at period end", String(c.openAtEnd), c.openAtEnd ? K.blue : K.green, deltaTag(r.deltas.openAtEnd, true), `${c.opened} opened · ${c.closed} closed`)}
            ${kpiCell("Net backlog change", `${c.netBacklog > 0 ? "+" : ""}${c.netBacklog}`, c.netBacklog > 0 ? K.red : c.netBacklog < 0 ? K.green : K.ink3, "", c.netBacklog > 0 ? "Falling behind" : c.netBacklog < 0 ? "Catching up" : "Holding steady")}
          </tr>
          <tr>
            ${kpiCell("Avg days to close", c.avgDaysToClose != null ? String(c.avgDaysToClose) : "—", c.avgDaysToClose != null && c.avgDaysToClose > 21 ? K.red : K.charcoal, deltaTag(r.deltas.avgDaysToClose, true), c.medianDaysToClose != null ? `Median ${c.medianDaysToClose} · P90 ${c.p90DaysToClose ?? "—"}` : "No closures this period")}
            ${kpiCell("Recorded spend", money(c.spend), K.green, deltaTag(r.deltas.spend), `${c.closuresWithCost} of ${c.closed} closures costed`)}
          </tr>
          <tr>
            ${kpiCell("Aged over 30 days", String(staleCount), staleCount ? K.red : K.green, "", staleCount ? "Oldest first, below" : "Nothing stale")}
            ${kpiCell("Safety / emergency", String(c.emergencies + c.hazards), c.emergencies + c.hazards ? K.crimson : K.green, "", c.emergencies + c.hazards ? "Confirm these are closed" : "None raised")}
          </tr>
        </table>
      </td></tr>

      ${sectionTitle("Open backlog by age")}
      ${table(["Age of open work orders", "Count"], agingRows, ["l", "r"])}

      ${groupRows.length ? sectionTitle("By organization") + table(["Organization", "Opened", "Closed", "Open", "Spend"], groupRows, ["l", "r", "r", "r", "r"]) : ""}

      ${catRows.length ? sectionTitle("Where the work is") + table(["Category", "Opened", "Open", "Spend"], catRows, ["l", "r", "r", "r"]) : ""}

      ${oldRows.length ? sectionTitle("Oldest open work orders") + table(["Location", "Age"], oldRows, ["l", "r"]) : ""}

      ${
        r.overdueCommitments > 0
          ? `<tr><td style="padding:18px 0 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFF1F1;border:1px solid #FECACA;border-radius:10px;">
                <tr><td style="padding:13px 15px;font:600 13px/1.5 ${FONT};color:#8C0000;">
                  ${r.overdueCommitments} time-sensitive work order${r.overdueCommitments === 1 ? " is" : "s are"} past the date the requester needed it by.
                </td></tr></table></td></tr>`
          : ""
      }

    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:${K.surface};border-top:1px solid ${K.line};border-radius:0 0 12px 12px;padding:16px 22px;">
    <div style="font:400 11px/1.5 ${FONT};color:${K.ink4};">
      First Choice Facilities Hub · Internal use only · Burroughs Restaurant Group<br>
      Period ${esc(r.bounds.label)} measured in US Central time. Generated ${esc(new Date(r.generatedAt).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }))} CT.
    </div>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}
