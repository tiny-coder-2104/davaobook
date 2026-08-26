import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import type { Operator, Package, PackageTier } from "../../../lib/types";

export const revalidate = 60;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatPrice(amount: number): string {
  return `₱${amount.toLocaleString("en-PH")}`;
}

function TierTable({ tiers }: { tiers: PackageTier[] }) {
  if (tiers.length === 0) return null;
  const sorted = [...tiers].sort((a, b) => a.min_pax - b.min_pax);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-ink-muted">
            <th className="py-2 font-medium">Pax</th>
            <th className="py-2 font-medium text-right">Price / pax</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((tier, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-2">
                {tier.min_pax}
                {tier.max_pax > tier.min_pax ? `–${tier.max_pax}` : ""} pax
              </td>
              <td className="py-2 text-right font-medium">
                {formatPrice(tier.price_per_pax)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function PackageDetail({
  params,
}: {
  params: { pkg: string };
}) {
  // Fetch by slug
  const { data: pkg } = await supabase
    .from("packages")
    .select("*")
    .eq("slug", params.pkg)
    .eq("active", true)
    .single();

  if (!pkg) notFound();

  const pkgData = pkg as Package;

  const { data: operators } = await supabase
    .from("operators")
    .select("*")
    .eq("id", pkgData.operator_id)
    .single();

  const operator = operators as Operator | null;

  return (
    <main className="pb-24">
      {/* Hero image */}
      <div className="relative w-full aspect-[16/9] bg-gray-100">
        {pkgData.photo_url ? (
          <Image
            src={pkgData.photo_url}
            alt={pkgData.name}
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        ) : (
          <div className="flex items-center justify-center h-full text-ink-muted">
            No photo
          </div>
        )}
      </div>

      <div className="px-4 py-6 max-w-3xl mx-auto">
        {/* Operator name */}
        {operator && (
          <p className="text-sm text-ink-muted mb-1">{operator.name}</p>
        )}

        <h1 className="font-heading text-2xl font-bold">{pkgData.name}</h1>

        {/* Days available */}
        {pkgData.days_of_week.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {pkgData.days_of_week
              .sort((a, b) => a - b)
              .map((d) => (
                <span
                  key={d}
                  className="inline-block rounded-full bg-brand/10 text-brand text-xs font-medium px-2 py-0.5"
                >
                  {DAYS[d]}
                </span>
              ))}
          </div>
        )}

        {/* Tier pricing table */}
        <section className="mt-6">
          <h2 className="font-heading font-semibold text-lg mb-3">
            Pricing
          </h2>
          <TierTable tiers={pkgData.tiers} />
        </section>

        {/* Itinerary accordion — ponytail: native <details>, zero JS */}
        {pkgData.description && (
          <section className="mt-6">
            <details className="group">
              <summary className="font-heading font-semibold text-lg cursor-pointer list-none flex items-center justify-between">
                Itinerary
                <span className="text-ink-muted text-sm group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <div className="mt-3 text-ink-muted whitespace-pre-line text-sm leading-relaxed">
                {pkgData.description}
              </div>
            </details>
          </section>
        )}
      </div>

      {/* Sticky bottom CTA — safe-area padding via env() */}
      <div
        className="fixed bottom-0 inset-x-0 bg-surface border-t border-gray-200 z-50"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="px-4 py-3 max-w-3xl mx-auto">
          <Link
            href={`/p/${pkgData.slug}/book`}
            className="btn-primary w-full text-center block"
          >
            Book now
          </Link>
        </div>
      </div>
    </main>
  );
}
