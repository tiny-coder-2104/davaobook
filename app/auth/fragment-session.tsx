"use client";

import { useEffect } from "react";

/**
 * FragmentSessionPersistence — persists the implicit-flow magic-link session
 * (which Supabase leaves in the URL hash after its redirect) into the same
 * httpOnly cookies the server callback sets, then routes to /admin/today.
 *
 * The server route /auth/callback only reads `?code=`; fragments never reach
 * a server route. So with default (non-PKCE) flowType the valid session sits
 * in the hash and, without this, is never persisted. This component closes
 * that gap. Side-effect only — renders null.
 */
export default function FragmentSessionPersistence() {
  useEffect(() => {
    const hash = window.location.hash;

    if (!hash || !hash.includes("access_token=")) return;

    try {
      const params = new URLSearchParams(hash.slice(1));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (!accessToken || !refreshToken) return;

      const expiresIn = params.get("expires_in") || "3600";

      // Same cookie format as app/auth/callback/route.ts (lines 37-41).
      document.cookie = `sb-access-token=${accessToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${expiresIn}`;
      document.cookie = `sb-refresh-token=${refreshToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`;

      // Strip tokens from the address bar before navigating.
      if (window.history.replaceState) {
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search
        );
      }

      // replace, not assign — tokens must not linger in history.
      window.location.replace("/admin/today");
    } catch {
      // ponytail: on any failure just leave the user on login; don't throw.
    }
  }, []);

  return null;
}
