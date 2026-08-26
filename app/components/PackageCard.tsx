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
      className="group block rounded-touch overflow-hidden bg-surface shadow-sm hover:shadow-md transition-shadow"
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
        <h2 className="font-heading font-semibold text-lg group-hover:text-brand transition-colors">
          {pkg.name}
        </h2>

        <p className="mt-1 text-ink-muted text-sm">
          From {formatPrice(from)}/pax
        </p>

        {pkg.days_of_week.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {pkg.days_of_week
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
      </div>
    </Link>
  );
}
