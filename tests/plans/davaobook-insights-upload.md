# Test plan — davaobook-0024 (Insights + stats home) + davaobook-0025 (photo upload)

Commit under test: `97fd0a8` (feat(0024-0025): insights page + stats home, server-side photo upload). Site: `https://davaotours-booking.vercel.app`. Env: `.secrets/supabase-gchcatdprvpmbwvfxqzi.env` (test project).

Run order: Setup → seed → 0024 API → 0024 UI (browser) → 0025 API → 0025 UI (browser) → Regression → Cleanup. All checks runnable by tester (bash + curl); browser checks via navigator (invoked top-level by QA — tester cannot nest navigator). Fake PII only.

```
U=https://davaotours-booking.vercel.app
ENVFILE=${ENVFILE:?set to the Supabase env file path}
source $ENVFILE   # SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY
TS=$(date +%s)
EMAIL=qa.insights.$TS@example.com
BROWSER_EMAIL=qa.browser.$TS@example.com
```

Verified facts (qa recon 2026-09-24, read-only):
- SeaClouds operator id `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11`; tiny-coder-2104 operator id `7c7209a0-b9b1-45f1-81c2-bbc9ad360602`.
- Live DB has exactly 4 bookings, ALL SeaClouds, ALL `PENDING_CONFIRMATION` (total 12000): ISLAN-0827-S (std, 6000, pax4, 08-27), ISLAN-0914-J (std, 1500, pax1, 09-14), SUNSE-0902-STE (suite, 2000, pax1, 09-02), FAMIL-0925- (family, 2500, pax1, 09-25). **Zero CONFIRMED → revenue checks need seeded CONFIRMED test bookings.**
- tiny-coder-2104 has 0 packages, 0 bookings → browser insights shows empty state (by design).
- Package ids: standard-room `12cb688a-ac00-4c8b-bb55-4545ac7d1de1` (cap 5), family-cabin `657de57b-36da-4250-aa17-57983ec98cd4` (cap 3), mountain-view-suite `08a2a206-e396-4d1a-b107-f0ca96ed3600` (cap 2).
- `package-images` bucket is public; original photos live at bucket ROOT (`standard_room.jpg` etc.); upload route writes under `packages/` prefix (currently empty).
- Middleware protects `/api/admin/*`: requires session cookies `sb-access-token` + `sb-refresh-token`, derives `x-operator-id` from JWT claims (forged header overwritten). API checks therefore need a REAL session.
- Booking API allows `tour_date = today` (DB fn rejects only `p_tour_date < CURRENT_DATE`).
- Existing auth users: `tiny-coder-2104@agentmail.to` (op 7c7209a0) + `ops.samal.demo@davaobook.app` (op 0056b6df) — passwords unknown; fresh test users created for this run.

## 0. Setup — sessions + seed data

### 0.1 SeaClouds-bound API session (for insights/today/upload API checks)
- 0.1.1 Create user (admin API, secret key): `curl -s -X POST "$SUPABASE_URL/auth/v1/admin/users" -H "apikey: $SUPABASE_SECRET_KEY" -H "Authorization: Bearer $SUPABASE_SECRET_KEY" -H "Content-Type: application/json" -d '{"email":"'$EMAIL'","password":"QaInsights456!","email_confirm":true,"user_metadata":{"must_change_password":false},"app_metadata":{"operator_id":"a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"}}'` → 200, capture `API_USER_ID`.
- 0.1.2 Login (password grant): `curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" -H "apikey: $SUPABASE_PUBLISHABLE_KEY" -H "Content-Type: application/json" -d '{"email":"'$EMAIL'","password":"QaInsights456!"}'` → capture `ACCESS_TOKEN`, `REFRESH_TOKEN`. API calls use `-H "Cookie: sb-access-token=$ACCESS_TOKEN; sb-refresh-token=$REFRESH_TOKEN"`.

