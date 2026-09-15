import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Storage-only Supabase client (service role). Private bucket `fc-work-orders`.
// Lazily created so importing this module at build time doesn't require env vars.
let _client: SupabaseClient | null = null;
function supabaseClient(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false } }
  );
  return _client;
}

const BUCKET = "fc-work-orders";
const SIGNED_TTL = 60 * 60 * 24 * 7; // 7 days

// Strip any data URI prefix. jsPDF emits "data:application/pdf;filename=generated.pdf;base64,..."
// which a "data:<type>;base64," pattern misses, so the whole string was decoded as garbage.
function decodeBase64(b64: string): Buffer {
  return Buffer.from(b64.replace(/^data:[^,]*,/, ""), "base64");
}

const MIN_PDF_BYTES = 1024;

/** Throw unless `buf` looks like a real PDF. Also used by scripts/backfill-pdfs. */
export function assertValidPdf(buf: Buffer, path: string): void {
  if (buf.length < MIN_PDF_BYTES || buf.subarray(0, 4).toString("latin1") !== "%PDF") {
    throw new Error(
      `refusing to upload invalid PDF to ${path}: ${buf.length} bytes, header ${JSON.stringify(buf.subarray(0, 4).toString("latin1"))}`
    );
  }
}

/** Upload a base64 string, return the storage path (key). */
export async function uploadBase64(
  path: string,
  b64: string,
  contentType: string
): Promise<string> {
  const buf = decodeBase64(b64);
  if (contentType === "application/pdf") assertValidPdf(buf, path);
  const { error } = await supabaseClient().storage
    .from(BUCKET)
    .upload(path, buf, { contentType, upsert: true });
  if (error) throw new Error(`storage upload failed: ${error.message}`);
  return path;
}

/**
 * Resolve a stored value to a viewable URL.
 * - empty -> ""
 * - already an http(s) URL (e.g. migrated Google Drive links) -> passthrough
 * - otherwise treat as a bucket key and sign it
 */
export async function signedUrl(value: string): Promise<string> {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const { data, error } = await supabaseClient().storage
    .from(BUCKET)
    .createSignedUrl(value, SIGNED_TTL);
  if (error) return "";
  return data?.signedUrl ?? "";
}

export async function signedUrls(values: string[]): Promise<string[]> {
  return Promise.all((values ?? []).filter(Boolean).map(signedUrl));
}
