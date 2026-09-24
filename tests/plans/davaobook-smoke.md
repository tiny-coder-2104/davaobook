# Smoke test plan — DavaoBook demo (SeaClouds Mountain View Resort)

Full-system, one pass. Run order: Setup → Landing → Redirects → Packages → Booking (API) → Booking (browser) → Tracking → Voucher → Admin → Security → PWA → Cron → Edge → Cleanup. All checks runnable by tester (bash + curl + navigator). Fake PII only.

```
U=https://davaotours-booking.vercel.app
ENVFILE=${ENVFILE:?set to the Supabase env file path}
source $ENVFILE   # provides SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY
TS=$(date +%s)
EMAIL=qa.$TS@example.com
```

Verified facts (qa recon 2026-09-24, read-only — plan expectations are based on these):
- Root `/` → 307 → `/seaclouds` (live operator slug is `seaclouds`, NOT the seed slug `seaclouds-mountain-view-resort`; both return 200 — two operators exist).
- SeaClouds operator id: `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11` (public via RLS).
- Live package ids (match seed): standard-room `12cb688a-ac00-4c8b-bb55-4545ac7d1de1` (cap 5), family-cabin `657de57b-36da-4250-aa17-57983ec98cd4` (cap 3), mountain-view-suite `08a2a206-e396-4d1a-b107-f0ca96ed3600` (cap 2).
- No blocks exist in live DB → blocked-date check is N/A (conditional).
- Old tour slugs (pre-SeaClouds): `samal-island-tours`, `island-hopping`, `sunset-cruise`, `mangrove-tour` → all 404.

## 0. Setup
- 0.1 Fetch package ids/capacities for the record: `curl -s "$SUPABASE_URL/rest/v1/packages?select=id,slug,capacity_per_day,tiers&operator_id=eq.a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" -H "apikey: $SUPABASE_PUBLISHABLE_KEY"` → 3 rows, capacities 5/3/2. Record ids for checks 4.x.
- 0.2 Pick a future test date: `TODAY=$(date +%F); TEST_DATE=$(date -d "+10 days" +%F)` → record. (Avoid dates that collide with other test bookings — +10 days is safe.)

## 1. Landing /seaclouds
- 1.1 `curl -s -o /dev/null -w "%{http_code}" $U/seaclouds` → 200.
- 1.2 `curl -s $U/seaclouds | grep -c "SeaClouds Mountain View Resort"` → ≥1 (branding in TrustStrip).
- 1.3 Room cards: `curl -s $U/seaclouds | grep -oE "Standard Room|Family Cabin|Mountain View Suite" | sort -u` → exactly those 3 names.
- 1.4 Prices: `curl -s $U/seaclouds | grep -oE "₱1,500|₱2,500|₱3,500" | sort -u` → all 3 present (from-price per card).
- 1.5 Per-night labels: `curl -s $U/seaclouds | grep -o "/night" | wc -l` → ≥3.
- 1.6 CTAs: `curl -s $U/seaclouds | grep -o "Check Availability" | wc -l` → 3.
- 1.7 Footer: `curl -s $U/seaclouds | grep -oE "Track my booking|This is a live demo|Create Operator Account|Powered by DavaoBook|Built by TinyCoder Studio" | sort -u` → all 5 present; "Track my booking" href = `/track`; "Built by TinyCoder Studio" href = `https://welcome-tinycoder-studio.vercel.app`.
- 1.8 Browser (navigator): load `$U/seaclouds` at 1280×800 → 0 console errors, no text/pill overlap in header or footer (screenshot `logs/navigator/YYYY-MM-DD-landing/`).

## 2. Root redirect + 404s
- 2.1 `curl -s -o /dev/null -w "%{http_code} %{redirect_url}" $U/` → `307 https://davaotours-booking.vercel.app/seaclouds`.
- 2.2 `curl -s -o /dev/null -w "%{http_code}" $U/not-a-real-slug` → 404.
- 2.3 Old tour slugs: `for s in samal-island-tours island-hopping sunset-cruise mangrove-tour; do curl -s -o /dev/null -w "$s:%{http_code} "; done` → 404 ×4.

