"use client";

import { useState, type FormEvent } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";

/**
 * Login page — magic-link auth via Supabase.
 * Shows email input + "Send magic link" button.
 * On success, shows "Check your email" message.
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createBrowserClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mb-6 text-5xl">📬</div>
          <h1 className="font-heading text-2xl font-bold mb-2">
            Check your email
          </h1>
          <p className="text-ink-muted">
            We sent a login link to <strong>{email}</strong>
          </p>
          <button
            onClick={() => {
              setSent(false);
              setEmail("");
            }}
            className="mt-6 text-brand underline text-sm"
          >
            Use a different email
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-heading text-2xl font-bold text-center mb-2">
          DavaoBook Admin
        </h1>
        <p className="text-ink-muted text-center mb-8">
          Sign in with your email — no password needed.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium mb-1.5"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@operator.com"
              className="w-full rounded-touch border border-gray-300 px-4 py-3 text-base
                         focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              autoComplete="email"
            />
          </div>

          {error && (
            <p className="text-status-cancelled text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send magic link"}
          </button>
        </form>
      </div>
    </main>
  );
}
