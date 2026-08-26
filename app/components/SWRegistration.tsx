"use client";

import { useEffect } from "react";
import { drainQueue } from "@/lib/offline-queue";

/**
 * Registers the service worker and listens for online events
 * to drain the offline booking queue.
 *
 * ponytail: one useEffect, no extra abstraction. Add SW update
 * UI (skipWaiting prompt) when users need to see new versions.
 */
export default function SWRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {});

    // Drain offline queue when back online
    const handleOnline = () => {
      drainQueue().catch(() => {});
    };
    window.addEventListener("online", handleOnline);

    return () => window.removeEventListener("online", handleOnline);
  }, []);

  return null;
}
