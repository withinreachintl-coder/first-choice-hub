"use client";
import { useState, useCallback, useEffect } from "react";
import {
  C, SP, R, EL, TYPE, NUM,
  Icon, Card, Eyebrow, Kpi, Dot, StackBar, EmptyState, usd,
} from "../ui/theme";

// ═════════════════════════════════════════════════════════════════════════════
// REPORTS — weekly / monthly / quarterly / annual executive view
//
// Reads the same aggregates the scheduled email uses (/api/reports), so what a
// CEO sees on the phone and what lands in the inbox can never disagree.
// ═════════════════════════════════════════════════════════════════════════════

const PERIODS = [
  { id: "weekly", label: "Week" },
  { id: "monthly", label: "Month" },
  { id: "quarterly", label: "Quarter" },
  { id: "annual", label: "Year" },
];

const num = (v) => (v == null ? "—" : Number(v).toLocaleString("en-US"));

// ─── Small building blocks ───────────────────────────────────────────────────

function Toolbar({ period, setPeriod, offset, setOffset, label, onRefresh, loading }) {
  return (
    <div style={{ marginBottom: SP.base }}>
      <div style={{ display: "flex", background: C.surfaceAlt, border: `1px solid ${C.line}`,
        borderRadius: R.sm + 2, padding: 3, marginBottom: SP.md }}>
        {PERIODS.map((p) => {
          const on = period === p.id;
          return (
            <button key={p.id} type="button"
              onClick={() => { setPeriod(p.id); setOffset(0); }}
              style={{ flex: 1, padding: "8px 4px", border: "none", cursor: "pointer",
                borderRadius: R.sm - 1, background: on ? C.surface : "transparent",
                boxShadow: on ? EL.sm : "none", fontSize: 13,
                fontWeight: on ? 700 : 500, color: on ? C.ink : C.ink3, transition: "all 0.15s" }}>
              {p.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: SP.sm }}>
        <div style={{ display: "flex", alignItems: "center", gap: SP.sm }}>
          <button type="button" aria-label="Previous period" onClick={() => setOffset(offset - 1)}
            style={btn()}><Icon name="arrowLeft" size={15} color={C.ink2} /></button>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...TYPE.bodyStrong, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {label || "…"}
            </div>
            {offset === 0 && <div style={{ ...TYPE.micro, fontWeight: 500, color: C.ink3 }}>In progress</div>}
          </div>
          <button type="button" aria-label="Next period" disabled={offset >= 0}
            onClick={() => setOffset(Math.min(0, offset + 1))}
            style={{ ...btn(), opacity: offset >= 0 ? 0.35 : 1, cursor: offset >= 0 ? "not-allowed" : "pointer" }}>
            <Icon name="chevronRight" size={15} color={C.ink2} />
          </button>
        </div>
        <button type="button" aria-label="Refresh" onClick={onRefresh} disabled={loading} style={btn()}>
          <Icon name="refresh" size={15} color={C.ink2}
            style={{ animation: loading ? "fc-spin 1s linear infinite" : "none" }} />
        </button>
      </div>
    </div>
  );
}

const btn = () => ({
  display: "flex", alignItems: "center", justifyContent: "center",
  width: 34, height: 34, background: C.surface, border: `1px solid ${C.line}`,
  borderRadius: R.sm, cursor: "pointer", boxShadow: EL.sm, padding: 0, flexShrink: 0,
});

/** Ranked horizontal bar list — used for organizations and categories. */
function BarList({ rows, valueKey, format = num, accent = C.red, emptyText }) {
  if (!rows.length) return <div style={{ ...TYPE.small, color: C.ink3 }}>{emptyText}</div>;
  const max = Math.max(...rows.map((r) => Number(r[valueKey]) || 0), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SP.md }}>
      {rows.map((r) => (
        <div key={r.name}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: SP.md, marginBottom: 5 }}>
            <span style={{ ...TYPE.small, color: C.ink2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {r.name}
            </span>
            <span style={{ ...TYPE.smallStrong, color: C.ink, flexShrink: 0, ...NUM }}>
              {format(r[valueKey])}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: R.pill, background: C.surfaceAlt, overflow: "hidden" }}>
            <div style={{ width: `${Math.max(2, ((Number(r[valueKey]) || 0) / max) * 100)}%`, height: "100%",
              borderRadius: R.pill, background: accent, transition: "width 0.45s ease" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Row({ left, right, sub, tone }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: SP.md,
      padding: "10px 0", borderTop: `1px solid ${C.line}` }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...TYPE.small, color: C.ink2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{left}</div>
        {sub && <div style={{ ...TYPE.micro, fontWeight: 500, color: C.ink4, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ ...TYPE.smallStrong, color: tone || C.ink, flexShrink: 0, ...NUM }}>{right}</div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function Reports() {
  const [period, setPeriod] = useState("monthly");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [emailing, setEmailing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/reports?period=${period}&offset=${offset}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch {
      setError("Couldn't build the report. Check the connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [period, offset]);

  useEffect(() => { load(); }, [load]);

  const emailReport = async () => {
    setEmailing({ type: "loading", message: "Sending…" });
    try {
      const res = await fetch(`/api/reports/send?period=${period}&offset=${offset}`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`);
      setEmailing(
        j.sent
          ? { type: "success", message: `Sent to ${j.recipients} recipient${j.recipients === 1 ? "" : "s"}.` }
          : { type: "error", message: `Not sent — ${j.reason || "no recipients configured"}.` }
      );
    } catch (e) {
      setEmailing({ type: "error", message: `Could not send: ${e.message}` });
    }
  };

  const downloadPDF = async () => {
    if (!data) return;
    const { jsPDF } = await import("jspdf");
    buildReportPDF(jsPDF, data);
  };

  const c = data?.current;
  const stale = data ? (data.aging[2]?.count ?? 0) + (data.aging[3]?.count ?? 0) : 0;

  return (
    <>
      <div style={{ marginBottom: SP.xl }}>
        <span style={{ display: "inline-flex", alignItems: "center", background: C.charcoal, color: "#fff",
          ...TYPE.eyebrow, fontSize: 10, padding: "4px 9px", borderRadius: R.sm - 2, marginBottom: SP.md }}>
          Executive
        </span>
        <h1 style={{ ...TYPE.display, color: C.ink, margin: `0 0 ${SP.sm}px` }}>Reports</h1>
        <p style={{ ...TYPE.small, fontSize: 13.5, color: C.ink3, margin: 0 }}>
          Portfolio health, spend, and backlog — with the prior period for comparison.
        </p>
      </div>

      <Toolbar period={period} setPeriod={setPeriod} offset={offset} setOffset={setOffset}
        label={data?.bounds?.label} onRefresh={load} loading={loading} />

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: `${SP.md}px ${SP.base}px`,
          borderRadius: R.md, border: "1px solid #FECACA", background: C.redSoft, color: "#8C0000",
          ...TYPE.smallStrong, marginBottom: SP.lg }}>
          <Icon name="alert" size={17} color="#8C0000" />{error}
        </div>
      )}

      {loading && !data && (
        <div style={{ display: "flex", flexDirection: "column", gap: SP.sm + 2 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 76, borderRadius: R.md, border: `1px solid ${C.line}`,
              background: "linear-gradient(90deg,#F1F1F3 25%,#E9E9EC 50%,#F1F1F3 75%)",
              backgroundSize: "200% 100%", animation: "fc-shimmer 1.4s infinite" }} />
          ))}
        </div>
      )}

      {data && c && (
        <>
          {/* ── The headline ── */}
          <Card style={{ marginBottom: SP.base }}>
            <Eyebrow style={{ marginBottom: SP.md }}>The headline</Eyebrow>
            {data.headlines.length === 0 ? (
              <div style={{ ...TYPE.small, color: C.ink3 }}>No work order activity was recorded this period.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: SP.md }}>
                {data.headlines.map((h, i) => (
                  <div key={i} style={{ display: "flex", gap: SP.md, alignItems: "flex-start" }}>
                    <span style={{ marginTop: 7 }}><Dot color={C.red} size={5} /></span>
                    <span style={{ ...TYPE.body, fontSize: 14.5, color: C.ink2 }}>{h}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ ...TYPE.micro, fontWeight: 500, color: C.ink4, marginTop: SP.base,
              paddingTop: SP.md, borderTop: `1px solid ${C.line}` }}>
              Compared against {data.bounds.prevLabel}
            </div>
          </Card>

          {/* ── Data gaps ── */}
          {data.dataGaps.length > 0 && (
            <div style={{ background: C.amberSoft, border: "1px solid #FDE68A", borderRadius: R.md,
              padding: `${SP.md}px ${SP.base}px`, marginBottom: SP.base }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: SP.sm }}>
                <Icon name="alert" size={14} color={C.amber} />
                <Eyebrow color={C.amber}>What these numbers cannot tell you</Eyebrow>
              </div>
              {data.dataGaps.map((g, i) => (
                <div key={i} style={{ ...TYPE.small, color: "#78350F", marginTop: i ? 5 : 0 }}>{g}</div>
              ))}
            </div>
          )}

          {/* ── KPIs ── */}
          <div className="fc-kpi" style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: SP.sm + 2, marginBottom: SP.base }}>
            <Kpi label="Open at end" value={num(c.openAtEnd)} accent={c.openAtEnd ? C.blue : C.green}
              icon="wrench" delta={data.deltas.openAtEnd} sub={`${c.opened} opened · ${c.closed} closed`} />
            <Kpi label="Net backlog" value={`${c.netBacklog > 0 ? "+" : ""}${c.netBacklog}`}
              accent={c.netBacklog > 0 ? C.red : c.netBacklog < 0 ? C.green : C.ink3} icon="chart"
              sub={c.netBacklog > 0 ? "Falling behind" : c.netBacklog < 0 ? "Catching up" : "Holding steady"} />
            <Kpi label="Avg days to close" value={c.avgDaysToClose ?? "—"}
              accent={c.avgDaysToClose != null && c.avgDaysToClose > 21 ? C.red : C.charcoal} icon="clock"
              delta={data.deltas.avgDaysToClose}
              sub={c.medianDaysToClose != null ? `Median ${c.medianDaysToClose} · P90 ${c.p90DaysToClose ?? "—"}` : "No closures"} />
            <Kpi label="Recorded spend" value={usd(c.spend)} accent={C.green} icon="dollar"
              delta={data.deltas.spend} sub={`${c.closuresWithCost} of ${c.closed} closures costed`} />
            <Kpi label="Aged 30+ days" value={num(stale)} accent={stale ? C.red : C.green} icon="alert"
              sub={stale ? "See oldest below" : "Nothing stale"} />
            <Kpi label="Safety / emergency" value={num(c.emergencies + c.hazards)}
              accent={c.emergencies + c.hazards ? C.crimson : C.green} icon="alert"
              sub={c.emergencies + c.hazards ? "Confirm closed" : "None raised"} />
          </div>

          {/* ── Backlog aging ── */}
          <Card style={{ marginBottom: SP.base }}>
            <Eyebrow style={{ marginBottom: SP.md }}>Open backlog by age</Eyebrow>
            <StackBar segments={data.aging.map((a) => ({ label: a.bucket, color: a.color, value: a.count }))} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: `${SP.sm}px ${SP.base}px`, marginTop: SP.md }}>
              {data.aging.map((a) => (
                <span key={a.bucket} style={{ display: "inline-flex", alignItems: "center", gap: 6, ...TYPE.small, color: C.ink3 }}>
                  <Dot color={a.color} size={7} />
                  <b style={{ color: C.ink, fontWeight: 700, ...NUM }}>{a.count}</b> {a.bucket}
                </span>
              ))}
            </div>
          </Card>

          {/* ── By organization ── */}
          {data.byGroup.length > 0 && (
            <Card style={{ marginBottom: SP.base }}>
              <Eyebrow style={{ marginBottom: SP.base }}>By organization</Eyebrow>
              <BarList rows={data.byGroup} valueKey="opened" accent={C.charcoal} emptyText="No activity." />
              <div style={{ marginTop: SP.base }}>
                {data.byGroup.map((g) => (
                  <Row key={g.name} left={g.name}
                    sub={`${g.opened} opened · ${g.closed} closed · ${g.openAtEnd} open`}
                    right={g.spend > 0 ? usd(g.spend) : "—"}
                    tone={g.spend > 0 ? C.green : C.ink4} />
                ))}
              </div>
            </Card>
          )}

          {/* ── Categories ── */}
          {data.byCategory.length > 0 && (
            <Card style={{ marginBottom: SP.base }}>
              <Eyebrow style={{ marginBottom: SP.base }}>Where the work is</Eyebrow>
              <BarList rows={data.byCategory.slice(0, 6)} valueKey="opened" accent={C.red}
                emptyText="No work orders opened this period." />
            </Card>
          )}

          {/* ── Locations ── */}
          {data.byLocation.length > 0 && (
            <Card style={{ marginBottom: SP.base }}>
              <Eyebrow style={{ marginBottom: SP.base }}>Busiest locations</Eyebrow>
              <BarList rows={data.byLocation.slice(0, 6)} valueKey="opened" accent={C.blue}
                emptyText="No work orders opened this period." />
            </Card>
          )}

          {/* ── Oldest open ── */}
          {data.oldestOpen.length > 0 && (
            <Card style={{ marginBottom: SP.base }}>
              <Eyebrow style={{ marginBottom: SP.sm }}>Oldest open work orders</Eyebrow>
              {data.oldestOpen.map((o) => (
                <Row key={o.workOrderId}
                  left={
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {o.location}
                      {o.safetyHazard && <Icon name="alert" size={12} color={C.red} />}
                    </span>
                  }
                  sub={`${o.workOrderId} · ${o.category || "Uncategorized"}`}
                  right={`${o.ageDays}d`}
                  tone={o.ageDays > 90 ? C.crimson : o.ageDays > 30 ? C.red : C.ink2} />
              ))}
            </Card>
          )}

          {/* ── Property coverage ── */}
          <Card style={{ marginBottom: SP.base }}>
            <Eyebrow style={{ marginBottom: SP.md }}>Property coverage</Eyebrow>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: SP.md }}>
              <span style={{ ...TYPE.small, color: C.ink3 }}>Ride-bys logged</span>
              <span style={{ ...TYPE.section, color: C.ink, ...NUM }}>{num(c.rideBys)}</span>
            </div>
            <Row left="Properties visited" right={`${c.rideByProperties} of ${data.coverage.total}`} />
            <Row left="No visit this period" right={num(data.coverage.uncovered)}
              tone={data.coverage.uncovered ? C.amber : C.green} />
            {data.overdueCommitments > 0 && (
              <Row left="Past requester's needed-by date" right={num(data.overdueCommitments)} tone={C.red} />
            )}
          </Card>

          {/* ── Actions ── */}
          {emailing && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: `${SP.md}px ${SP.base}px`,
              borderRadius: R.md, marginBottom: SP.md, ...TYPE.smallStrong,
              border: `1px solid ${emailing.type === "error" ? "#FECACA" : emailing.type === "success" ? "#BBF7D0" : "#BFDBFE"}`,
              background: emailing.type === "error" ? C.redSoft : emailing.type === "success" ? C.greenSoft : C.blueSoft,
              color: emailing.type === "error" ? "#8C0000" : emailing.type === "success" ? C.green : "#1D4ED8" }}>
              <Icon name={emailing.type === "success" ? "checkCircle" : emailing.type === "error" ? "alert" : "mail"} size={16} />
              {emailing.message}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: SP.sm + 2 }}>
            <button type="button" onClick={downloadPDF}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%",
                padding: "14px 20px", background: C.red, color: "#fff", border: "none", borderRadius: R.sm + 2,
                fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(204,0,0,0.22)" }}>
              <Icon name="download" size={17} color="#fff" /> Download PDF
            </button>
            <button type="button" onClick={emailReport} disabled={emailing?.type === "loading"}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%",
                padding: "14px 20px", background: C.surface, color: C.ink2, border: `1px solid ${C.lineStrong}`,
                borderRadius: R.sm + 2, fontSize: 15, fontWeight: 600, cursor: "pointer", boxShadow: EL.sm,
                opacity: emailing?.type === "loading" ? 0.6 : 1 }}>
              <Icon name="mail" size={17} color={C.ink2} /> Email this report
            </button>
          </div>

          <p style={{ textAlign: "center", color: C.ink4, fontSize: 11, fontWeight: 500,
            margin: `${SP.xl}px 0 0`, letterSpacing: "0.02em" }}>
            Reports email automatically on Mondays: weekly every Monday, monthly, quarterly, and annual on the first Monday. Periods measured in US Central time.
          </p>
        </>
      )}

      {data && !c && !loading && (
        <EmptyState icon="chart" title="No data for this period"
          body="Nothing was opened or closed in this window. Use the arrows to look at an earlier period." />
      )}
    </>
  );
}

// ─── PDF ─────────────────────────────────────────────────────────────────────
// Mirrors the on-screen report so a printed copy matches what was reviewed.

function buildReportPDF(jsPDF, d) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, M = 16, CW = W - M * 2;
  const c = d.current;
  let y = 0;

  // Header
  doc.setFillColor(35, 35, 37); doc.rect(0, 0, W, 30, "F");
  doc.setFillColor(204, 0, 0); doc.rect(0, 30, W, 2.5, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.setTextColor(255, 77, 77);
  doc.text("first", M, 15);
  const fw = doc.getTextWidth("first ");
  doc.setTextColor(255, 255, 255); doc.text("choice", M + fw, 15);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(142, 142, 150);
  doc.text("FACILITIES HUB", M, 21);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(142, 142, 150);
  doc.text(`${String(d.bounds.period).toUpperCase()} REPORT`, W - M, 13, { align: "right" });
  doc.setFontSize(12); doc.setTextColor(255, 255, 255);
  doc.text(d.bounds.label, W - M, 20, { align: "right" });
  y = 42;

  // Headlines
  doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(23, 23, 24);
  doc.text("The headline", M, y); y += 3;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(107, 114, 128);
  doc.text(`Compared against ${d.bounds.prevLabel}`, M, y + 3); y += 10;

  doc.setFontSize(9.5); doc.setTextColor(63, 63, 70);
  (d.headlines.length ? d.headlines : ["No work order activity was recorded this period."]).forEach((h) => {
    const lines = doc.splitTextToSize(h, CW - 6);
    doc.setFillColor(204, 0, 0); doc.circle(M + 1.4, y - 1.4, 0.9, "F");
    doc.text(lines, M + 5, y);
    y += lines.length * 4.6 + 3;
  });
  y += 5;

  // KPI grid
  const stale = (d.aging[2]?.count ?? 0) + (d.aging[3]?.count ?? 0);
  const kpis = [
    ["OPEN AT END", String(c.openAtEnd), `${c.opened} opened / ${c.closed} closed`],
    ["NET BACKLOG", `${c.netBacklog > 0 ? "+" : ""}${c.netBacklog}`, c.netBacklog > 0 ? "Falling behind" : c.netBacklog < 0 ? "Catching up" : "Holding steady"],
    ["AVG DAYS TO CLOSE", c.avgDaysToClose != null ? String(c.avgDaysToClose) : "-", c.medianDaysToClose != null ? `Median ${c.medianDaysToClose}` : "No closures"],
    ["RECORDED SPEND", fmtUsd(c.spend), `${c.closuresWithCost} of ${c.closed} costed`],
    ["AGED 30+ DAYS", String(stale), stale ? "See oldest below" : "Nothing stale"],
    ["SAFETY / EMERGENCY", String(c.emergencies + c.hazards), c.emergencies + c.hazards ? "Confirm closed" : "None raised"],
  ];
  const bw = (CW - 8) / 2, bh = 20;
  kpis.forEach((k, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = M + col * (bw + 8), yy = y + row * (bh + 5);
    doc.setDrawColor(231, 231, 234); doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, yy, bw, bh, 2, 2, "FD");
    doc.setFillColor(204, 0, 0); doc.rect(x, yy, 1.1, bh, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); doc.setTextColor(107, 114, 128);
    doc.text(k[0], x + 4, yy + 6);
    doc.setFontSize(14); doc.setTextColor(23, 23, 24);
    doc.text(k[1], x + 4, yy + 13.5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(140, 140, 150);
    doc.text(k[2], x + 4, yy + 17.5);
  });
  y += Math.ceil(kpis.length / 2) * (bh + 5) + 6;

  // Data gaps
  if (d.dataGaps.length) {
    doc.setFillColor(255, 251, 235); doc.setDrawColor(253, 230, 138);
    const gl = d.dataGaps.map((g) => doc.splitTextToSize(g, CW - 8)).flat();
    const gh = gl.length * 4.2 + 10;
    doc.roundedRect(M, y, CW, gh, 2, 2, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); doc.setTextColor(180, 83, 9);
    doc.text("WHAT THESE NUMBERS CANNOT TELL YOU", M + 4, y + 5.5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(120, 53, 15);
    doc.text(gl, M + 4, y + 10.5);
    y += gh + 7;
  }

  // Tables
  y = pdfTable(doc, y, M, CW, "OPEN BACKLOG BY AGE", ["Age", "Count"],
    d.aging.map((a) => [a.bucket, String(a.count)]));

  if (d.byGroup.length) {
    y = pdfTable(doc, y, M, CW, "BY ORGANIZATION", ["Organization", "Opened", "Closed", "Open", "Spend"],
      d.byGroup.map((g) => [g.name, String(g.opened), String(g.closed), String(g.openAtEnd), g.spend > 0 ? fmtUsd(g.spend) : "-"]));
  }
  if (d.byCategory.length) {
    y = pdfTable(doc, y, M, CW, "WHERE THE WORK IS", ["Category", "Opened", "Open", "Spend"],
      d.byCategory.slice(0, 6).map((g) => [g.name, String(g.opened), String(g.openAtEnd), g.spend > 0 ? fmtUsd(g.spend) : "-"]));
  }
  if (d.oldestOpen.length) {
    y = pdfTable(doc, y, M, CW, "OLDEST OPEN WORK ORDERS", ["Work order", "Location", "Age"],
      d.oldestOpen.map((o) => [o.workOrderId, o.location, `${o.ageDays}d`]));
  }

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(231, 231, 234); doc.line(M, 285, W - M, 285);
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(160, 160, 168);
    doc.text("First Choice Facilities Hub · Internal Use Only · Burroughs Restaurant Group", M, 290);
    doc.text(`Page ${p} of ${pages}`, W - M, 290, { align: "right" });
  }

  doc.save(`first-choice-${d.bounds.period}-${d.bounds.label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
}

function pdfTable(doc, y, M, CW, title, headers, rows) {
  if (y > 232) { doc.addPage(); y = 20; }
  doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(107, 114, 128);
  doc.text(title, M, y); y += 4;

  const n = headers.length;
  const firstW = CW * (n === 2 ? 0.72 : n === 3 ? 0.5 : 0.4);
  const restW = (CW - firstW) / (n - 1);
  const colX = (i) => (i === 0 ? M : M + firstW + (i - 1) * restW);

  doc.setFillColor(250, 250, 251); doc.rect(M, y, CW, 7, "F");
  doc.setFontSize(6.5); doc.setTextColor(107, 114, 128);
  headers.forEach((h, i) =>
    i === 0 ? doc.text(h, colX(i) + 3, y + 4.7) : doc.text(h, colX(i) + restW - 3, y + 4.7, { align: "right" })
  );
  y += 7;

  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  rows.forEach((r) => {
    if (y > 275) { doc.addPage(); y = 20; }
    doc.setDrawColor(238, 238, 241); doc.line(M, y, M + CW, y);
    r.forEach((cell, i) => {
      doc.setTextColor(i === 0 ? 23 : 63, i === 0 ? 23 : 63, i === 0 ? 24 : 70);
      const txt = String(cell);
      if (i === 0) {
        doc.text(doc.splitTextToSize(txt, firstW - 6)[0], colX(i) + 3, y + 5);
      } else {
        doc.text(txt, colX(i) + restW - 3, y + 5, { align: "right" });
      }
    });
    y += 7.5;
  });
  return y + 7;
}

function fmtUsd(v) {
  return (Number(v) || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}
