"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { C, SP, R, EL, TYPE, NUM, MONO, Icon, Card, EmptyState } from "../ui/theme";

// ─────────────────────────────────────────────────────────────────────────────
// On-demand Open WOs / Closed WOs reports, filtered by location and date.
// Data: GET /api/wo-reports (reads first_choice.v_open_wo_report and
// first_choice.v_closed_wo_report). Separate from the executive Reports tab.
// ─────────────────────────────────────────────────────────────────────────────

const TZ = "America/Chicago";
const REPORTS = {
  open:   { name: "Open WOs",   file: "Open-WOs",   dateLabel: "Date opened" },
  closed: { name: "Closed WOs", file: "Closed-WOs", dateLabel: "Date closed" },
};

const COLUMNS = {
  open: [
    { key: "workOrderId", label: "WO #", mono: true },
    { key: "location",    label: "Location" },
    { key: "dateOpened",  label: "Date Opened", fmt: fmtDate },
    { key: "daysOpen",    label: "Days Open", align: "right" },
    { key: "priority",    label: "Priority", fmt: cap },
    { key: "category",    label: "Category" },
  ],
  closed: [
    { key: "workOrderId", label: "WO #", mono: true },
    { key: "location",    label: "Location" },
    { key: "dateOpened",  label: "Date Opened", fmt: fmtDate },
    { key: "dateClosed",  label: "Date Closed", fmt: fmtDate },
    { key: "timeIn",      label: "Time In" },
    { key: "timeOut",     label: "Time Out" },
    { key: "hours",       label: "Hours", align: "right", fmt: (v) => (v == null ? "" : Number(v).toFixed(2)) },
    { key: "techName",    label: "Tech" },
    { key: "costAmount",  label: "Cost", align: "right", fmt: (v) => (v == null ? "" : fmtUsd(v)) },
  ],
};

