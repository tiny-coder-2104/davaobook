"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";

/**
 * LoginSecurity — email-only login & security section (client component).
 *
 * Reads the current Supabase user on mount and exposes:
 *   - Email (user.email)
 *   - Connected login method: "Email magic link" (only method in v1) with an
 *     "Active" badge.
 *   - Last login (user.last_sign_in_at, locale-formatted).
 *
 * Also offers "Sign out other sessions" via supabase.auth.signOut({ scope:
 * "others" }). The primary Sign out lives in the sidebar/layout and is left
 * untouched.
 */

type UserState = {
  email: string | null;
  lastSignInAt: string | null;
} | null;

export default function LoginSecurity() {
  const [user, setUser] = useState<UserState>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [signingOut, setSigningOut] = useState(false);
  const [signOutMsg, setSignOutMsg] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const supabase = createBrowserClient();
        const { data, error } = await supabase.auth.getUser();
        if (cancelled) return;
        if (error) throw new Error(error.message);
        setUser({
          email: data.user?.email ?? null,
          lastSignInAt: data.user?.last_sign_in_at ?? null,
        });
      } catch (e) {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : "Failed to load session");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignOutOthers = async () => {
    setSigningOut(true);
    setSignOutMsg(null);
    setSignOutError(null);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw new Error(error.message);
      setSignOutMsg("Signed out of all other devices.");
    } catch (e) {
      setSignOutError(
        e instanceof Error ? e.message : "Could not sign out other sessions"
      );
    } finally {
      setSigningOut(false);
    }
  };

  const lastLogin = user?.lastSignInAt
    ? new Date(user.lastSignInAt).toLocaleString()
    : "—";

  if (loading) {
    return (
      <section className="bg-surface rounded-touch border border-gray-200 p-5 sm:p-6">
        <h2 className="font-heading font-semibold text-lg text-ink">
          Login &amp; security
        </h2>
        <p className="mt-2 text-sm text-ink-muted">Loading…</p>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="bg-surface rounded-touch border border-gray-200 p-5 sm:p-6">
        <h2 className="font-heading font-semibold text-lg text-ink">
          Login &amp; security
        </h2>
        <p className="mt-2 text-sm text-red-500">{loadError}</p>
      </section>
    );
  }

  return (
    <section className="bg-surface rounded-touch border border-gray-200 p-5 sm:p-6">
      <h2 className="font-heading font-semibold text-lg text-ink">
        Login &amp; security
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Manage how you sign in to DavaoBook.
      </p>

      <dl className="mt-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-sm font-medium text-ink">Email</dt>
          <dd className="text-sm text-ink-muted break-all text-right">
            {user?.email ?? "—"}
          </dd>
        </div>

        <div className="flex items-center justify-between gap-4">
          <dt className="text-sm font-medium text-ink">Connected login method</dt>
          <dd className="flex items-center gap-2 text-sm text-ink-muted">
            <span>Email magic link</span>
            <span className="rounded-touch bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
              Active
            </span>
          </dd>
        </div>

        <div className="flex items-center justify-between gap-4">
          <dt className="text-sm font-medium text-ink">Last login</dt>
          <dd className="text-sm text-ink-muted text-right">{lastLogin}</dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSignOutOthers}
          disabled={signingOut}
          className="btn-primary min-h-touch px-5 rounded-touch font-medium
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {signingOut ? "Signing out…" : "Sign out other sessions"}
        </button>
        {signOutMsg ? (
          <span className="text-sm text-status-confirmed">{signOutMsg}</span>
        ) : null}
        {signOutError ? (
          <span className="text-sm text-red-500">{signOutError}</span>
        ) : null}
      </div>

      <p className="mt-4 text-xs text-ink-muted">
        Only email magic-link sign-in is supported in this version. Password and
        phone login are not available yet.
      </p>
    </section>
  );
}