## 3. Package pages
- 3.1 `curl -s $U/p/standard-room | grep -oE "Price / night|guests|₱1,500|₱1,800|Check availability" | sort | uniq -c` → "Price / night" header, "guests" column, both tier prices, CTA. (Tiers: 1–2 guests ₱1,500, 3–4 guests ₱1,800.)
- 3.2 `curl -s $U/p/family-cabin | grep -oE "₱2,500|₱3,000" | sort -u` → both (tiers 1–4 ₱2,500 / 5–6 ₱3,000).
- 3.3 `curl -s $U/p/mountain-view-suite | grep -oE "₱3,500|₱4,000" | sort -u` → both (tiers 1–2 ₱3,500 / 3–4 ₱4,000).
- 3.4 `curl -s -o /dev/null -w "%{http_code}" $U/p/standard-room/book` → 200 (booking flow page renders).
- 3.5 `curl -s -o /dev/null -w "%{http_code}" $U/p/standard-room/book` browser: flow renders picker (calendar + guest stepper), no JS errors.

## 4. Booking flow — critical path
### 4A. API (deterministic, curl)
- 4.1 Create: `curl -s -w "\n%{http_code}" -X POST $U/api/bookings -H 'Content-Type: application/json' -d '{"package_id":"12cb688a-ac00-4c8b-bb55-4545ac7d1de1","tour_date":"'$TEST_DATE'","pax":2,"guest_name":"QA Test Guest","guest_mobile":"09170000000","guest_email":"'$EMAIL'","guest_pickup_area":"Test Area","guest_notes":"smoke test"}'` → 201, JSON has `code` (pattern `STAND-<MMDD>-QAT`), `status:"PENDING_CONFIRMATION"`, `total_amount:1500`. Capture `CODE1`.
- 4.2 Server-side verify (secret key): `curl -s "$SUPABASE_URL/rest/v1/bookings?select=code,status,total_amount,pax,tour_date&code=eq.$CODE1" -H "apikey: $SUPABASE_SECRET_KEY" -H "Authorization: Bearer $SUPABASE_SECRET_KEY"` → 1 row, `status=PENDING_CONFIRMATION`, `total_amount=1500`, `pax=2`. **Flat pricing proof: 2 guests = ₱1,500, NOT ₱3,000.**
- 4.3 Missing fields: `curl -s -w "\n%{http_code}" -X POST $U/api/bookings -H 'Content-Type: application/json' -d '{}'` → 400 `Missing required fields: package_id, tour_date, pax, guest_name, guest_mobile, guest_pickup_area`.
- 4.4 Invalid pax: `for p in 0 -1 1.5; do curl -s -o /dev/null -w "$p:%{http_code} " -X POST $U/api/bookings -H 'Content-Type: application/json' -d '{"package_id":"12cb688a-ac00-4c8b-bb55-4545ac7d1de1","tour_date":"'$TEST_DATE'","pax":'$p',"guest_name":"QA","guest_mobile":"09170000000","guest_pickup_area":"x"}'; done` → 400 ×3 (`pax must be a positive integer`).
- 4.5 Past date: `curl -s -w "\n%{http_code}" -X POST $U/api/bookings -H 'Content-Type: application/json' -d '{"package_id":"12cb688a-ac00-4c8b-bb55-4545ac7d1de1","tour_date":"'$(date -d "-1 day" +%F)'","pax":1,"guest_name":"QA","guest_mobile":"09170000000","guest_pickup_area":"x"}'` → 400 `Cannot book a date in the past`.
- 4.6 Pax beyond tier: `curl -s -w "\n%{http_code}" -X POST $U/api/bookings -H 'Content-Type: application/json' -d '{"package_id":"12cb688a-ac00-4c8b-bb55-4545ac7d1de1","tour_date":"'$TEST_DATE'","pax":5,"guest_name":"QA","guest_mobile":"09170000000","guest_pickup_area":"x"}'` → 400 `No pricing tier matches the pax count` (standard-room max tier = 4).
- 4.7 Capacity (duplicate date/room): family-cabin cap 3. `D2=$(date -d "+11 days" +%F)`; book pax=3 twice on D2 → first 201, second → **409 `No capacity available for this date`** (3+3 > 3). Capture `CODE2` from the first.
- 4.8 Blocked date: no blocks in live DB (verified) → **N/A**. Conditional: if a `blocks` row exists (`curl -s "$SUPABASE_URL/rest/v1/blocks?select=date,package_id" -H "apikey: $SUPABASE_PUBLISHABLE_KEY"` non-empty), book that date → expect 409 `Date is blocked by the operator`. Code path exists (DATE_BLOCKED in DB fn).

