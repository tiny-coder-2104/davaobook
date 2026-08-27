"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";

const LAST_EMAIL_KEY = "db_last_email";

/**
 * Signup page — password-based operator account creation via Supabase.
 * Mirrors the login page card style. No auth logic shared with login.
 */
export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const card = "w-full max-w-sm bg-surface rounded-2xl shadow-lg p-8";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createBrowserClient();
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        const msg = authError.message.toLowerCase();
        if (/rate|too many|429|timeout/.test(msg)) {
          setError("Too many attempts — please wait a moment and try again.");
        } else if (/already.*registered|already exists|user.*exist|registered/i.test(msg)) {
          setError("An account with that email already exists. Try signing in instead.");
        } else if (/password.*(weak|6|short|length)/i.test(msg)) {
          setError("Password is too weak — use at least 6 characters.");
        } else {
          setError(authError.message);
        }
      } else {
        localStorage.setItem(LAST_EMAIL_KEY, email);
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
          <h1 className="font-heading text-2xl font-bold text-center mb-2">
            Check your email
          </h1>
          <p className="text-ink-muted text-center mb-6">
            We sent a confirmation email to{" "}
            <strong className="text-ink">{email}</strong>. Click the link
            inside to activate your operator account.
          </p>
          <button
            onClick={() => {
              setSent(false);
              setEmail("");
              setPassword("");
            }}
            className="mx-auto block text-brand underline text-sm"
          >
            Use a different email
          </button>
          <p className="mt-6 text-center text-xs text-ink-muted">DavaoBook</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
      <div className={card}>
        <p className="text-xs font-heading text-brand uppercase tracking-wide mb-3">
          DavaoBook
        </p>
        <h1 className="font-heading text-2xl font-bold mb-1">
          Create an operator account
        </h1>
        <p className="text-ink-muted mb-8">
          Sign up to manage your DavaoBook packages.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium mb-1.5"
            >
              Name <span className="text-ink-muted">(optional)</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tour Co."
              className="w-full rounded-touch border border-gray-300 px-4 py-3 text-base
                         focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              autoComplete="name"
            />
          </div>

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

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full rounded-touch border border-gray-300 px-4 py-3 text-base
                         focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              autoComplete="new-password"
            />
          </div>

          {error && <p className="text-status-cancelled text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>

        <div className="mt-6 space-y-2 text-center">
          <p className="text-sm text-ink-muted">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-brand underline text-sm">
              Sign in
            </Link>
          </p>
          <p className="text-sm text-ink-muted">
            <Link href="/auth/login" className="text-brand underline text-sm font-medium">
              Admin sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
