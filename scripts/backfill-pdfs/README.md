# backfill-pdfs

One-off repair for the PDFs stored between 2026-06-09 and the fix in PR #8. In
that window `lib/storage.ts` did not strip the full jsPDF data URI prefix, so
every stored open and closure PDF landed as 20 bytes of garbage.

The rebuild is possible because nothing needed is lost: every field the PDFs
show is a column on `first_choice.work_orders`, and the photos were uploaded as
separate storage objects that decoded correctly.

It reuses `lib/workOrderPdf.mjs`, the same builder the app uses, and validates
with `assertValidPdf` from `lib/storage.ts`, the same guard uploads go through.

## Running

From the repo root, with `.env.local` present (needs `FC_DATABASE_URL`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`):

```bash
node scripts/backfill-pdfs/backfill-pdfs.mjs            # dry run: writes ./out only
node scripts/backfill-pdfs/backfill-pdfs.mjs --upload   # back up each file, then upload
node scripts/backfill-pdfs/backfill-pdfs.mjs --verify   # re-download and check
node scripts/backfill-pdfs/backfill-pdfs.mjs --orphans  # list PDFs with no work_orders row
```

`out/` is gitignored. The rebuilt PDFs hold customer data and this repo is public.

## Scope and safety

- Only touches stored PDFs referenced by a `work_orders` row whose bytes are
  under 1 KB or don't start with `%PDF`. Valid PDFs are skipped and logged.
- `--upload` copies each original to `backfill-backup/<original path>` in the
  same bucket before overwriting, and uploads with `cacheControl: 60` so a
  cached 20-byte response expires quickly.
- No database rows are read-modified-written. Storage keys don't change, so
  existing View PDF links start working on their own.
- Orphan PDFs (no matching row) are only listed, never deleted.

## What differs from the originals

The original PDFs stamped "Submitted At" / "Closed At" from the submitter's
device clock and time zone. Rebuilds use the stored `submitted_at` / `closed_at`
rendered in America/Chicago, so those lines can differ by seconds, or by hours
if a device was not on Central time. Everything else is rebuilt from the same
data the original was generated from.
