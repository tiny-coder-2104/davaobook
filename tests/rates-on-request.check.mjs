#!/usr/bin/env node
/**
 * Runnable check — rates on request (compliance F-01).
 *
 * Asserts, against a local production build backed by the live DB:
 *   1. a package with NO published rate renders "Message for rates" and
 *      NEVER ₱1,500 / ₱2,500 / ₱3,500 / ₱0   (room cards + package page)
 *   2. the booking flow still completes end-to-end: POST /api/bookings →
 *      201 + code (total 0) → GET /b/{code} + /v/{code} → 200 with
 *      "To be confirmed by the resort"
 *   3. (conditional) once live SeaClouds rates are stripped, the real
 *      /seaclouds room cards pass the same no-fake-rate assertion
 *
 * It creates a throwaway fixture operator + 2 packages + 1 booking in the
 * live DB and deletes them afterwards (same pattern as tests/plans/
 * davaobook-smoke.md). Nothing under SeaClouds is modified.
 *
 * Run (Next 14 needs node >= 18):
 *   PATH=/home/yuki/.nvm/versions/node/v18.20.8/bin:$PATH node tests/rates-on-request.check.mjs
 *
 * Needs .env.local (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 */
import { execSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 3111;
const BASE = `http://127.0.0.1:${PORT}`;
const FORBIDDEN = /₱\s?(1,500|2,500|3,500|1500|2500|3500)\b/;

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]])
);
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA || !KEY) throw new Error("missing Supabase env in .env.local");

const rest = async (method, path, body) => {
  const res = await fetch(`${SUPA}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok || !detail ? "" : ` — ${detail}`}`);
  if (!ok) failures++;
};

// React SSR splits dynamic text with <!-- --> (₱<!-- -->1,500) — strip the
// comment markers before matching, or every money assertion passes vacuously.
const text = (html) => html.replace(/<!--.*?-->/g, "");

const assertPage = async (label, path, mustInclude, { allowMoney = false } = {}) => {
  const res = await fetch(`${BASE}${path}`);
  const html = text(await res.text());
  check(`${label}: HTTP ${res.status}`, res.status === 200);
  for (const s of mustInclude) {
    check(`${label}: contains "${s}"`, html.includes(s));
  }
  if (!allowMoney) {
    check(`${label}: no ₱1,500/₱2,500/₱3,500`, !FORBIDDEN.test(html),
      FORBIDDEN.exec(html)?.[0]);
    check(`${label}: no ₱0`, !/₱\s?0(?![\d.,])/.test(html));
  }
  return html;
};

// ── 1. fixtures (live DB, deleted in finally) ─────────────────────────
const stamp = Date.now().toString(36).toUpperCase();
const operator = await rest("POST", "operators", {
  name: "QA Rates Fixture",
  slug: `qa-rates-fixture-${stamp.toLowerCase()}`,
  phone: "+639000000000",
  email: "qa-rates-fixture@example.com",
  verified: false,
}).then((r) => (Array.isArray(r) ? r[0] : r));

// A: sentinel state the strip script writes (price_per_pax = 0)
// B: key missing entirely (legacy/null shape) — display must also hold
const pkgA = await rest("POST", "packages", {
  operator_id: operator.id,
  name: "QA Rates Room",
  slug: `qa-rates-room-${stamp.toLowerCase()}`,
  description: "Fixture room for the rates-on-request check.",
  tiers: [{ min_pax: 1, max_pax: 4, price_per_pax: 0 }],
  days_of_week: [0, 1, 2, 3, 4, 5, 6],
  capacity_per_day: 5,
  max_nights: 7,
  active: true,
}).then((r) => (Array.isArray(r) ? r[0] : r));

const pkgB = await rest("POST", "packages", {
  operator_id: operator.id,
  name: "QA No-Key Room",
  slug: `qa-nokey-room-${stamp.toLowerCase()}`,
  tiers: [{ min_pax: 1, max_pax: 2 }],
  days_of_week: [0, 1, 2, 3, 4, 5, 6],
  capacity_per_day: 5,
  active: true,
}).then((r) => (Array.isArray(r) ? r[0] : r));

let bookingCode = null;
let server = null;

try {
  // ── 2. build + serve ────────────────────────────────────────────────
  console.log("building…");
  execSync("npm run build", { stdio: "inherit" });
  console.log(`starting :${PORT}…`);
  server = spawn("npm", ["run", "start", "--", "-p", String(PORT)], {
    stdio: "ignore",
    detached: false,
  });
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(BASE, { redirect: "manual" });
      break;
    } catch {
      await sleep(1000);
      if (i === 59) throw new Error("server never came up");
    }
  }

  // ── 3. rendering: no rate → no money ────────────────────────────────
  await assertPage(
    "operator landing (room cards)",
    `/${operator.slug}`,
    ["Message for rates", "Check Availability"]
  );
  await assertPage("package page (rate=0)", `/p/${pkgA.slug}`, ["Message for rates"]);
  await assertPage("package page (key missing)", `/p/${pkgB.slug}`, ["Message for rates"]);

  // ── 4. booking flow still completes ─────────────────────────────────
  const tourDate = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
  const create = await fetch(`${BASE}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      package_id: pkgA.id,
      tour_date: tourDate,
      pax: 2,
      guest_name: "QA Rates Check",
      guest_mobile: "09170000000",
      guest_pickup_area: "Fixture",
    }),
  });
  const created = await create.json();
  check(`POST /api/bookings → ${create.status}`, create.status === 201,
    JSON.stringify(created));
  bookingCode = created.code ?? null;
  check("booking code issued", typeof bookingCode === "string" && bookingCode.length > 0);
  check("total_amount is 0 (no invented rate)", created.total_amount === 0,
    String(created.total_amount));

  if (bookingCode) {
    await assertPage("guest status /b/{code}", `/b/${bookingCode}`, [
      "Booking status",
      "To be confirmed by the resort",
    ]);
    await assertPage("voucher /v/{code}", `/v/${bookingCode}`, ["QA Rates Check"]);
  }

  // ── 5. conditional: live SeaClouds cards, once stripped ─────────────
  const liveRes = await fetch(`${BASE}/seaclouds`);
  const liveHtml = text(await liveRes.text());
  check("/seaclouds: HTTP " + liveRes.status, liveRes.status === 200);
  if (FORBIDDEN.test(liveHtml)) {
    console.log(
      "SKIP  /seaclouds still shows live rates — re-run AFTER `node scripts/strip-invented-rates.js .env.local --yes`"
    );
  } else {
    check("/seaclouds: no ₱1,500/₱2,500/₱3,500", !FORBIDDEN.test(liveHtml));
    check("/seaclouds: room cards say \"Message for rates\"", liveHtml.includes("Message for rates"));
  }
} finally {
  if (server) {
    try { process.kill(server.pid, "SIGTERM"); } catch { /* already gone */ }
  }
  // teardown — always
  try {
    if (bookingCode) await rest("DELETE", `bookings?code=eq.${bookingCode}`);
    await rest("DELETE", `packages?id=in.(${pkgA.id},${pkgB.id})`);
    await rest("DELETE", `operators?id=eq.${operator.id}`);
    console.log("teardown: fixture booking + packages + operator removed");
  } catch (e) {
    console.error(`TEARDOWN FAILED — clean up manually: ${e.message}`);
    failures++;
  }
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