// ─── Utils ───────────────────────────────────────────────────────────────────
function chicagoToday() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date()).map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}-${p.day}`;
}
function addDays(ymd, n) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function fmtDate(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || "")) return "";
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
}
function fmtUsd(v) {
  return (Number(v) || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}
function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}
const cell = (col, row) => {
  const raw = col.key === "location" ? (row.locationSub || row.location) : row[col.key];
  const v = col.fmt ? col.fmt(raw) : raw;
  return v === "" || v == null ? "-" : String(v);
};
const locationLabel = (group, sub) => (group ? (sub ? `${group} / ${sub}` : group) : "All locations");
const slug = (s) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");

// Group the (already sorted) rows by location_group, then location_sub.
function groupRows(rows) {
  const out = [];
  let cur = null;
  for (const r of rows) {
    const key = JSON.stringify([r.locationGroup, r.locationSub]);
    if (!cur || cur.key !== key) {
      cur = { key, group: r.locationGroup || "Unspecified", sub: r.locationSub, rows: [] };
      out.push(cur);
    }
    cur.rows.push(r);
  }
  return out;
}

function totalsFor(rows) {
  return {
    count: rows.length,
    hours: rows.reduce((s, r) => s + (Number(r.hours) || 0), 0),
    cost: rows.reduce((s, r) => s + (Number(r.costAmount) || 0), 0),
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function WoReports() {
  const [type, setType] = useState("open");
  const [group, setGroup] = useState("");
  const [sub, setSub] = useState("");
  const [to, setTo] = useState(chicagoToday);
  const [from, setFrom] = useState(() => addDays(chicagoToday(), -30));
  const [report, setReport] = useState(null); // { type, group, sub, from, to, rows, generatedAt }
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    if (!from || !to) { setError("Pick both Date From and Date To."); return; }
    if (from > to) { setError("Date From must be on or before Date To."); return; }
    const id = ++reqId.current;
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams({ type, group, sub, from, to });
      const res = await fetch(`/api/wo-reports?${qs}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      if (id !== reqId.current) return;
      setLocations(j.locations || []);
      setReport({
        type, group, sub, from, to, rows: j.rows || [],
        generatedAt: new Date().toLocaleString("en-US", { timeZone: TZ, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }),
      });
    } catch (e) {
      if (id === reqId.current) setError(`Couldn't build the report: ${e.message}`);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [type, group, sub, from, to]);

  useEffect(() => { load(); }, [load]);

  const groups = [...new Set(locations.map((l) => l.group))];
  const subs = group ? locations.filter((l) => l.group === group && l.sub).map((l) => l.sub) : [];

  const downloadPDF = async () => {
    if (!report) return;
    const { jsPDF } = await import("jspdf");
    buildWoReportPDF(jsPDF, report);
  };

  const shown = report && report.type === type ? report : null;
  const cols = COLUMNS[type];
  const grouped = shown ? groupRows(shown.rows) : [];
  const totals = shown ? totalsFor(shown.rows) : null;

  return (
    <>
      <div style={{ marginBottom: SP.xl }}>
        <span style={{ display: "inline-flex", alignItems: "center", background: C.red, color: "#fff",
          ...TYPE.eyebrow, fontSize: 10, padding: "4px 9px", borderRadius: R.sm - 2, marginBottom: SP.md }}>
          On-demand
        </span>
        <h1 style={{ ...TYPE.display, color: C.ink, margin: `0 0 ${SP.sm}px` }}>Work Order Reports</h1>
        <p style={{ ...TYPE.small, fontSize: 13.5, color: C.ink3, margin: 0 }}>
          Open and closed work orders by location and date.
        </p>
      </div>

      {/* Tabs */}
      <div role="tablist" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: 4,
        background: C.surface, border: `1px solid ${C.line}`, borderRadius: R.md, marginBottom: SP.base, boxShadow: EL.sm }}>
        {Object.entries(REPORTS).map(([k, r]) => {
          const on = type === k;
          return (
            <button key={k} type="button" role="tab" aria-selected={on} onClick={() => setType(k)}
              style={{ padding: "10px 8px", border: "none", borderRadius: R.sm, cursor: "pointer",
                background: on ? C.charcoal : "transparent", color: on ? "#fff" : C.ink2,
                ...TYPE.smallStrong, fontSize: 14 }}>
              {r.name}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: SP.base }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: SP.md }}>
          <Field label="Location Group">
            <Select value={group} onChange={(v) => { setGroup(v); setSub(""); }}
              options={[["", "All"], ...groups.map((g) => [g, g])]} />
          </Field>
          <Field label="Location">
            <Select value={sub} onChange={setSub} disabled={!group}
              options={[["", "All"], ...subs.map((s) => [s, s])]} />
          </Field>
          <Field label="Date From">
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Date To">
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
          </Field>
        </div>
        <div style={{ ...TYPE.micro, fontWeight: 500, color: C.ink4, marginTop: SP.sm }}>
          Dates filter on {REPORTS[type].dateLabel.toLowerCase()} (Central time).
        </div>
      </Card>

      {error && (
        <div role="alert" style={{ display: "flex", alignItems: "center", gap: 10, padding: `${SP.md}px ${SP.base}px`,
          borderRadius: R.md, border: "1px solid #FECACA", background: C.redSoft, color: "#8C0000",
          ...TYPE.smallStrong, marginBottom: SP.base }}>
          <Icon name="alert" size={17} color="#8C0000" />{error}
        </div>
      )}

      {loading && !shown && (
        <div style={{ height: 160, borderRadius: R.md, border: `1px solid ${C.line}`,
          background: "linear-gradient(90deg,#F1F1F3 25%,#E9E9EC 50%,#F1F1F3 75%)",
          backgroundSize: "200% 100%", animation: "fc-shimmer 1.4s infinite" }} />
      )}

      {shown && (
        <Card pad={0} style={{ overflow: "hidden", opacity: loading ? 0.6 : 1, transition: "opacity 0.15s" }}>
          {/* Report header */}
          <div style={{ padding: SP.base, borderBottom: `1px solid ${C.line}`, display: "flex",
            flexWrap: "wrap", gap: SP.md, alignItems: "flex-start", justifyContent: "space-between" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ ...TYPE.title, color: C.ink }}>{REPORTS[shown.type].name}</div>
              <div style={{ ...TYPE.small, color: C.ink2, marginTop: 4 }}>{locationLabel(shown.group, shown.sub)}</div>
              <div style={{ ...TYPE.small, color: C.ink3 }}>{fmtDate(shown.from)} to {fmtDate(shown.to)}</div>
              <div style={{ ...TYPE.micro, fontWeight: 500, color: C.ink4, marginTop: 4 }}>Generated {shown.generatedAt}</div>
            </div>
            <div style={{ display: "flex", gap: SP.sm }}>
              <button type="button" onClick={load} disabled={loading} aria-label="Refresh" style={iconBtn}>
                <Icon name="refresh" size={16} color={C.ink2} style={{ animation: loading ? "fc-spin 1s linear infinite" : "none" }} />
              </button>
              <button type="button" onClick={downloadPDF} disabled={loading} style={pdfBtn}>
                <Icon name="download" size={16} color="#fff" /> Download PDF
              </button>
            </div>
          </div>

          {shown.rows.length === 0 ? (
            <div style={{ padding: SP.base }}>
              <EmptyState icon="doc" title="No work orders" body="Nothing matches these filters. Try a wider date range or another location." />
            </div>
          ) : (
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: "100%", minWidth: type === "closed" ? 980 : 640, borderCollapse: "collapse", ...TYPE.small }}>
                <thead>
                  <tr style={{ background: C.surfaceAlt }}>
                    {cols.map((c) => (
                      <th key={c.key} style={{ ...th, textAlign: c.align || "left" }}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grouped.map((g) => (
                    <GroupRows key={g.key} g={g} cols={cols} type={type} />
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: C.charcoal, color: "#fff" }}>
                    <td style={{ ...td, fontWeight: 700, borderTop: "none" }} colSpan={type === "closed" ? 6 : cols.length}>
                      Total: {totals.count} work order{totals.count === 1 ? "" : "s"}
                    </td>
                    {type === "closed" && (
                      <>
                        <td style={{ ...td, textAlign: "right", fontWeight: 700, borderTop: "none", ...NUM }}>{totals.hours.toFixed(2)}</td>
                        <td style={{ ...td, borderTop: "none" }} />
                        <td style={{ ...td, textAlign: "right", fontWeight: 700, borderTop: "none", ...NUM }}>{fmtUsd(totals.cost)}</td>
                      </>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  );
}

function GroupRows({ g, cols, type }) {
  const t = totalsFor(g.rows);
  return (
    <>
      <tr>
        <td colSpan={cols.length} style={{ ...td, background: "#F4F4F5", fontWeight: 700, color: C.ink }}>
          {g.group}{g.sub ? ` / ${g.sub}` : ""}
          <span style={{ fontWeight: 500, color: C.ink3 }}>
            {" "}· {t.count} WO{t.count === 1 ? "" : "s"}
            {type === "closed" ? ` · ${t.hours.toFixed(2)} hrs · ${fmtUsd(t.cost)}` : ""}
          </span>
        </td>
      </tr>
      {g.rows.map((r) => (
        <tr key={r.workOrderId}>
          {cols.map((c) => (
            <td key={c.key} style={{ ...td, textAlign: c.align || "left", whiteSpace: "nowrap",
              ...(c.mono ? { fontFamily: MONO, fontSize: 12 } : {}), ...(c.align === "right" ? NUM : {}) }}>
              {cell(c, r)}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span style={{ ...TYPE.smallStrong, fontSize: 12.5, color: C.ink2 }}>{label}</span>
      {children}
    </label>
  );
}

function Select({ value, onChange, options, disabled }) {
  return (
    <div style={{ position: "relative" }}>
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, appearance: "none", WebkitAppearance: "none", paddingRight: 32,
          opacity: disabled ? 0.55 : 1, cursor: disabled ? "not-allowed" : "pointer" }}>
        {options.map(([v, l]) => <option key={v || "_all"} value={v}>{l}</option>)}
      </select>
      <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex" }}>
        <Icon name="chevronDown" size={14} color={C.ink4} />
      </span>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "10px 12px", fontSize: 14, fontFamily: "inherit", color: C.ink,
  border: `1px solid ${C.lineStrong}`, borderRadius: R.sm, background: C.surface, boxShadow: EL.sm, minWidth: 0,
};
const th = { ...TYPE.eyebrow, fontSize: 10, color: C.ink3, padding: "9px 12px", borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap" };
const td = { padding: "9px 12px", borderTop: `1px solid ${C.line}`, color: C.ink2 };
const iconBtn = { display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38,
  background: C.surface, border: `1px solid ${C.line}`, borderRadius: R.sm, cursor: "pointer", boxShadow: EL.sm, padding: 0 };
const pdfBtn = { display: "flex", alignItems: "center", gap: 7, height: 38, padding: "0 14px", background: C.red, color: "#fff",
  border: "none", borderRadius: R.sm, ...TYPE.smallStrong, cursor: "pointer", boxShadow: "0 2px 8px rgba(204,0,0,0.22)", whiteSpace: "nowrap" };

// ─── PDF ─────────────────────────────────────────────────────────────────────
// Exports exactly the report on screen: same rows, grouping, totals and header.

const PDF_WIDTHS = {
  open:   [40, 70, 34, 24, 30, 75],
  closed: [34, 42, 25, 25, 37, 37, 16, 32, 25],
};

function buildWoReportPDF(jsPDF, rep) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297, H = 210, M = 12, CW = W - M * 2;
  const cols = COLUMNS[rep.type];
  const widths = PDF_WIDTHS[rep.type];
  const colX = (i) => M + widths.slice(0, i).reduce((a, b) => a + b, 0);
  const loc = locationLabel(rep.group, rep.sub);
  let y = 0;

  // Header (matches the executive report PDF)
  doc.setFillColor(35, 35, 37); doc.rect(0, 0, W, 30, "F");
  doc.setFillColor(204, 0, 0); doc.rect(0, 30, W, 2.5, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.setTextColor(255, 77, 77);
  doc.text("first", M, 15);
  const fw = doc.getTextWidth("first ");
  doc.setTextColor(255, 255, 255); doc.text("choice", M + fw, 15);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(142, 142, 150);
  doc.text("FACILITIES HUB", M, 21);
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(255, 255, 255);
  doc.text(REPORTS[rep.type].name.toUpperCase(), W - M, 12, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(210, 210, 215);
  doc.text(loc, W - M, 18, { align: "right" });
  doc.text(`${fmtDate(rep.from)} to ${fmtDate(rep.to)}`, W - M, 23, { align: "right" });
  doc.setFontSize(7); doc.setTextColor(142, 142, 150);
  doc.text(`Generated ${rep.generatedAt}`, W - M, 27.5, { align: "right" });
  y = 40;

  const headerRow = () => {
    doc.setFillColor(250, 250, 251); doc.rect(M, y, CW, 7, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); doc.setTextColor(107, 114, 128);
    cols.forEach((c, i) => {
      const label = c.label.toUpperCase();
      if (c.align === "right") doc.text(label, colX(i) + widths[i] - 2, y + 4.7, { align: "right" });
      else doc.text(label, colX(i) + 2, y + 4.7);
    });
    y += 7;
  };
  const ensure = (h) => {
    if (y + h > H - 16) { doc.addPage(); y = 14; headerRow(); }
  };

  headerRow();
  if (rep.rows.length === 0) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(107, 114, 128);
    doc.text("No work orders match these filters.", M + 2, y + 7);
  }

  groupRows(rep.rows).forEach((g) => {
    const t = totalsFor(g.rows);
    ensure(14);
    doc.setFillColor(244, 244, 245); doc.rect(M, y, CW, 7, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(23, 23, 24);
    const title = `${g.group}${g.sub ? ` / ${g.sub}` : ""}`;
    doc.text(title, M + 2, y + 4.8);
    const titleW = doc.getTextWidth(title); // measure in bold, before switching fonts
    doc.setFont("helvetica", "normal"); doc.setTextColor(107, 114, 128);
    doc.text(`· ${t.count} WO${t.count === 1 ? "" : "s"}${rep.type === "closed" ? ` · ${t.hours.toFixed(2)} hrs · ${fmtUsd(t.cost)}` : ""}`,
      M + 4 + titleW, y + 4.8);
    y += 7;

    doc.setFontSize(7.5);
    g.rows.forEach((r) => {
      ensure(6.5);
      doc.setDrawColor(238, 238, 241); doc.line(M, y, M + CW, y);
      cols.forEach((c, i) => {
        doc.setFont(c.mono ? "courier" : "helvetica", "normal");
        doc.setTextColor(i === 0 ? 23 : 63, i === 0 ? 23 : 63, i === 0 ? 24 : 70);
        const txt = doc.splitTextToSize(cell(c, r), widths[i] - 3)[0] || "";
        if (c.align === "right") doc.text(txt, colX(i) + widths[i] - 2, y + 4.4, { align: "right" });
        else doc.text(txt, colX(i) + 2, y + 4.4);
      });
      y += 6.5;
    });
  });

  // Grand total
  const totals = totalsFor(rep.rows);
  ensure(9);
  doc.setFillColor(45, 45, 45); doc.rect(M, y + 1, CW, 8, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(255, 255, 255);
  doc.text(`Total: ${totals.count} work order${totals.count === 1 ? "" : "s"}`, M + 2, y + 6.2);
  if (rep.type === "closed") {
    doc.text(totals.hours.toFixed(2), colX(6) + widths[6] - 2, y + 6.2, { align: "right" });
    doc.text(fmtUsd(totals.cost), colX(8) + widths[8] - 2, y + 6.2, { align: "right" });
  }

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(231, 231, 234); doc.line(M, H - 10, W - M, H - 10);
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(160, 160, 168);
    doc.text("First Choice Facilities Hub · Internal Use Only", M, H - 5.5);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 5.5, { align: "right" });
  }

  const locSlug = rep.group ? slug(rep.sub ? `${rep.group}-${rep.sub}` : rep.group) : "All-Locations";
  doc.save(`${REPORTS[rep.type].file}_${locSlug}_${rep.from}_${rep.to}.pdf`);
}
