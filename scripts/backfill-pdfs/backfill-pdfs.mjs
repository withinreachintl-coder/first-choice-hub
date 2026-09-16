// One-off backfill: rebuild the open/closure PDFs that were stored broken.
//
// Between 2026-06-09 and the fix in PR #8, lib/storage.ts failed to strip the
// full jsPDF data URI prefix, so every stored PDF was 20 bytes of garbage. Every
// field those PDFs show still lives in first_choice.work_orders, and the photos
// are intact as separate storage objects, so the documents can be rebuilt.
//
// Usage (run from the repo root, needs .env.local):
//   node scripts/backfill-pdfs/backfill-pdfs.mjs            # dry run, writes ./out only
//   node scripts/backfill-pdfs/backfill-pdfs.mjs --upload   # back up, then upload
//   node scripts/backfill-pdfs/backfill-pdfs.mjs --verify   # re-download and check
//   node scripts/backfill-pdfs/backfill-pdfs.mjs --orphans  # list PDFs with no WO row
//
// Scope: stored PDFs referenced by a work_orders row whose bytes are under 1 KB
// or do not start with %PDF. Valid PDFs are left alone. No database rows change.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { buildPDF } from "../../lib/workOrderPdf.mjs";
import { assertValidPdf } from "../../lib/storage.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const OUT = path.join(HERE, "out");
const BUCKET = "fc-work-orders";
const BACKUP_PREFIX = "backfill-backup";
const TZ = "America/Chicago";

const MODE = process.argv.includes("--upload")
  ? "upload"
  : process.argv.includes("--verify")
    ? "verify"
    : process.argv.includes("--orphans")
      ? "orphans"
      : "dry-run";

// ─── env ─────────────────────────────────────────────────────────────────────
function loadEnv() {
  const txt = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
  const get = (k) => {
    const m = txt.match(new RegExp(`^${k}=(.*)$`, "m"));
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
  };
  const env = {
    db: get("FC_DATABASE_URL"),
    url: get("SUPABASE_URL"),
    key: get("SUPABASE_SERVICE_ROLE_KEY"),
  };
  for (const [k, v] of Object.entries(env)) if (!v) throw new Error(`missing ${k} in .env.local`);
  return env;
}

// ─── helpers ─────────────────────────────────────────────────────────────────
// The original PDFs stamped the submitter's device clock. Rebuilds use the
// stored timestamp rendered in Central, which is the same format.
const tsFmt = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric",
  hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ,
});
const fmtTs = (d) => (d ? tsFmt.format(new Date(d)) : "");

// timestamptz -> "YYYY-MM-DDTHH:MM" wall clock in Central, the shape buildPDF expects.
const localDT = (d) => {
  if (!d) return "";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(d)).map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};

const decode = (dataUri) => Buffer.from(String(dataUri).replace(/^data:[^,]*,/, ""), "base64");
const isBroken = (buf) => buf.length < 1024 || buf.subarray(0, 4).toString("latin1") !== "%PDF";

