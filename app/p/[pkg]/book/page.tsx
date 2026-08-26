import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Package } from "@/lib/types";
import BookingFormFlow from "@/app/components/BookingFormFlow";

export const revalidate = 60;

export default async function BookPackage({
  params,
}: {
  params: { pkg: string };
}) {
  const { data: pkg } = await supabase
    .from("packages")
    .select("*")
    .eq("slug", params.pkg)
    .eq("active", true)
    .single();

  if (!pkg) notFound();

  const pkgData = pkg as Package;

  // Fetch operator data for GCash details
  const { data: operator } = await supabase
    .from("operators")
    .select("gcash_qr_url, gcash_number")
    .eq("id", pkgData.operator_id)
    .single();

  return (
    <main className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="px-4 pt-6 pb-2">
        <h1 className="font-heading text-xl font-bold">{pkgData.name}</h1>
        <p className="text-ink-muted text-sm mt-1">
          Select a date and group size
        </p>
      </div>

      {/* Full booking flow: picker → form → payment → confirm → success */}
      <BookingFormFlow
        pkgId={pkgData.id}
        pkgSlug={pkgData.slug}
        pkgName={pkgData.name}
        tiers={pkgData.tiers}
        downpaymentPct={pkgData.downpayment_pct}
        operatorGcashQrUrl={operator?.gcash_qr_url ?? null}
        operatorGcashNumber={operator?.gcash_number ?? null}
      />
    </main>
  );
}
