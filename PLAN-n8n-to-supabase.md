# PLAN — Move first-choice-hub off n8n → Supabase + Next route handlers

**Status:** Proposed (awaiting approval). No provisioning or code written yet.
**Date:** 2026-06-09
**Trigger:** Recurring `HTTP 500` on the dashboard. Root cause below.

---

## 1. Context & root cause

The app (`app/components/FirstChoiceFacilitiesHub.jsx`, 1359 lines, `"use client"`) is
**client-only** — no API routes, no server code. All three data operations POST/GET to
**n8n webhooks** whose URLs are stored client-side (`cfg.webhookOpen/webhookClose/dashboardUrl`,
defaulting to `NEXT_PUBLIC_WEBHOOK_*` env vars).

| Operation | n8n workflow | What it does |
|---|---|---|
| Dashboard load (GET) | `fc-dashboard` | Google Sheets **read** of tab `All` → map → return JSON array |
| Open work order (POST) | `fc-open-wo` | Drive upload (PDF+photos) + Sheets append + email + Slack |
| Close work order (POST) | `fc-close-wo` | Drive upload + Sheets update + email |

**The 500 happened on dashboard load.** `fc-dashboard`'s `Get All Work Orders` Google Sheets
node failed (expired OAuth token / n8n instance asleep / Google quota) and threw before the
`respondToWebhook` node ran, so the client received a raw `HTTP 500`. The client surfaces it
verbatim (`app/components/FirstChoiceFacilitiesHub.jsx:607`, line ~720 for dashboard fetch).

### Why it recurs
The most-used read path depends on a fragile **external orchestrator**. n8n inserts three
independent failure points in front of the data: (1) n8n instance up, (2) its Google OAuth
token still valid, (3) Google quota. Any one failing = 500. The app also surfaces the raw
status instead of degrading.

---

## 2. Goal

Remove n8n entirely from first-choice-hub. Data + logic move into the app's own Next.js
route handlers backed by Supabase (suite standard — every other WRI app uses Supabase).
Make the dashboard degrade gracefully instead of showing a dead error screen.

**Success criteria**
1. Dashboard, open-WO, and close-WO work with **zero** n8n / Google Sheets / Google Drive dependency.
2. Dashboard never shows a raw 500 — on fetch failure it shows last-good cached data + a banner.
3. Existing work orders from the Google Sheet are migrated into Supabase.
4. `npm run build` clean; live client app verified after deploy.

---

## 3. Architecture: before → after

```
BEFORE:  client  ──fetch──▶  n8n webhook  ──▶  Google Sheets + Google Drive + email + Slack
AFTER:   client  ──fetch──▶  /api/work-orders (Next route)  ──▶  Supabase (Postgres + Storage) + Resend + Slack
```

| Now (n8n) | After (Next route handler) |
|---|---|
| `fc-dashboard` GET | `GET /api/work-orders` |
| `fc-open-wo` POST | `POST /api/work-orders` |
| `fc-close-wo` POST | `POST /api/work-orders/[id]/close` |
| Google Sheets store | Supabase table `work_orders` |
| Google Drive (PDF/photos) | Supabase Storage bucket `fc-work-orders` |
| n8n email / Slack | Resend + direct Slack incoming webhook (from the route) |

---

## 4. Provisioning (billable — needs explicit OK)

- **New Supabase project** `first-choice-hub`, region `us-east-2` (matches majority of suite).
  Org `hmrssjwmqlikmoguvejk`. (No existing FC project — each WRI app has its own.)
- **Storage bucket** `fc-work-orders`, private. Route handlers upload via service-role; the
  dashboard reads asset links via **signed URLs** generated server-side in the GET handler
  (facility photos — keep them non-public).
- **RLS:** enabled on `work_orders`, **anon + authenticated denied**. Only the service-role key
  (server routes) reads/writes. The app has no end-user auth, so the API routes are the gate.
  Never expose the service-role key to the client.

---

## 5. Schema — `work_orders`

Mirrors the `fc-dashboard` headerMap exactly so the GET response shape is unchanged.

```sql
create table public.work_orders (
  id                     uuid primary key default gen_random_uuid(),
  work_order_id          text unique not null,          -- FCF-250601-4827
  form_type              text,
  submitted_at           timestamptz,
  location               text,
  location_group         text,
  location_sub           text,
  requester_name         text,
  contact_method         text,
  category               text,
  description            text,
  priority               text,                          -- low|medium|high|emergency
  safety_hazard          boolean default false,
  is_emergency           boolean default false,
  best_time_to_access    text,
  time_sensitive         boolean default false,
  needed_by_date         date,
  photo_count            int  default 0,
  photo_urls             text[] default '{}',
  pdf_url                text,
  status                 text default 'open',            -- open|closed (+ any close-form statuses)
  tech_name              text,
  closed_at              timestamptz,
  completion_notes       text,
  parts_used             text,
  completion_photo_count int  default 0,
  completion_photo_urls  text[] default '{}',
  closure_pdf_url        text,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);

alter table public.work_orders enable row level security;
-- no policies for anon/authenticated → only service_role bypasses RLS

create index work_orders_status_idx       on public.work_orders (status);
create index work_orders_submitted_at_idx on public.work_orders (submitted_at desc);
```

`updated_at`: per-table `set_updated_at()` trigger (suite convention — no shared helper;
ref [[project_wri_suite_supabase_conventions]]).

---

## 6. Route handlers (new server code)

All use `@supabase/supabase-js` with the service-role key, `export const runtime = 'nodejs'`.

