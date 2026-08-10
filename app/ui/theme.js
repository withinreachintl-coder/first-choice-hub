"use client";
// ─────────────────────────────────────────────────────────────────────────────
// First Choice Facilities Hub — design system
//
// Single source of truth for color, type, spacing, elevation, and iconography.
// Brand red (#CC0000) and charcoal (#2d2d2d) are unchanged from the original
// app; everything around them was rebuilt on an 8pt grid with a real type
// scale so the UI reads as a product rather than a form.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Color ───────────────────────────────────────────────────────────────────
export const C = {
  // Brand — unchanged
  red: "#CC0000",
  redDark: "#A30000",
  redSoft: "#FFF1F1",
  redRing: "rgba(204,0,0,0.16)",
  charcoal: "#2D2D2D",

  // Ink scale
  ink: "#171718",
  ink2: "#3F3F46",
  ink3: "#6B7280",
  ink4: "#9CA3AF",

  // Surface
  bg: "#F6F6F7",
  surface: "#FFFFFF",
  surfaceAlt: "#FAFAFB",
  header: "#232325",
  headerAlt: "#1A1A1C",

  // Hairlines
  line: "#E7E7EA",
  lineStrong: "#D6D6DB",

  // Semantic
  blue: "#2563EB",
  blueSoft: "#EFF6FF",
  green: "#15803D",
  greenSoft: "#F0FDF4",
  amber: "#B45309",
  amberSoft: "#FFFBEB",
  crimson: "#7F1D1D",
  crimsonSoft: "#FEF2F2",
};

// ─── Spacing (8pt grid, 4 allowed for optical nudges) ────────────────────────
export const SP = { xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24, xxl: 32, xxxl: 40 };

// ─── Radius ──────────────────────────────────────────────────────────────────
export const R = { sm: 8, md: 12, lg: 16, pill: 999 };

// ─── Elevation — soft and low, never heavy ───────────────────────────────────
export const EL = {
  none: "none",
  sm: "0 1px 2px rgba(16,16,20,0.05)",
  md: "0 2px 8px rgba(16,16,20,0.06), 0 1px 2px rgba(16,16,20,0.04)",
  lg: "0 8px 28px rgba(16,16,20,0.10)",
};

// ─── Type ────────────────────────────────────────────────────────────────────
export const FONT =
  "'Inter','Segoe UI',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif";
export const MONO =
  "'SF Mono',ui-monospace,'Cascadia Mono','Roboto Mono',Menlo,Consolas,monospace";

// Numbers always align in columns.
export const NUM = { fontVariantNumeric: "tabular-nums" };

export const TYPE = {
  display: { fontSize: 30, fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.12 },
  title: { fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 },
  section: { fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.3 },
  body: { fontSize: 15, fontWeight: 400, lineHeight: 1.55 },
  bodyStrong: { fontSize: 15, fontWeight: 600, lineHeight: 1.45 },
  small: { fontSize: 13, fontWeight: 400, lineHeight: 1.45 },
  smallStrong: { fontSize: 13, fontWeight: 600, lineHeight: 1.4 },
  micro: { fontSize: 11, fontWeight: 600, lineHeight: 1.35 },
  eyebrow: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.09em",
    textTransform: "uppercase",
    lineHeight: 1.2,
  },
};

// ─── Icons ───────────────────────────────────────────────────────────────────
// Inline stroke icons on a 24x24 grid. Replaces every emoji in the chrome so
// the UI renders identically across iOS, Android, and Windows.
const PATHS = {
  gauge: "M12 13.5 16 9M3.5 19a9 9 0 1 1 17 0",
  wrench:
    "M14.7 6.3a4 4 0 0 0 5 5l-9.9 9.9a2.1 2.1 0 0 1-3-3l9.9-9.9a4 4 0 0 0-5-5l2.8 2.8-2.1 2.1L9.7 5.5a4 4 0 0 1 5-5Z",
  check: "M20 6 9 17l-5-5",
  checkCircle: "M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  car: "M5 17h14M5 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm18 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM3 17v-4l2-5h14l2 5v4",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Zm2 14h13",
  camera:
    "M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Zm8 3a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z",
  refresh: "M21 12a9 9 0 1 1-3-6.7M21 4v5h-5",
  download: "M12 4v11m0 0 4-4m-4 4-4-4M4 20h16",
  alert: "M12 9v4m0 3h.01M10.3 4.3 2.5 18a1.5 1.5 0 0 0 1.3 2.3h16.4a1.5 1.5 0 0 0 1.3-2.3L13.7 4.3a1.5 1.5 0 0 0-2.6 0Z",
  calendar: "M8 3v3m8-3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z",
  chevronDown: "m6 9 6 6 6-6",
  chevronUp: "m18 15-6-6-6 6",
  chevronRight: "m9 6 6 6-6 6",
  close: "M6 6l12 12M18 6 6 18",
  search: "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.35-4.35",
  doc: "M14 3v5h5M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8l-4-5Z",
  mail: "M3 7l9 6 9-6M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
  clock: "M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  dollar: "M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.6 7 6.5s2 2.8 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3",
  building: "M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 10h4a1 1 0 0 1 1 1v10M8 8h3M8 12h3M8 16h3M4 21h17",
  trendUp: "M22 7 13.5 15.5l-4-4L2 19M16 7h6v6",
  trendDown: "M22 17 13.5 8.5l-4 4L2 5M16 17h6v-6",
  minus: "M5 12h14",
  filter: "M3 5h18l-7 8v6l-4 2v-8L3 5Z",
  plus: "M12 5v14M5 12h14",
  arrowLeft: "M19 12H5m0 0 6-6m-6 6 6 6",
  users: "M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20M9 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm13 9.5v-1.5a4 4 0 0 0-3-3.9M16 3.6a4 4 0 0 1 0 7.8",
};

