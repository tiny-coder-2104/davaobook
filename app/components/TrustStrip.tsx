import Link from "next/link";
import type { Operator } from "../../lib/types";
import VerifiedBadge from "./VerifiedBadge";

export default function TrustStrip({ operator }: { operator: Operator | null }) {
  const title = operator?.name ?? "SeaClouds Mountain View Resort";
  const brandHref = operator?.slug ? `/${operator.slug}` : "/";

  return (
    <header className="mb-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        {/* Branding left — links to this operator's landing */}
        <Link href={brandHref} className="flex gap-3">
          {/* ponytail: gray placeholder box, emoji keeps it zero-asset */}
          <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border bg-gray-200">
            <span aria-hidden="true" className="text-base leading-none">
              ⛰️
            </span>
            <span className="text-[7px] font-medium uppercase tracking-wide text-gray-500">
              Your Logo
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-2xl font-bold leading-tight text-ink">
                {title}
              </h1>
              {operator?.verified && <VerifiedBadge />}
            </div>
            <p className="mt-0.5 text-sm text-ink-muted">
              Confirmed bookings • Instant SMS updates • Easy online booking
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Confirmed bookings
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                SMS updates
              </span>
            </div>
          </div>
        </Link>
      </div>
    </header>
  );
}