### `app/api/work-orders/route.ts`
- **GET** — `select *` ordered by `submitted_at desc`. Map snake_case → the camelCase keys the
  dashboard already consumes (`workOrderId`, `locationSub`, `techName`, …). Generate signed
  URLs for `photo_urls`/`pdf_url` on the way out. Return the bare array (same as old webhook).
- **POST** (open WO) — accept the existing open payload. Decode `pdfBase64` + `photos[].photo`
  (base64) → upload to `fc-work-orders/<workOrderId>/...` → insert row with the resulting paths
  → Resend notification email to `FC_NOTIFY_EMAILS` → if `isEmergency`, POST to `SLACK_WEBHOOK_URL`.
  Respond `{ status: 'received', workOrderId }`.

### `app/api/work-orders/[id]/close/route.ts`
- **POST** (close WO) — accept the existing close payload. Upload completion photos + closure PDF,
  `update` the row by `work_order_id` to `status`, `tech_name`, `closed_at`, `completion_notes`,
  `parts_used`, completion asset paths. Respond `{ status: 'closed', workOrderId }`.

**Error handling:** wrap each handler in try/catch; log server-side; return JSON `{ error }`
with a real status. POST failures still surface to the user (they need to know a WO didn't save),
but the GET/dashboard path is protected client-side (next section).

---

## 7. Client edits (surgical — `FirstChoiceFacilitiesHub.jsx`)

1. Repoint the 3 fetches:
   - open: `fetch(cfg.webhookOpen, …)` → `fetch('/api/work-orders', {method:'POST', …})`
   - close: `fetch(cfg.webhookClose, …)` → `fetch('/api/work-orders/'+id+'/close', {method:'POST', …})`
   - dashboard: `fetch(cfg.dashboardUrl)` → `fetch('/api/work-orders')`  (two call sites: ~720, ~969)
2. **Dashboard graceful degradation:** on success, cache the array to
   `localStorage['fc-dashboard-cache']`; on fetch failure, fall back to the cache and show a
   non-blocking banner ("Couldn't refresh — showing last loaded data"). Never a dead 500 screen.
3. Remove the Settings webhook URL fields (`webhookOpen/webhookClose/dashboardUrl`, lines ~399–406,
   ~1228–1248) — now dead. Keep Settings panel only if other config remains; otherwise drop the gear.
4. Remove `NEXT_PUBLIC_WEBHOOK_*` defaults.

---

## 8. Env vars

Local `.env.local` + Vercel project `first-choice-hub` (prod + preview):

| Var | Purpose |
|---|---|
| `SUPABASE_URL` | new project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only; route handlers |
| `RESEND_API_KEY` | notification emails (suite uses Resend) |
| `FC_NOTIFY_EMAILS` | comma-list: maintenance tech + supervisor |
| `SLACK_WEBHOOK_URL` | emergency alerts |

Add `@supabase/supabase-js` and `resend` to `dependencies`.

---

## 9. Data migration (existing sheet rows → Supabase)

Confirmed: migrate existing rows. I don't have Google creds in this environment.

1. You export the Google Sheet (`1HRZvsz-rjpItXbZVeG1wFDWr1mlGzKvSttwgGrgEf3I`) tab **`All`**
   as CSV and provide it.
2. I write a one-off import script mapping the sheet headers (same headerMap as `fc-dashboard`)
   → `work_orders` columns, dedup on `work_order_id`, and bulk-insert via service-role.
3. Existing Drive photo/PDF URLs: keep the original Drive links in `pdf_url`/`photo_urls` for
   migrated rows (don't re-host historical assets); only **new** WOs use Supabase Storage.
   (Flag: if Drive links die later, historical assets are lost — acceptable for archive rows.)

---

## 10. Deploy & rollback

- **Deploy:** push to `withinreachintl-coder/first-choice-hub` `master` → Vercel auto-deploys the
  **live client app**. Confirm before pushing. Verify the dashboard + a test open/close on the
  preview URL first; visual confirmation is the owner's, not an HTTP-200 ([[feedback_smoke_test_verification]]).
- **Rollback:** Vercel "Promote previous deployment" (current prod = `dpl_3o6F8Y…`). The n8n
  workflows stay intact until cutover is verified, so reverting the env/URLs restores the old path.
- After squash-merge, delete the feature branch on origin ([[feedback_delete_merged_branches]]).

---

## 11. Prevention (the "stop this recurring" answer)

1. **No external orchestrator in the data path** — first-party Next routes + Supabase. (this plan)
2. **Graceful degradation** on the dashboard read — cache + banner. (section 7)
3. **Uptime check** on `GET /api/work-orders` (e.g. a simple monitor) so failures are caught
   before users report them.
4. This becomes the **template** for removing n8n from the rest of the suite (digital-empire's
   post-purchase/social flows next).

---

## 12. Build checklist

- [ ] Approve provisioning (Supabase project = billable)
- [ ] Create Supabase project + bucket + table + trigger + indexes
- [ ] Add deps (`@supabase/supabase-js`, `resend`)
- [ ] `app/api/work-orders/route.ts` (GET + POST)
- [ ] `app/api/work-orders/[id]/close/route.ts` (POST)
- [ ] Repoint 3 client fetches + dashboard cache/banner + remove webhook Settings
- [ ] Env vars in Vercel (prod + preview) + local
- [ ] Receive CSV export → import script → migrate rows
- [ ] `npm run build` clean
- [ ] Preview deploy → owner visual verification
- [ ] Push master → verify prod → delete branch → archive/disable n8n workflows