### 4B. Browser (navigator, prod — creates one disposable booking)
- 4.9 Full flow: `$U/p/standard-room/book` → pick first selectable date (green "Available" or yellow "Few left" cell; past/full/closed cells are disabled) → set guests to 2 → sticky bar shows **₱1,500 for 2 guests** → Continue → details: Full Name `QA Test Guest`, Mobile `09170000000`, Email `$EMAIL`, Pickup Area `Test Area` → Continue → confirm step.
- 4.10 **NO payment step**: at every step (picker, details, confirm) assert zero payment UI — no GCash, no "Pay", no amount-due, no payment method fields. (Booking = request; owner confirms + handles payment offline.)
- 4.11 Confirm step total: assert **₱1,500** (flat tier price for 2 guests — NOT ₱3,000).
- 4.12 Submit → success screen: heading **"Request received!"**, booking code shown (capture `CODE3`), "Slot held until" line, "View booking status →" link.
- 4.13 Server-side verify CODE3: same REST read as 4.2 → `status=PENDING_CONFIRMATION`, `total_amount=1500`.
- Evidence: screenshots at each step → `logs/navigator/YYYY-MM-DD-booking-flow/`.

## 5. Tracking
- 5.1 `curl -s -o /dev/null -w "%{http_code}" $U/track` → 200; page has input + Track button (browser: placeholder `e.g. STAND-0826-JUAN or you@email.com`).
- 5.2 Browser: enter `$CODE1` in /track → lands on `/b/$CODE1` (code contains `-` → direct route).
- 5.3 Browser: enter `$EMAIL` in /track → list of bookings (one card: code, friendly status, package, date, guests, total).
- 5.4 `curl -s -w "\n%{http_code}" "$U/api/track?email=$EMAIL"` → 200, array; each item has **exactly 6 keys**: `code, status, tour_date, package_name, pax, total_amount`. Assert no `email`, `guest_name`, `mobile`, `pickup_area`, `notes` keys.
- 5.5 `curl -s -w "\n%{http_code}" "$U/api/track"` → 400 `{"error":"Email is required"}`.
- 5.6 `curl -s $U/b/$CODE1 | grep -oE "Awaiting confirmation|Booking status|Booking code" | sort -u` → all 3 (friendly label for PENDING_CONFIRMATION). Browser: status card shows Room/Stay date/Guests/Total + code.
- 5.7 **No PII on /b/[code]**: `curl -s $U/b/$CODE1 | grep -cE "09170000000|$EMAIL|QA Test Guest"` → 0.
- 5.8 `curl -s -o /dev/null -w "%{http_code}" $U/b/NONEXISTENT` → 404.
- 5.9 Browser: garbage input in /track (e.g. `!!!`) → friendly empty state ("No bookings found for that email"), no crash/error.

