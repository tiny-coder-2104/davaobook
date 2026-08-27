"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";

/**
 * BusinessProfile — editable operator account form (client component).
 *
 * Loads operator data from GET /api/admin/account on mount, lets the operator
 * edit business details, and persists changes via PUT /api/admin/account.
 *
 * logo_url and gcash_qr_url each expose a file upload to the `operator-assets`
 * Supabase Storage bucket. If the bucket is missing or the upload fails, the
 * manual URL text field remains the source of truth (graceful fallback), so
 * the field is always editable.
 */

const BUCKET = "package-images"; // ponytail: reuses existing public bucket; create operator-assets later if needed
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

interface AccountData {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  phone: string;
  email: string;
  gcash_number: string;
  gcash_qr_url: string | null;
  sms_sender_id: string;
  brand_color: string | null;
  notification_prefs: Record<string, unknown> | null;
}

type FormState = {
  name: string;
  phone: string;
  email: string;
  gcash_number: string;
  gcash_qr_url: string;
  sms_sender_id: string;
  brand_color: string;
  logo_url: string;
};

const EMPTY: FormState = {
  name: "",
  phone: "",
  email: "",
  gcash_number: "",
  gcash_qr_url: "",
  sms_sender_id: "",
  brand_color: "#2563eb",
  logo_url: "",
};

/* ── Small presentational helper to avoid repeating label+input markup ── */

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  inputMode?: "text" | "email" | "tel" | "url";
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink">{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-touch border border-gray-200 bg-surface px-3 py-2.5
                   text-ink placeholder:text-ink-muted/60 focus:border-brand
                   focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
    </label>
  );
}

