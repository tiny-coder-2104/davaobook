"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser";

const LAST_EMAIL_KEY = "db_last_email";

function LoginPageInner() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [linkExpired, setLinkExpired] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const last = localStorage.getItem(LAST_EMAIL_KEY);
    if (last) setEmail(last);

    if (searchParams.get("error") === "link_expired") {
      setLinkExpired(true);
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
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        const msg = authError.message.toLowerCase();
        if (msg.includes("invalid") || msg.includes("credentials") || msg.includes("invalid login")) {
          setError("Wrong email or password.");
        } else if (msg.includes("confirm") || msg.includes("not confirmed") || msg.includes("email not confirmed")) {
          setError("Please confirm your email first \u2014 check your inbox.");
        } else if (/rate|too many|429|bandwidth|timeout/.test(msg)) {
          setError("Too many attempts \u2014 please wait...");
        } else {
          setError(authError.message);
        }
      } else if (data.session) {
        const accessToken = data.session.access_token;
        const refreshToken = data.session.refresh_token;
        const expiresIn = data.session.expires_in ?? 3600;
        document.cookie = `sb-access-token=${accessToken}; Path=/; Secure; SameSite=Lax; Max-Age=${expiresIn}`;
        document.cookie = `sb-refresh-token=${refreshToken}; Path=/; Secure; SameSite=Lax; Max-Age=31536000`;
        localStorage.setItem(LAST_EMAIL_KEY, email);
        window.location.replace("/admin/today");
      } else {
        setError("No session returned — please try again.");
      }
    } catch {
      setError("Network error \u2014 check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const card = "w-full max-w-sm bg-surface rounded-2xl shadow-lg p-8";

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
      <div className={card}>
        {linkExpired && (
          <div className="mb-6 rounded-touch border-l-4 border-status-cancelled bg-gray-50 px-4 py-3 text-sm text-status-cancelled">
            That login link expired or was already used. Request a new one below.
          </div>
        )}

        <p className="text-xs font-heading text-brand uppercase tracking-wide mb-3">DavaoBook</p>
        <h1 className="font-heading text-2xl font-bold mb-1">Welcome back</h1>
        <p className="text-ink-muted mb-8">Sign in to your DavaoBook admin.</p>

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

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className="w-full rounded-touch border border-gray-300 px-4 py-3 pr-16 text-base focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                autoComplete="current-password"
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

          {error && <p className="text-status-cancelled text-sm">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
            {loading ? "Signing in\u2026" : "Sign in"}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <Link href="/auth/forgot-password" className="block text-brand underline text-sm">
            Forgot password?
          </Link>
          <p className="text-sm text-ink-muted">
            New operator?{" "}
            <Link href="/auth/signup" className="text-brand underline text-sm">
              Create an account
            </Link>
          </p>
          <p className="text-xs text-ink-muted">Previously used magic link? Use Forgot password to set a password.</p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