## 6. Voucher
- 6.1 `curl -s -o /dev/null -w "%{http_code}" $U/v/$CODE1` → 200. Browser: voucher renders — guest name, code, package, date, total, **operator contact (SeaClouds phone/email)**. (Voucher is the guest's own doc; code is the secret — PII here is by design.)
- 6.2 `curl -s -o /dev/null -w "%{http_code}" $U/v/NONEXISTENT` → 404.

## 7. Admin
- 7.1 `curl -s -o /dev/null -w "%{http_code} %{redirect_url}" $U/admin/today` → `307 https://davaotours-booking.vercel.app/auth/login` (no session → login wall).
- 7.2 `curl -s -o /dev/null -w "%{http_code}" $U/auth/login` → 200. Browser: login wall renders email/password form (no lead/booking data visible).
- 7.3 `curl -s -w "\n%{http_code}" $U/api/admin/bookings` (no x-operator-id) → 401 `{"error":"Unauthorized"}`.
- 7.4 Wrong-operator scoping (no mutation): `curl -s -w "\n%{http_code}" -X PATCH $U/api/admin/bookings/$BOOKING_ID -H 'Content-Type: application/json' -H 'x-operator-id: 00000000-0000-0000-0000-000000000000' -d '{"action":"confirm"}'` → 403 `Unauthorized` (booking's package operator_id ≠ header). Use CODE1's id from 4.2 read.
- 7.5 Confirm flow PENDING_CONFIRMATION → CONFIRMED — **BLOCKED-by-design**: requires operator credentials (email/password) we don't have. Verify only the wall (7.1–7.2) + API auth (7.3–7.4). Code path exists: PATCH /api/admin/bookings/[id] `action=confirm` → CONFIRMED + notify_log + SMS.
- 7.6 Forged x-operator-id — **currently FAILING, davaobook-0013 open (critical)**: `curl -s "$U/api/admin/bookings?limit=2" -H "x-operator-id: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"` → today returns 200 + bookings with full PII (guest_name/mobile/email/notes/gcash_ref). After dev-worker fixes 0013, re-run this exact command → expect 401/403. Do NOT re-file; verify against the ticket's repro.

## 8. Security
- 8.1 Secret key in client bundle: `for u in $(curl -s $U/seaclouds | grep -oE '/_next/static/[^"]+\.js' | sort -u); do curl -s $U$u; done; curl -s $U/sw.js; curl -s $U/manifest.json` | `grep -c "$SUPABASE_SECRET_KEY"` → **0**. Repeat for pages `track`, `p/standard-room/book`, `auth/login` (fetch their chunks too).
- 8.2 Env-var-name grep: same bundle dump | `grep -cE 'CRON_SECRET|SEMAPHORE_API_KEY|SERVICE_ROLE'` → 0.
- 8.3 RLS anon SELECT bookings: `curl -s -w "\n%{http_code}" "$SUPABASE_URL/rest/v1/bookings?select=code,status&limit=1" -H "apikey: $SUPABASE_PUBLISHABLE_KEY"` → 200 `[]` (deny-by-absence — no anon SELECT policy).
- 8.4 RLS anon SELECT notify_log: same pattern → 200 `[]`.
- 8.5 RLS anon SELECT operators: `.../operators?select=id,name,slug&limit=1` → 200 with rows (public read by design — operator contact is public).
- 8.6 RLS anon UPDATE bookings: `curl -s -o /dev/null -w "%{http_code}" -X PATCH "$SUPABASE_URL/rest/v1/bookings?code=eq.$CODE1" -H "apikey: $SUPABASE_PUBLISHABLE_KEY" -H 'Content-Type: application/json' -d '{"status":"CONFIRMED"}'` → 204 **BUT** re-read row with secret key (4.2 pattern) → status still `PENDING_CONFIRMATION`. (204 can mean 0 rows matched — always verify row state.)
- 8.7 RLS anon INSERT bookings: allowed by design (guest flow) — covered by 4.1.
- 8.8 `/api/bookings/[code]` GET no PII: `curl -s $U/api/bookings/$CODE1` → keys exactly `code, status, tour_date, package_name, pax, total_amount` (guest_name is selected server-side but NOT returned — assert absent).
- 8.9 No PII on public pages: `curl -s $U/seaclouds $U/p/standard-room $U/track | grep -cE "09170000000|qa\."` → 0 (no test PII leaks into static HTML).

## 9. PWA
- 9.1 `curl -s -o /dev/null -w "%{http_code}" $U/manifest.json` → 200; `curl -sI $U/manifest.json | grep -i content-type` → `application/manifest+json`.
- 9.2 `curl -s "$U/manifest.json?slug=seaclouds"` → `"name":"SeaClouds Mountain View Resort Booking"`, `display:"standalone"`, 3 icons (192/512/maskable).
- 9.3 `curl -sI $U/sw.js` → 200, headers `Service-Worker-Allowed: /` and `Cache-Control: public, max-age=0, must-revalidate`.
- 9.4 Browser: `navigator.serviceWorker.getRegistration()` → non-null (SW registered on load).
- 9.5 Install banner — **conditional/best-effort**: Chrome-only `beforeinstallprompt`, fires on 2nd visit (localStorage `davaobook_visits`). In headless it may never fire → record "not observed" without failing. If it fires: banner shows "Install DavaoBook" + Install/Dismiss.

## 10. Cron endpoints
- 10.1 `curl -s -w "\n%{http_code}" $U/api/cron/expiry` → 401 `{"error":"Unauthorized"}` (no CRON_SECRET).
- 10.2 `curl -s -w "\n%{http_code}" $U/api/cron/keepalive` → 401 `{"error":"Unauthorized"}`.
- 10.3 Wrong secret: `curl -s -w "\n%{http_code}" $U/api/cron/keepalive -H "Authorization: Bearer wrong-secret"` → 401.
- 10.4 Authed path — **BLOCKED-by-design**: CRON_SECRET is not in the test env file, and calling the authed path would run the expiry sweep (mutates bookings + sends SMS). Not tested; the requirement is "not publicly callable" — proven by 10.1–10.3.

## 11. Edge cases
- 11.1 Duplicate booking same date/room → capacity: covered by 4.7 (409).
- 11.2 Past date rejected: covered by 4.5 (400).
- 11.3 Blocked date: covered by 4.8 (N/A — no blocks in live DB).
- 11.4 Empty state (track): browser, /track with `no-such-email-$TS@example.com` → "No bookings found for that email. Double-check the email you used, or try your booking code instead."
- 11.5 Empty state (landing): N/A — 3 active packages exist. (Code path: `No packages available.` when pkgList empty.)

## 12. Cleanup (best-effort, after all checks)
- Delete test bookings: `curl -s -o /dev/null -w "%{http_code}" -X DELETE "$SUPABASE_URL/rest/v1/bookings?email=eq.$EMAIL" -H "apikey: $SUPABASE_SECRET_KEY" -H "Authorization: Bearer $SUPABASE_SECRET_KEY"` → 204. Also delete the 4.7 capacity pair (email `qa@example.com`-style or by code — use the same secret-key DELETE by `code=in.(CODE2,...)`). Verify: `curl -s "$SUPABASE_URL/rest/v1/bookings?select=code&email=eq.$EMAIL" -H "apikey: $SUPABASE_SECRET_KEY" -H "Authorization: Bearer $SUPABASE_SECRET_KEY"` → `[]`.

## Evidence format (per check)
- HTTP: status code + body snippet (first 200 chars) + booking code where present.
- REST/RLS: HTTP code + full body; for UPDATE probes, the follow-up secret-key read.
- Browser: screenshot path (`logs/navigator/YYYY-MM-DD-<flow>/`) + one-line DOM observation per check; console error count.
- All evidence logged to `qa/logs/`; failures → bug ticket via tk with the verbatim command (workdir `/home/yuki/ai_works/pseudo_human/tickets`, project `davaobook`).

## Not covered (explicit)
- Payment — intentionally removed (davaobook-0009): booking = request, owner confirms + handles payment offline. Legacy `/api/bookings/[code]/payment` route exists but is unreachable from the UI and no new bookings land in PENDING_PAYMENT — inert, not tested.
- Multi-night / check-in–check-out booking — Phase C not built (davaobook-0003, Todo).
- SMS delivery — external (Semaphore); only `notify_log` rows are checked, never actual SMS.
- Operator login + confirm/cancel UI flow — BLOCKED (no credentials); only login wall + middleware redirect + API auth probes tested.
- Authed cron path (real CRON_SECRET) — BLOCKED (secret not in test env; would mutate bookings).
- PACKAGE_UNAVAILABLE_DAY — all 3 demo packages run all 7 days; cannot trigger on demo data.
- Rate limiting — none implemented on this app (no limiter in code); not tested.
- Install banner `beforeinstallprompt` — Chrome-only, may not fire in headless (conditional).
- Test-env isolation — E2E runs against prod with disposable fake-PII bookings; cleanup at §12.