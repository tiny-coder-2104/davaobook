#!/usr/bin/env node
/**
 * Strip invented room rates — compliance fix F-01.
 *
 * The demo publishes real resort names with invented prices. This script
 * neutralises every money figure in the live DB without deleting any rows:
 *   packages.tiers[].price_per_pax  → 0   (0 = "rates on request")
 *   bookings.total_amount/tier_price → 0  (display renders "To be confirmed
 *                                            by the resort" for 0)
 * Room names, dates, statuses and everything else are untouched.
 *
 * Usage:
 *   node scripts/strip-invented-rates.js [env-file]              # dry-run
 *   node scripts/strip-invented-rates.js [env-file] --yes        # apply
 *   node scripts/strip-invented-rates.js [env-file] --restore <backup.json>
 *
 * Env file must provide SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and
 * SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY). Default: .env.local.
 * Backup is written to qa/logs/rates-backup-<timestamp>.json (gitignored).
 *
 * Zero deps — stdlib https (node16 has no global fetch).
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const args = process.argv.slice(2);
const yes = args.includes("--yes");
const restoreIdx = args.indexOf("--restore");
const restoreFile = restoreIdx >= 0 ? args[restoreIdx + 1] : null;
const envFile =
  args.find((a) => !a.startsWith("--") && a !== restoreFile) || ".env.local";

const env = { ...process.env };
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
}

const URL_BASE = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) {
  console.error(`Missing Supabase URL/key in ${envFile}`);
  process.exit(1);
}

function request(method, pathname, body) {
  const url = new URL(`${URL_BASE}/rest/v1/${pathname}`);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method,
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            reject(new Error(`${method} ${pathname} → ${res.statusCode} ${data}`));
            return;
          }
          try {
            resolve(data ? JSON.parse(data) : null);
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const money = (n) => `₱${Number(n).toLocaleString("en-PH")}`;

async function strip() {
  const packages = await request("GET", "packages?select=id,slug,tiers");
  const bookings = await request(
    "GET",
    "bookings?select=id,code,total_amount,tier_price&total_amount=gt.0"
  );

  const pkgChanges = packages.filter((p) =>
    (p.tiers || []).some((t) => Number(t.price_per_pax) > 0)
  );
  const bookingChanges = bookings.filter((b) => Number(b.total_amount) > 0);

  console.log(`Packages with published rates: ${pkgChanges.length}`);
  for (const p of pkgChanges) {
    console.log(
      `  ${p.slug}: ${p.tiers
        .map((t) => `${t.min_pax}-${t.max_pax}pax ${money(t.price_per_pax)}`)
        .join(", ")}  →  0 (rates on request)`
    );
  }
  console.log(`Bookings with a stored amount: ${bookingChanges.length}`);
  for (const b of bookingChanges.slice(0, 10)) {
    console.log(`  ${b.code}: ${money(b.total_amount)} → 0`);
  }
  if (bookingChanges.length > 10) console.log(`  …and ${bookingChanges.length - 10} more`);

  if (!yes) {
    console.log("\nDRY RUN — nothing written. Re-run with --yes to apply.");
    return;
  }

  for (const p of pkgChanges) {
    const tiers = p.tiers.map((t) => ({ ...t, price_per_pax: 0 }));
    await request("PATCH", `packages?id=eq.${p.id}`, [{ tiers }]);
  }
  await request(
    "PATCH",
    "bookings?id=in.(" + bookingChanges.map((b) => b.id).join(",") + ")",
    bookingChanges.map((b) => ({ id: b.id, total_amount: 0, tier_price: 0 }))
  );

  const backup = {
    stripped_at: new Date().toISOString(),
    packages: pkgChanges.map((p) => ({ id: p.id, slug: p.slug, tiers: p.tiers })),
    bookings: bookingChanges.map((b) => ({
      id: b.id,
      code: b.code,
      total_amount: b.total_amount,
      tier_price: b.tier_price,
    })),
  };
  const dir = path.join(__dirname, "..", "qa", "logs");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(
    dir,
    `rates-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  fs.writeFileSync(file, JSON.stringify(backup, null, 2));
  console.log(
    `\nApplied: ${pkgChanges.length} packages + ${bookingChanges.length} bookings zeroed.`
  );
  console.log(`Backup (restore with --restore): ${file}`);
}

async function restore(file) {
  const backup = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const p of backup.packages || []) {
    await request("PATCH", `packages?id=eq.${p.id}`, [{ tiers: p.tiers }]);
  }
  const bks = backup.bookings || [];
  if (bks.length > 0) {
    await request(
      "PATCH",
      "bookings?id=in.(" + bks.map((b) => b.id).join(",") + ")",
      bks.map((b) => ({
        id: b.id,
        total_amount: b.total_amount,
        tier_price: b.tier_price,
      }))
    );
  }
  console.log(
    `Restored ${backup.packages?.length ?? 0} packages + ${bks.length} bookings from ${file}`
  );
}

(restoreFile ? restore(restoreFile) : strip()).catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
