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
 */
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

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

const supabase = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

supabase.auth.admin
  .createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { must_change_password: true },
    app_metadata: { operator_id: operatorId },
  })
  .then(({ data, error }) => {
    if (error) {
      console.error("createUser failed:", error.message);
      process.exit(1);
    }
    console.log("Created user id:", data.user.id);
  })
  .catch((err) => {
    console.error("createUser failed:", err.message);
    process.exit(1);
  });