"use client";

import { useCallback, useEffect, useState } from "react";

type NotificationPrefs = {
  new_booking: boolean;
  payment_received: boolean;
  weather_cancel: boolean;
  reminders: boolean;
  email_digest: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  new_booking: true,
  payment_received: true,
  weather_cancel: true,
  reminders: true,
  email_digest: false,
};

const CHANNELS: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
  {
    key: "new_booking",
    label: "New booking alert (SMS)",
    hint: "Get notified the moment a guest books.",
  },
  {
    key: "payment_received",
    label: "Payment received (SMS)",
    hint: "Alert when a GCash payment is confirmed.",
  },
  {
    key: "weather_cancel",
    label: "Weather cancellation blast (SMS)",
    hint: "Blast guests if a tour is cancelled due to weather.",
  },
  {
    key: "reminders",
    label: "Tour reminders (SMS)",
    hint: "Send an automatic T-24h reminder to guests.",
  },
  {
    key: "email_digest",
    label: "Email digest",
    hint: "Daily summary of your bookings by email.",
  },
];

export default function Notifications() {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [saving, setSaving] = useState<Partial<Record<keyof NotificationPrefs, boolean>>>({});
  const [error, setError] = useState<string | null>(null);

  // Load current prefs on mount.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/account")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { operator?: { notification_prefs?: Partial<NotificationPrefs> } }) => {
        if (cancelled) return;
        const stored = data?.operator?.notification_prefs ?? {};
        // Merge over defaults so missing keys still render with a sane value.
        setPrefs({ ...DEFAULT_PREFS, ...stored });
      })
      .catch(() => {
        if (!cancelled) setError("Could not load notification settings.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(
    async (key: keyof NotificationPrefs) => {
      if (!prefs) return;
      const previous = prefs[key];
      const next: NotificationPrefs = { ...prefs, [key]: !previous };

      // Optimistic update.
      setPrefs(next);
      setSaving((s) => ({ ...s, [key]: true }));
      setError(null);

      try {
        const res = await fetch("/api/admin/account", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notification_prefs: next }),
        });
        if (!res.ok) throw new Error("save_failed");
      } catch {
        // Revert on failure and surface a message.
        setPrefs((p) => (p ? { ...p, [key]: previous } : p));
        setError("Could not save that change. Reverted.");
      } finally {
        setSaving((s) => ({ ...s, [key]: false }));
      }
    },
    [prefs]
  );

  if (!prefs) {
    return (
      <section className="bg-surface rounded-touch border border-gray-200 p-5 sm:p-6">
        <h2 className="font-heading font-semibold text-lg text-ink">Notifications</h2>
        <p className="mt-2 text-sm text-ink-muted">Loading…</p>
      </section>
    );
  }

  return (
    <section className="bg-surface rounded-touch border border-gray-200 p-5 sm:p-6">
      <h2 className="font-heading font-semibold text-lg text-ink">Notifications</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Choose which alerts you want to receive. Changes save automatically.
      </p>

      {error && (
        <div className="mt-4 rounded-touch border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-5 divide-y divide-gray-100">
        {CHANNELS.map(({ key, label, hint }) => {
          const on = prefs[key];
          const isSaving = saving[key];
          return (
            <div key={key} className="flex items-center justify-between gap-4 py-4">
              <div className="min-w-0">
                <p className="font-medium text-ink">{label}</p>
                <p className="mt-0.5 text-sm text-ink-muted">{hint}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={label}
                disabled={isSaving}
                onClick={() => toggle(key)}
                className={[
                  "relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full",
                  "transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand",
                  on ? "bg-brand" : "bg-gray-300",
                  isSaving ? "opacity-60 cursor-wait" : "",
                ].join(" ")}
              >
                <span
                  className={[
                    "inline-block h-5 w-5 transform rounded-full bg-white shadow",
                    "transition-transform duration-200",
                    on ? "translate-x-6" : "translate-x-1",
                  ].join(" ")}
                />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
