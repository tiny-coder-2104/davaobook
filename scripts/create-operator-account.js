#!/usr/bin/env node
/**
 * Provision an operator account (invite-only — no public signup).
 *
 * Usage:
 *   node scripts/create-operator-account.js <operator_id> <email> <temp_password> [env-file]
 *
 * Reads SUPABASE_URL + SUPABASE_SECRET_KEY from the environment, or from a
 * KEY=VALUE env file passed as the 4th argument (e.g. the .secrets file).
 * Creates a confirmed user with must_change_password=true so the first
 * /admin visit forces a password reset.
 *
 * Zero deps — uses stdlib https (node16 has no global fetch).
 */
const fs = require("fs");
const https = require("https");

const [operatorId, email, tempPassword, envFile] = process.argv.slice(2);

if (!operatorId || !email || !tempPassword) {
  console.error(
    "Usage: node scripts/create-operator-account.js <operator_id> <email> <temp_password> [env-file]"
  );
  process.exit(1);
}

const env = { ...process.env };
if (envFile) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
}

const url = env.SUPABASE_URL;
const secretKey = env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY (env or env-file).");
  process.exit(1);
}

const body = JSON.stringify({
  email,
  password: tempPassword,
  email_confirm: true,
  user_metadata: { must_change_password: true, operator_id: operatorId },
  app_metadata: { operator_id: operatorId },
});

const req = https.request(
  new URL(`${url}/auth/v1/admin/users`),
  {
    method: "POST",
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
  },
  (res) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => {
      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch {
        console.error(`createUser failed: HTTP ${res.statusCode} — ${data}`);
        process.exit(1);
      }
      if (res.statusCode >= 400 || parsed.error) {
        console.error(
          "createUser failed:",
          parsed.error_description || parsed.msg || parsed.error || `HTTP ${res.statusCode}`
        );
        process.exit(1);
      }
      console.log("Created user id:", parsed.id);
    });
  }
);
req.on("error", (err) => {
  console.error("createUser failed:", err.message);
  process.exit(1);
});
req.write(body);
req.end();