async function download(storage, key) {
  const { data, error } = await storage.from(BUCKET).download(key);
  if (error) throw new Error(`download ${key}: ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}

/**
 * Fetch through a fresh signed URL, which is how the app serves View PDF.
 * The plain download path can return a CDN copy cached under the old
 * max-age=3600, so verification has to bypass it.
 */
async function downloadFresh(storage, key) {
  const { data, error } = await storage.from(BUCKET).createSignedUrl(key, 60);
  if (error) throw new Error(`sign ${key}: ${error.message}`);
  const res = await fetch(`${data.signedUrl}&cb=${Date.now()}`, { cache: "no-store", headers: { "cache-control": "no-cache" } });
  if (!res.ok) throw new Error(`fetch ${key}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Photos are stored as separate objects; feed them back as data URLs. */
async function loadPhotos(storage, keys) {
  const out = [];
  for (const key of keys ?? []) {
    if (!key) continue;
    if (/^https?:\/\//i.test(key)) { out.push({ b64: key, note: "external url" }); continue; }
    const buf = await download(storage, key);
    out.push({ b64: `data:image/jpeg;base64,${buf.toString("base64")}` });
  }
  return out;
}

function openForm(r) {
  return {
    _type: "open",
    location: r.location ?? "",
    requesterName: r.requester_name ?? "",
    contactMethod: r.contact_method ?? "",
    category: r.category ?? "",
    description: r.description ?? "",
    priority: r.priority ?? "",
    safetyHazard: !!r.safety_hazard,
    bestTimeToAccess: r.best_time_to_access ?? "",
    timeSensitive: !!r.time_sensitive,
    neededByDate: r.needed_by_date ?? "",
    photos: [],
  };
}

function closeForm(r) {
  return {
    _type: "close",
    techName: r.tech_name ?? "",
    status: r.status ?? "",
    partsUsed: r.parts_used ?? "",
    completionNotes: r.completion_notes ?? "",
    timeIn: localDT(r.time_in),
    timeOut: localDT(r.time_out),
    completionPhotos: [],
  };
}

// ─── main ────────────────────────────────────────────────────────────────────
const env = loadEnv();
const db = new pg.Client({ connectionString: env.db, ssl: { rejectUnauthorized: false } });
const storage = createClient(env.url, env.key, { auth: { persistSession: false } }).storage;
await db.connect();

try {
  if (MODE === "orphans") {
    const { rows } = await db.query(`
      select o.name, (o.metadata->>'size')::int as size, o.created_at
        from storage.objects o
       where o.bucket_id = $1 and o.name like '%.pdf'
         and o.name not like '${BACKUP_PREFIX}/%'
         and split_part(o.name, '/', 1) not in (select work_order_id from first_choice.work_orders)
       order by o.name`, [BUCKET]);
    console.log(`orphan PDFs (no work_orders row): ${rows.length}`);
    for (const r of rows) console.log(`  ${r.name}  ${r.size} bytes  ${r.created_at.toISOString().slice(0, 19)}Z`);
    process.exit(0);
  }

  const { rows } = await db.query(`
    select work_order_id, 'open' as kind, pdf_url as key, submitted_at as ts,
           location, requester_name, contact_method, category, description, priority,
           safety_hazard, best_time_to_access, time_sensitive, needed_by_date::text as needed_by_date,
           photo_urls as photo_keys,
           null::text as tech_name, null::text as status, null::text as parts_used,
           null::text as completion_notes, null::timestamptz as time_in, null::timestamptz as time_out
      from first_choice.work_orders where coalesce(pdf_url,'') <> ''
    union all
    select work_order_id, 'close', closure_pdf_url, closed_at,
           location, requester_name, contact_method, category, description, priority,
           safety_hazard, best_time_to_access, time_sensitive, needed_by_date::text,
           completion_photo_urls,
           tech_name, status, parts_used, completion_notes, time_in, time_out
      from first_choice.work_orders where coalesce(closure_pdf_url,'') <> ''
    order by work_order_id, kind`);

  fs.mkdirSync(OUT, { recursive: true });
  const built = [];
  const skipped = [];
  const failures = [];
  const uploadSkips = [];

  for (const r of rows) {
    const label = `${r.work_order_id} ${r.kind}`;
    try {
      if (/^https?:\/\//i.test(r.key)) { skipped.push({ label, why: "external URL, not a bucket key" }); continue; }

      const current = await download(storage, r.key);
      if (!isBroken(current)) { skipped.push({ label, why: `already valid (${current.length} bytes)` }); continue; }

      const photos = await loadPhotos(storage, r.photo_keys);
      const form = r.kind === "open"
        ? { ...openForm(r), photos }
        : { ...closeForm(r), completionPhotos: photos };

      const buf = decode(await buildPDF(form, r.work_order_id, fmtTs(r.ts), false));
      assertValidPdf(buf, r.key); // same guard the app uploads behind

      const outPath = path.join(OUT, r.key.replace("/", "__"));
      fs.writeFileSync(outPath, buf);
      built.push({ label, key: r.key, bytes: buf.length, photos: photos.length, outPath });
    } catch (e) {
      failures.push({ label, key: r.key, reason: e.message });
    }
  }

  console.log(`\nmode: ${MODE}`);
  console.log(`candidates: ${rows.length} | built: ${built.length} | skipped: ${skipped.length} | failed: ${failures.length}`);
  console.log(`with photos: ${built.filter((b) => b.photos > 0).length} | out dir: ${OUT}`);
  for (const s of skipped) console.log(`  SKIP ${s.label}: ${s.why}`);
  for (const f of failures) console.log(`  FAIL ${f.label} (${f.key}): ${f.reason}`);
  fs.writeFileSync(path.join(OUT, "_manifest.json"), JSON.stringify({ built, skipped, failures }, null, 2));

  if (MODE === "dry-run") {
    console.log("\ndry run only — nothing uploaded. Re-run with --upload to publish.");
    process.exit(failures.length ? 1 : 0);
  }

  if (MODE === "upload") {
    if (failures.length) throw new Error(`refusing to upload: ${failures.length} build failure(s)`);
    let backed = 0, uploaded = 0;
    // One retry per file, then skip it and keep going. Skips are listed at the end.
    const putOnce = async (b) => {
      const original = await download(storage, b.key);
      const backupKey = `${BACKUP_PREFIX}/${b.key}`;
      const up = await storage.from(BUCKET).upload(backupKey, original, {
        contentType: "application/pdf", upsert: false,
      });
      if (up.error && !/exists|duplicate/i.test(up.error.message)) throw new Error(`backup: ${up.error.message}`);
      backed++;
      const res = await storage.from(BUCKET).upload(b.key, fs.readFileSync(b.outPath), {
        contentType: "application/pdf", upsert: true, cacheControl: "60",
      });
      if (res.error) throw new Error(`upload: ${res.error.message}`);
      uploaded++;
      console.log(`  ok ${b.key} (${b.bytes} bytes, backup ${backupKey})`);
    };
    for (const b of built) {
      try {
        await putOnce(b);
      } catch (first) {
        try {
          await putOnce(b);
          console.log(`  ok ${b.key} (after retry)`);
        } catch (second) {
          uploadSkips.push({ key: b.key, reason: `${first.message} | retry: ${second.message}` });
          console.log(`  SKIP ${b.key}: ${second.message}`);
        }
      }
    }
    console.log(`\nbacked up: ${backed} | uploaded: ${uploaded} | skipped: ${uploadSkips.length}`);
  }

  if (MODE === "verify" || MODE === "upload") {
    let ok = 0;
    const bad = [];
    // After a successful backfill nothing is left to rebuild, so verify every
    // referenced PDF, not just what this run touched.
    const targets = MODE === "verify"
      ? rows.filter((r) => !/^https?:\/\//i.test(r.key)).map((r) => ({ key: r.key }))
      : built;
    console.log(`\nverifying ${targets.length} stored PDFs through fresh signed URLs…`);
    for (const b of targets) {
      const buf = await downloadFresh(storage, b.key);
      if (isBroken(buf)) bad.push(`${b.key}: ${buf.length} bytes, header ${JSON.stringify(buf.subarray(0, 4).toString("latin1"))}`);
      else ok++;
    }
    console.log(`\nverify: ${ok} valid, ${bad.length} bad`);
    for (const x of bad) console.log(`  BAD ${x}`);
    for (const s of uploadSkips) console.log(`  SKIPPED ${s.key}: ${s.reason}`);
    process.exit(bad.length || uploadSkips.length ? 1 : 0);
  }
} finally {
  await db.end();
}