export function Icon({ name, size = 18, color = "currentColor", strokeWidth = 1.75, style }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", flexShrink: 0, ...style }}
    >
      <path d={d} />
    </svg>
  );
}

// ─── Primitives ──────────────────────────────────────────────────────────────

export function Card({ children, pad = SP.base, style, ...rest }) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.line}`,
        borderRadius: R.md,
        boxShadow: EL.sm,
        padding: pad,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Eyebrow({ children, color = C.ink3, style }) {
  return <div style={{ ...TYPE.eyebrow, color, ...style }}>{children}</div>;
}

/**
 * KPI tile. Accent is a thin left rail rather than a filled pastel block —
 * keeps the numbers, not the background, as the loudest thing on screen.
 */
export function Kpi({ label, value, accent = C.charcoal, sub, delta, icon }) {
  const dir = delta == null ? null : delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const dColor = dir === "up" ? C.green : dir === "down" ? C.red : C.ink4;
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.line}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: R.md,
        boxShadow: EL.sm,
        padding: `${SP.md}px ${SP.base}px`,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        {icon && <Icon name={icon} size={13} color={C.ink4} />}
        <div
          style={{
            ...TYPE.eyebrow,
            color: C.ink3,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <div
          style={{
            fontSize: 27,
            fontWeight: 800,
            color: accent,
            lineHeight: 1,
            letterSpacing: "-0.03em",
            ...NUM,
          }}
        >
          {value}
        </div>
        {dir && (
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: 2, ...TYPE.micro, color: dColor, ...NUM }}
          >
            <Icon
              name={dir === "up" ? "trendUp" : dir === "down" ? "trendDown" : "minus"}
              size={12}
              color={dColor}
            />
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      {sub && <div style={{ ...TYPE.micro, fontWeight: 500, color: C.ink3, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

/** Rounded status/priority chip. */
export function Chip({ children, color = C.ink3, bg = C.surfaceAlt, border, style }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: R.pill,
        background: bg,
        color,
        border: `1px solid ${border || "transparent"}`,
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
        lineHeight: 1.4,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** A small colored dot — used instead of emoji for priority. */
export function Dot({ color, size = 8, ring }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        boxShadow: ring ? `0 0 0 3px ${ring}` : "none",
        flexShrink: 0,
        display: "inline-block",
      }}
    />
  );
}

/** Horizontal proportional bar built from [{value,color,label}] segments. */
export function StackBar({ segments, height = 8, gap = 3 }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div style={{ display: "flex", gap, width: "100%" }}>
      {segments
        .filter((x) => x.value > 0)
        .map((x, i) => (
          <div
            key={i}
            title={`${x.label}: ${x.value}`}
            style={{
              flexGrow: x.value / total,
              flexBasis: 0,
              minWidth: 6,
              height,
              borderRadius: R.pill,
              background: x.color,
              transition: "flex-grow 0.45s ease",
            }}
          />
        ))}
    </div>
  );
}

/** Empty state used across tabs. */
export function EmptyState({ icon = "doc", title, body }) {
  return (
    <div style={{ textAlign: "center", padding: `${SP.xxxl}px ${SP.lg}px` }}>
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: R.md,
          background: C.surfaceAlt,
          border: `1px solid ${C.line}`,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: SP.md,
        }}
      >
        <Icon name={icon} size={21} color={C.ink4} />
      </div>
      <div style={{ ...TYPE.bodyStrong, color: C.ink, marginBottom: 4 }}>{title}</div>
      {body && <div style={{ ...TYPE.small, color: C.ink3, maxWidth: 320, margin: "0 auto" }}>{body}</div>}
    </div>
  );
}

export const usd = (n) =>
  (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export const usd0 = (n) =>
  (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
