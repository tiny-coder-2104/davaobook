"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * A2HS install banner for operators.
 *
 * Shows after 2nd visit (visit count in localStorage).
 * Uses the native `beforeinstallprompt` event — no libraries needed.
 * ponytail: no dismiss-persistence; banner reappears on next visit after dismiss.
 * Add persistent dismiss (localStorage flag) when users complain.
 */

const VISIT_KEY = "davaobook_visits";
const DISMISS_KEY = "davaobook_install_dismissed";

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if previously dismissed
    if (localStorage.getItem(DISMISS_KEY)) return;

    // Track visit count
    const count = parseInt(localStorage.getItem(VISIT_KEY) || "0", 10) + 1;
    localStorage.setItem(VISIT_KEY, String(count));

    // Only show after 2nd visit
    if (count < 2) return;

    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, "1");
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 rounded-xl bg-green-600 p-4 text-white shadow-lg sm:left-auto sm:right-4 sm:max-w-sm">
      <div className="flex-1">
        <p className="font-semibold text-sm">Install DavaoBook</p>
        <p className="text-xs opacity-90">Add to your home screen for the best experience</p>
      </div>
      <button
        onClick={handleInstall}
        className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-green-700 active:scale-95"
      >
        Install
      </button>
      <button
        onClick={handleDismiss}
        className="ml-1 text-lg opacity-70 active:opacity-100"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

/** Type for the beforeinstallprompt event (not in standard lib types yet). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
