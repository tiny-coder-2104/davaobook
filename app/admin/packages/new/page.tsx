"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import PackageForm, { type PackageFormData } from "@/app/components/PackageForm";

export default function NewPackagePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(data: PackageFormData) {
    setError(null);
    const res = await fetch("/api/admin/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || "Failed to create package");
    }

    router.push("/admin/packages");
    router.refresh();
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-brand font-medium flex items-center gap-1 hover:underline"
        >
          ← Back
        </button>
      </div>

      <h2 className="font-heading font-bold text-xl mb-4">New Package</h2>

      {error && (
        <div className="mb-4 p-3 rounded-touch bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      <PackageForm onSubmit={handleSubmit} submitLabel="Create package" />
    </div>
  );
}
