import Image from "next/image";
import Link from "next/link";
import type { Package, PackageTier } from "../../lib/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function lowestPrice(tiers: PackageTier[]): number {
  if (tiers.length === 0) return 0;
  return Math.min(...tiers.map((t) => t.price_per_pax));
}

function formatPrice(amount: number): string {
  return `₱${amount.toLocaleString("en-PH")}`;
}

export default function PackageCard({ pkg }: { pkg: Package }) {
  const from = lowestPrice(pkg.tiers);

  return (
    <Link
      href={`/p/${pkg.slug}`}
      className="group block rounded-touch overflow-hidden bg-surface border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="relative aspect-[4/3] bg-gray-100">
        {pkg.photo_url ? (
          <Image
            src={pkg.photo_url}
            alt={pkg.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-ink-muted text-sm">
            No photo
          </div>
        )}
      </div>

      <div className="p-4">
        <h2 className="font-heading font-semibold text-lg leading-tight line-clamp-2 group-hover:text-brand transition-colors">
          {pkg.name}
        </h2>

        <p className="mt-2 text-sm">
          <span className="text-ink-muted">From </span>
          <span className="font-bold text-base text-ink">{formatPrice(from)}</span>
          <span className="text-ink-muted">/pax</span>
        </p>

        {pkg.days_of_week.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {pkg.days_of_week
              .sort((a, b) => a - b)
              .map((d) => (
                <span
                  key={d}
                  className="inline-block rounded-full bg-brand/10 text-brand text-[11px] font-medium px-1.5 py-0.5"
                >
                  {DAYS[d]}
                </span>
              ))}
          </div>
        )}

        {/* ponytail: span styled as button to avoid nested <a> inside outer Link */}
        <span className="mt-4 block w-full text-center bg-brand text-white font-semibold rounded-touch py-2.5 text-sm group-hover:bg-brand-hover transition-colors">
          Book Now
        </span>
      </div>
    </Link>
  );
}
