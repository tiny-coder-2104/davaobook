"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser";

/**
 * Forced password reset — reached via middleware redirect when the session
 * carries user_metadata.must_change_password. Clears the flag on success so
 * the next /admin visit passes the middleware check.
 */
export default function ChangePasswordPage() {
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const router = useRouter();
  const card = "w-full max-w-sm bg-surface rounded-2xl shadow-lg p-8";

  useEffect(() => {
    async function verify() {
      try {
        const supabase = createBrowserClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const has =
          !!sessionData.session || !!(await supabase.auth.getUser()).data.user;
        if (has) {
          setHasSession(true);
        } else {
          router.replace("/auth/login");
        }
      } catch {
        router.replace("/auth/login");
      } finally {
        setChecking(false);
      }
    }
    verify();
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
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
        setError(authError.message);
      } else {
        await supabase.auth.updateUser({ data: { must_change_password: false } });
        setSuccess(true);
        setTimeout(() => router.push("/admin"), 1200);
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
          <p className="text-ink-muted text-center text-sm">Checking session…</p>
        </div>
      </main>
    );
  }

  if (!hasSession) {
    return null; // redirecting to /auth/login
  }

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
        <div className={card}>
          <div className="mb-4 text-5xl text-center">✅</div>
          <h1 className="font-heading text-2xl font-bold text-center mb-2">
            Password updated
          </h1>
          <p className="text-ink-muted text-center mb-6">
            Your password has been updated. Taking you to your dashboard…
          </p>
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
        <h1 className="font-heading text-2xl font-bold mb-1">Set your password</h1>
        <p className="text-ink-muted mb-8">
          Your account was created by an admin. Choose a password to continue.
        </p>

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
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
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
              minLength={8}
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
      </div>
    </main>
  );
}