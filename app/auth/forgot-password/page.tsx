"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const card = "w-full max-w-sm bg-surface rounded-2xl shadow-lg p-8";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (authError) {
        const msg = authError.message.toLowerCase();
        if (/rate|too many|429|timeout/.test(msg)) {
          setError("Too many attempts — please wait a moment and try again.");
        } else {
          setError(authError.message);
        }
      } else {
        setSent(true);
      }
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
        <div className={card}>
          <div className="mb-4 text-5xl text-center">📬</div>
          <h1 className="font-heading text-2xl font-bold text-center mb-2">Check your email</h1>
          <p className="text-ink-muted text-center mb-6">
            We sent a reset link to <strong className="text-ink">{email}</strong>. Click the link inside to reset your password.
          </p>
          <button
            onClick={() => {
              setSent(false);
              setEmail("");
            }}
            className="mx-auto block text-brand underline text-sm"
          >
            Use a different email
          </button>
          <p className="mt-6 text-center">
            <Link href="/auth/login" className="text-brand underline text-sm">
              Back to sign in
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
      <div className={card}>
        <p className="text-xs font-heading text-brand uppercase tracking-wide mb-3">DavaoBook</p>
        <h1 className="font-heading text-2xl font-bold mb-1">Forgot password</h1>
        <p className="text-ink-muted mb-8">Enter your email and we&apos;ll send you a reset link.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1.5">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@operator.com"
              className="w-full rounded-touch border border-gray-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              autoComplete="email"
            />
          </div>

          {error && <p className="text-status-cancelled text-sm">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <p className="mt-6 text-center">
          <Link href="/auth/login" className="text-brand underline text-sm">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