### 0.2 tiny-coder-2104 browser session (for UI checks)
- 0.2.1 Create user via script (zero-dep, node16): `/home/yuki/.nvm/versions/node/v16.20.2/bin/node scripts/create-operator-account.js 7c7209a0-b9b1-45f1-81c2-bbc9ad360602 $BROWSER_EMAIL QaBrowser456! $ENVFILE` → capture `BROWSER_USER_ID` (must_change_password=true).
- 0.2.2 Navigator walks forced reset: /auth/login → temp password → /auth/change-password → set `NewPass456!` → lands /admin/today. Sign out → relogin `NewPass456!` → /admin/today direct. (Proven flow, davaobook-0019/0021.)

### 0.3 Seed SeaClouds test bookings (fake PII, deleted in §7)
- 0.3.1 Booking A (CONFIRMED, today, standard room): `TODAY=$(TZ=Asia/Manila date +%F)`; POST `$U/api/bookings` `{"package_id":"12cb688a-ac00-4c8b-bb55-4545ac7d1de1","tour_date":"'$TODAY'","pax":2,"guest_name":"QA Insights Test","guest_mobile":"09170000000","guest_email":"'$EMAIL'","guest_pickup_area":"Test Area","guest_notes":"qa insights"}` → 201, capture `CODE_A`. Confirm via REST (secret key): `PATCH $SUPABASE_URL/rest/v1/bookings?code=eq.$CODE_A -d '{"status":"CONFIRMED"}'` → 204; re-read → status CONFIRMED.
- 0.3.2 Booking B (PENDING, +2 days, family cabin): `D2=$(TZ=Asia/Manila date -d "+2 days" +%F)`; POST `$U/api/bookings` `{"package_id":"657de57b-36da-4250-aa17-57983ec98cd4","tour_date":"'$D2'","pax":1,"guest_name":"QA Insights Test","guest_mobile":"09170000000","guest_email":"'$EMAIL'","guest_pickup_area":"Test Area"}` → 201, capture `CODE_B`. Leave PENDING_CONFIRMATION.
- 0.3.3 Expected values (compute from REST, secret key, `packages(name,capacity_per_day,operator_id)` + `packages.operator_id=eq.a0eebc99...`):
  - total bookings = 6; CONFIRMED = 1 (A, 1500); PENDING_CONFIRMATION = 5.
  - total_revenue = 1500. revenue_by_month: `$(TZ=Asia/Manila date +%Y-%m)` = 1500, other 5 months = 0.
  - popular_packages: Standard Room 3, Family Cabin 2, Mountain View Suite 1 (desc).
  - occupancy_rate = round(avg(pax/capacity) over 6 active) = 43.
  - confirmed_today = 1 (A); upcoming_7d = 1 (B); revenue_this_month = 1500 (A in current month).

## 1. 0024 API — /api/admin/insights
- 1.1 No session: `curl -s -w "\n%{http_code}" $U/api/admin/insights` → 401 `{"error":"Unauthorized"}`.
- 1.2 With SeaClouds session: `curl -s -w "\n%{http_code}" $U/api/admin/insights -H "Cookie: sb-access-token=$ACCESS_TOKEN; sb-refresh-token=$REFRESH_TOKEN"` → 200; `total_revenue == 1500` (cross-check: REST sum of CONFIRMED total_amount for SeaClouds).
- 1.3 `booking_counts` sums to 6 == REST total bookings for SeaClouds; `booking_counts.CONFIRMED == 1`, `PENDING_CONFIRMATION == 5`.
- 1.4 `revenue_by_month`: exactly 6 keys, all match `^\d{4}-\d{2}$`, current month == 1500, other 5 == 0, sum of values == total_revenue.
- 1.5 `popular_packages`: ≤5 entries, sorted desc by count; first = Standard Room (3), second = Family Cabin (2), third = Mountain View Suite (1).
- 1.6 `occupancy_rate`: integer, 0 ≤ x ≤ 100, == 43 (REST-computed).

