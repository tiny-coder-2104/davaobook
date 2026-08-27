"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser";

const LAST_EMAIL_KEY = "db_last_email";

/**
 * Login page — magic-link auth via Supabase.
 * Airbnb-style centered card, mobile-first. No auth logic changed.
 */
function LoginPageInner() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [linkExpired, setLinkExpired] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  // Returning-user prefill + expired-link inbound notice.
  useEffect(() => {
    const last = localStorage.getItem(LAST_EMAIL_KEY);
    if (last) setEmail(last);

    if (searchParams.get("error") === "link_expired") {
      setLinkExpired(true);
      // Clear the param from the visible URL so it isn't re-shown on refresh.
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      router.replace(`${url.pathname}${url.search}`);
    }
  }, [searchParams, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createBrowserClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        const msg = authError.message.toLowerCase();
        const isRateLimited = /rate|too many|429|timeout/.test(msg);
        setError(
          isRateLimited
            ? "Too many attempts — please wait a moment and try again."
            : authError.message
        );
      } else {
        localStorage.setItem(LAST_EMAIL_KEY, email);
        setSent(true);
      }
    } catch {
      // Non-Supabase failure (e.g. fetch/network down).
      setError("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // Shared card chrome.
  const card = "w-full max-w-sm bg-surface rounded-2xl shadow-lg p-8";

  if (sent) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
        <div className={card}>
          <div className="mb-4 text-5xl text-center">📬</div>
          <h1 className="font-heading text-2xl font-bold text-center mb-2">
            Check your email
          </h1>
          <p className="text-ink-muted text-center mb-6">
            We sent a login link to <strong className="text-ink">{email}</strong>
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
          <p className="mt-6 text-center text-xs text-ink-muted">
            DavaoBook
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
      <div className={card}>
        {linkExpired && (
          <div className="mb-6 rounded-touch border-l-4 border-status-cancelled bg-gray-50 px-4 py-3 text-sm text-status-cancelled">
            That login link expired or was already used. Request a new one below.
          </div>
        )}

        <p className="text-xs font-heading text-brand uppercase tracking-wide mb-3">
          DavaoBook
        </p>
        <h1 className="font-heading text-2xl font-bold mb-1">
          Welcome back
        </h1>
        <p className="text-ink-muted mb-8">
          Sign in to your DavaoBook admin.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
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
            {loading ? "Sending…" : "Send login link"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  // useSearchParams requires a Suspense boundary in the Next 14 app router.
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