export default function BusinessProfile() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [notifPrefs, setNotifPrefs] = useState<Record<string, unknown> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadErrors, setUploadErrors] = useState<{
    logo?: string;
    qr?: string;
  }>({});

  const setField = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSavedMsg(null);
  };

  // Load current operator profile.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch("/api/admin/account", {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || `Request failed (${res.status})`);
        }
        if (cancelled) return;
        const op: AccountData = data.operator;
        setForm({
          name: op.name ?? "",
          phone: op.phone ?? "",
          email: op.email ?? "",
          gcash_number: op.gcash_number ?? "",
          gcash_qr_url: op.gcash_qr_url ?? "",
          sms_sender_id: op.sms_sender_id ?? "",
          brand_color: HEX_RE.test(op.brand_color ?? "")
            ? op.brand_color!
            : "#2563eb",
          logo_url: op.logo_url ?? "",
        });
        setNotifPrefs(op.notification_prefs ?? null);
      } catch (e) {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : "Failed to load account");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSavedMsg(null);
    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        email: form.email,
        gcash_number: form.gcash_number,
        gcash_qr_url: form.gcash_qr_url || null,
        sms_sender_id: form.sms_sender_id,
        brand_color: form.brand_color,
        logo_url: form.logo_url || null,
        // notification_prefs intentionally omitted — left untouched (owned by
        // the Notifications section). Carrying it unchanged is unnecessary.
      };
      const res = await fetch("/api/admin/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Save failed (${res.status})`);
      }
      setSavedMsg("Saved");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // Upload a logo/QR image to Storage; on failure keep the manual URL field.
  const uploadFile = async (
    file: File,
    field: "logo_url" | "gcash_qr_url"
  ) => {
    const errKey = field === "logo_url" ? "logo" : "qr";
    setUploadErrors((u) => ({ ...u, [errKey]: undefined }));
    try {
      const supabase = createBrowserClient();
      const ext = file.name.split(".").pop() || "png";
      const path = `${field}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${ext}`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true });
      if (error) throw new Error(error.message);

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      if (!data?.publicUrl) throw new Error("Could not resolve public URL");

      setField(field, data.publicUrl);
    } catch (e) {
      // Graceful fallback: leave the text URL field editable and surface why.
      setUploadErrors((u) => ({
        ...u,
        [errKey]:
          e instanceof Error
            ? `${e.message} — paste the URL manually below.`
            : "Upload failed — paste the URL manually below.",
      }));
    }
  };

  if (loading) {
    return (
      <section className="bg-surface rounded-touch border border-gray-200 p-5 sm:p-6">
        <h2 className="font-heading font-semibold text-lg text-ink">
          Business profile
        </h2>
        <p className="mt-2 text-sm text-ink-muted">Loading…</p>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="bg-surface rounded-touch border border-gray-200 p-5 sm:p-6">
        <h2 className="font-heading font-semibold text-lg text-ink">
          Business profile
        </h2>
        <p className="mt-2 text-sm text-red-500">{loadError}</p>
      </section>
    );
  }

  const colorValue = HEX_RE.test(form.brand_color) ? form.brand_color : "#000000";

  return (
    <section className="bg-surface rounded-touch border border-gray-200 p-5 sm:p-6">
      <h2 className="font-heading font-semibold text-lg text-ink">
        Business profile
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        These details appear on your booking page and receipts.
      </p>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextField
          label="Business name"
          value={form.name}
          onChange={(v) => setField("name", v)}
        />
        <TextField
          label="Phone"
          value={form.phone}
          onChange={(v) => setField("phone", v)}
          type="tel"
          inputMode="tel"
        />
        <TextField
          label="Email"
          value={form.email}
          onChange={(v) => setField("email", v)}
          type="email"
          inputMode="email"
        />
        <TextField
          label="SMS sender ID"
          value={form.sms_sender_id}
          onChange={(v) => setField("sms_sender_id", v)}
          placeholder="e.g. DAVAOBOOK"
        />
        <TextField
          label="GCash number"
          value={form.gcash_number}
          onChange={(v) => setField("gcash_number", v)}
          type="tel"
          inputMode="tel"
          placeholder="09XXXXXXXXX"
        />
      </div>

      {/* Brand color: color picker synced with a hex text field */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
        <label className="block">
          <span className="block text-sm font-medium text-ink">Brand color</span>
          <span className="mt-1 flex items-center gap-3">
            <input
              type="color"
              value={colorValue}
              onChange={(e) => setField("brand_color", e.target.value)}
              className="h-11 w-14 rounded-touch border border-gray-200 bg-surface cursor-pointer"
              aria-label="Brand color picker"
            />
            <input
              type="text"
              value={form.brand_color}
              onChange={(e) => setField("brand_color", e.target.value)}
              placeholder="#2563eb"
              className="w-32 rounded-touch border border-gray-200 bg-surface px-3 py-2.5
                         text-ink placeholder:text-ink-muted/60 focus:border-brand
                         focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </span>
        </label>
      </div>

      {/* Logo upload + manual URL */}
      <div className="mt-4">
        <TextField
          label="Logo URL"
          value={form.logo_url}
          onChange={(v) => setField("logo_url", v)}
          type="url"
          inputMode="url"
          placeholder="https://…"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {form.logo_url ? (
            <img
              src={form.logo_url}
              alt="Logo preview"
              className="h-14 w-14 rounded-touch border border-gray-200 object-cover"
            />
          ) : null}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadFile(f, "logo_url");
              e.target.value = "";
            }}
            className="text-sm text-ink-muted file:mr-3 file:rounded-touch file:border-0
                       file:bg-brand/10 file:px-3 file:py-2 file:text-brand file:cursor-pointer"
          />
        </div>
        {uploadErrors.logo ? (
          <p className="mt-1 text-xs text-red-500">{uploadErrors.logo}</p>
        ) : null}
      </div>

      {/* GCash QR upload + manual URL */}
      <div className="mt-4">
        <TextField
          label="GCash QR URL"
          value={form.gcash_qr_url}
          onChange={(v) => setField("gcash_qr_url", v)}
          type="url"
          inputMode="url"
          placeholder="https://…"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {form.gcash_qr_url ? (
            <img
              src={form.gcash_qr_url}
              alt="GCash QR preview"
              className="h-14 w-14 rounded-touch border border-gray-200 object-cover"
            />
          ) : null}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadFile(f, "gcash_qr_url");
              e.target.value = "";
            }}
            className="text-sm text-ink-muted file:mr-3 file:rounded-touch file:border-0
                       file:bg-brand/10 file:px-3 file:py-2 file:text-brand file:cursor-pointer"
          />
        </div>
        {uploadErrors.qr ? (
          <p className="mt-1 text-xs text-red-500">{uploadErrors.qr}</p>
        ) : null}
      </div>

      {/* Save bar */}
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary min-h-touch px-5 rounded-touch font-medium
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {savedMsg ? (
          <span className="text-sm text-status-confirmed">{savedMsg}</span>
        ) : null}
        {saveError ? (
          <span className="text-sm text-red-500">{saveError}</span>
        ) : null}
      </div>
    </section>
  );
}
