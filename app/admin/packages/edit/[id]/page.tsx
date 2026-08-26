"use client";

import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import PackageForm, { type PackageFormData } from "@/app/components/PackageForm";
import type { Package } from "@/lib/types";

export default function EditPackagePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [pkg, setPkg] = useState<Package | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // Fetch all packages, find the one we need
        // ponytail: no single-package GET endpoint; list + filter is fine for admin
        const res = await fetch("/api/admin/packages");
        if (res.ok) {
          const data = await res.json();
          const found = data.packages.find((p: Package) => p.id === id);
          if (found) {
            setPkg(found);
          } else {
            setError("Package not found");
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleSubmit(data: PackageFormData) {
    setError(null);
    const res = await fetch(`/api/admin/packages/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || "Failed to update package");
    }

    router.push("/admin/packages");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-24" />
          <div className="h-6 bg-gray-200 rounded w-48" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-touch" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !pkg) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <p className="text-ink-muted">{error || "Package not found"}</p>
        <button
          type="button"
          onClick={() => router.push("/admin/packages")}
          className="mt-4 text-sm text-brand hover:underline"
        >
          Back to packages
        </button>
      </div>
    );
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

      <h2 className="font-heading font-bold text-xl mb-4">
        Edit: {pkg.name}
      </h2>

      <PackageForm
        initial={{
          name: pkg.name,
          description: pkg.description,
          photo_url: pkg.photo_url,
          tiers: pkg.tiers,
          days_of_week: pkg.days_of_week,
          capacity_per_day: pkg.capacity_per_day,
          downpayment_pct: pkg.downpayment_pct,
          cutoff_hours: pkg.cutoff_hours,
          dp_refundable: pkg.dp_refundable,
        }}
        onSubmit={handleSubmit}
        submitLabel="Save changes"
      />
    </div>
  );
}