## 2. 0024 API — /api/admin/today
- 2.1 No session: `curl -s -w "\n%{http_code}" $U/api/admin/today` → 401.
- 2.2 With session: → 200; `confirmed_today == 1` (REST: CONFIRMED with tour_date = Manila today); `upcoming_7d == 1` (REST: non-terminal, tour_date in (today+1, today+7]); `revenue_this_month == 1500` (REST: CONFIRMED, tour_date in current month); `date == $(TZ=Asia/Manila date +%F)`; `bookings` array contains CODE_A row (status CONFIRMED).

## 3. 0024 UI (browser, navigator, tiny-coder-2104 session)
- 3.1 `/admin/insights` renders: 4 stat cards (labels "Total revenue", "Total bookings", "Pending", "Occupancy"), "Revenue by month" section with 6 month bars (YYYY-MM labels), "Popular packages" section, "Bookings by status" section. 0 console errors. Screenshot.
- 3.2 `/admin/today` renders: 4 stat cards row (labels "Pending", "Confirmed today", "Upcoming 7 days", "Revenue this month"). 0 console errors. Screenshot.
- 3.3 Sidebar has "Insights" link: `a[href="/admin/insights"]` with 📊 icon, visible on both pages.
- 3.4 No console errors on either page (count real errors; ignore Next.js prefetch ERR_ABORTED class).

## 4. 0025 API — /api/admin/upload (SeaClouds session)
- 4.1 No session: `curl -s -w "\n%{http_code}" -X POST $U/api/admin/upload -H 'Content-Type: application/json' -d '{}'` → 401.
- 4.2 Non-image: `-d '{"filename":"x.txt","base64":"data:text/plain;base64,SGVsbG8="}'` → 400 (not a data:image URL).
- 4.3 >2MB: `BIG=$(python3 -c "import base64;print('data:image/png;base64,'+base64.b64encode(b'A'*3*1024*1024).decode())")`; `-d '{"filename":"big.png","base64":"'$BIG'"}'` → 400 `Image must be 2MB or smaller`.
- 4.4 Path traversal: `-d '{"filename":"../../evil.png","base64":"data:image/png;base64,'$PNG1X1'"}'` → 200 (sanitized, not rejected); returned URL contains NO `..`; path matches `packages/<ts>-evilpng.png` (dots stripped). Capture `URL_TRAV`.
- 4.5 Valid 1x1 PNG: `PNG1X1=iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==`; `-d '{"filename":"qa-1x1.png","base64":"data:image/png;base64,'$PNG1X1'"}'` → 200, `url` returned. Capture `URL_OK`.
- 4.6 GET `URL_OK` → 200, `Content-Type: image/png`.
- 4.7 Object exists in bucket: `curl -s -X POST "$SUPABASE_URL/storage/v1/object/list/package-images" -H "apikey: $SUPABASE_SECRET_KEY" -H "Authorization: Bearer $SUPABASE_SECRET_KEY" -H "Content-Type: application/json" -d '{"prefix":"packages/","limit":100}'` → contains both uploaded objects (by name).
- 4.8 Garbage base64 (valid data:image prefix, invalid bytes): `-d '{"filename":"x.png","base64":"data:image/png;base64,AAAA"}'` → 400 `File is not a valid image` (magic-byte sniff).

