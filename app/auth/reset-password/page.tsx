"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";

export default function ResetPasswordPage() {
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const card = "w-full max-w-sm bg-surface rounded-2xl shadow-lg p-8";

  useEffect(() => {
    async function verify() {
      try {
        const supabase = createBrowserClient();
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          setHasSession(true);
        } else {
          const { data: userData } = await supabase.auth.getUser();
          setHasSession(!!userData.user);
        }
      } catch {
        setHasSession(false);
      } finally {
        setChecking(false);
      }
    }
    verify();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) {
        const msg = authError.message.toLowerCase();
        if (/weak|short|6|length/.test(msg)) {
          setError("Password is too weak — use at least 6 characters.");
        } else if (/same/.test(msg)) {
          setError("New password must be different from the old password.");
        } else if (/rate|too many|429|timeout/.test(msg)) {
          setError("Too many attempts — please wait a moment and try again.");
        } else {
          setError(authError.message);
        }
      } else {
        setSuccess(true);
        setTimeout(() => {
          window.location.replace("/auth/login");
        }, 1500);
      }
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
        <div className={card}>
          <p className="text-ink-muted text-center text-sm">Verifying reset link…</p>
        </div>
      </main>
    );
  }

  if (!hasSession) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
        <div className={card}>
          <p className="text-xs font-heading text-brand uppercase tracking-wide mb-3">DavaoBook</p>
          <h1 className="font-heading text-2xl font-bold mb-2">Link invalid or expired</h1>
          <p className="text-ink-muted mb-6 text-sm">
            This reset link is invalid or has expired. Request a new one to continue.
          </p>
          <Link href="/auth/forgot-password" className="btn-primary w-full block text-center">
            Request new link
          </Link>
          <p className="mt-6 text-center">
            <Link href="/auth/login" className="text-brand underline text-sm">
              Back to sign in
            </Link>
          </p>
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
        <div className={card}>
          <div className="mb-4 text-5xl text-center">✅</div>
          <h1 className="font-heading text-2xl font-bold text-center mb-2">Password updated</h1>
          <p className="text-ink-muted text-center mb-6">Your password has been updated. Redirecting to sign in…</p>
          <Link href="/auth/login" className="text-brand underline text-sm mx-auto block text-center">
            Go to sign in now
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
      <div className={card}>
        <p className="text-xs font-heading text-brand uppercase tracking-wide mb-3">DavaoBook</p>
        <h1 className="font-heading text-2xl font-bold mb-1">Reset password</h1>
        <p className="text-ink-muted mb-8">Choose a new password for your account.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1.5">
              New password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full rounded-touch border border-gray-300 px-4 py-3 pr-16 text-base focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-brand underline px-2 py-1"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirm" className="block text-sm font-medium mb-1.5">
              Confirm password
            </label>
            <input
              id="confirm"
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password"
              className="w-full rounded-touch border border-gray-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              autoComplete="new-password"
            />
          </div>

          {error && <p className="text-status-cancelled text-sm">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? "Updating…" : "Update password"}
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