## 5. 0025 UI (browser, navigator, tiny-coder-2104 session)
- 5.0 Create test package via API (tiny-coder-2104 session cookie from §0.2): POST `$U/api/admin/packages` `{"name":"QA Test Room","description":"qa upload test","tiers":[{"min_pax":1,"max_pax":2,"price_per_pax":1000}],"days_of_week":[0,1,2,3,4,5,6],"capacity_per_day":2,"downpayment_pct":0,"cutoff_hours":24,"dp_refundable":false}` → 201, capture `PKG_ID`, `PKG_SLUG`.
- 5.1 `/admin/packages/edit/$PKG_ID` renders: file input (`input[type=file][accept="image/*"]`), drop zone with "Tap or drag photo here", no console errors. Screenshot.
- 5.2 Upload small PNG (setFileInput with `/tmp/opencode/qa-1x1.png`) → preview `<img>` appears with src = returned URL (photo_url populated in form state). Screenshot.
- 5.3 Save package → public page `/p/$PKG_SLUG` shows the new image (`<img src="<uploaded URL>">`). Screenshot.
- 5.4 0 console errors across edit + public page.

## 6. Regression
- 6.1 `curl -s -o /dev/null -w "%{http_code}" $U/seaclouds` → 200.
- 6.2 `curl -s -o /dev/null -w "%{http_code}" $U/p/standard-room` → 200.
- 6.3 `curl -s -o /dev/null -w "%{http_code}" $U/track` → 200.
- 6.4 Browser: `/admin/today` renders (logged in) — covered by 3.2; re-assert 0 console errors.

## 7. Cleanup (after all checks)
- 7.1 Delete test bookings: `curl -s -o /dev/null -w "%{http_code}" -X DELETE "$SUPABASE_URL/rest/v1/bookings?email=eq.$EMAIL" -H "apikey: $SUPABASE_SECRET_KEY" -H "Authorization: Bearer $SUPABASE_SECRET_KEY"` → 204; verify `select=code&email=eq.$EMAIL` → `[]`.
- 7.2 Delete uploaded objects: for each path from 4.4/4.5/5.2: `curl -s -o /dev/null -w "%{http_code}" -X DELETE "$SUPABASE_URL/storage/v1/object/package-images/$PATH" -H "apikey: $SUPABASE_SECRET_KEY" -H "Authorization: Bearer $SUPABASE_SECRET_KEY"` → 200; verify storage list `packages/` → `[]`.
- 7.3 Delete test package: `curl -s -o /dev/null -w "%{http_code}" -X DELETE "$SUPABASE_URL/rest/v1/packages?id=eq.$PKG_ID" -H "apikey: $SUPABASE_SECRET_KEY" -H "Authorization: Bearer $SUPABASE_SECRET_KEY"` → 204; verify `/p/$PKG_SLUG` → 404.
- 7.4 Delete API user: `curl -s -o /dev/null -w "%{http_code}" -X DELETE "$SUPABASE_URL/auth/v1/admin/users/$API_USER_ID" -H "apikey: $SUPABASE_SECRET_KEY" -H "Authorization: Bearer $SUPABASE_SECRET_KEY"` → 200; GET → 404.
- 7.5 Delete browser user: same pattern with `$BROWSER_USER_ID`.
- 7.6 Verify SeaClouds untouched: bookings for SeaClouds back to 4 rows, all PENDING_CONFIRMATION; packages photo_url unchanged (standard_room.jpg etc.); operators table unchanged.

## Evidence format (per check)
- HTTP: status code + body snippet (first 200 chars) + booking code where present.
- REST: HTTP code + full body; for UPDATE probes, the follow-up secret-key read.
- Browser: screenshot path (`logs/navigator/YYYY-MM-DD-<flow>/`) + one-line DOM observation per check; console error count.
- All evidence logged to `qa/logs/`; failures → bug ticket via tk (workdir `/home/yuki/ai_works/pseudo_human/tickets`, project `davaobook`), verbatim repro command in the ticket.

## Not covered (explicit)
- Operator confirm/cancel UI flow — requires operator credentials; confirm simulated via REST UPDATE (secret key) to seed CONFIRMED test data only.
- SMS delivery — external (Semaphore); only DB state checked.
- Multi-operator isolation of insights — single-operator scope verified via REST cross-check; cross-operator leak would require a second operator's bookings (none exist in live DB).
- Rate limiting — none implemented on this app.