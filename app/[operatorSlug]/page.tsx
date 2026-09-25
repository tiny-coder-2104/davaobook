import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "../../lib/supabase";
import type { Operator, Package } from "../../lib/types";
import TrustStrip from "../components/TrustStrip";
import PackageCard from "../components/PackageCard";

export const revalidate = 60;

export default async function OperatorLanding({
  params,
}: {
  params: { operatorSlug: string };
}) {
  // Public columns only — must stay ⊆ the GRANT set in
  // supabase/migrations/009_operators_public_grants.sql (a wildcard SELECT
  // fails under column-level grants; phone/email/gcash are private).
  const { data: operator } = await supabase
    .from("operators")
    .select("id, name, slug, logo_url, brand_color, verified, created_at")
    .eq("slug", params.operatorSlug)
    .single();

  if (!operator) notFound();

  const op = operator as Operator;

  const { data: packages } = await supabase
    .from("packages")
    .select("*")
    .eq("operator_id", op.id)
    .eq("active", true);

  const pkgList: Package[] = (packages ?? []) as Package[];

  return (
    <main className="px-4 py-8 md:py-10 max-w-5xl mx-auto">
      <TrustStrip operator={op} />

      {pkgList.length === 0 ? (
        <p className="text-ink-muted mt-8">No packages available.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pkgList.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
      )}

      <footer className="mt-12 border-t border-gray-100 pt-10 pb-8 text-center">
        <a
          href="/track"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-ink-muted/25 px-5 min-h-[44px] text-sm font-medium text-[#2d6a4f] transition-colors hover:border-[#2d6a4f]/40 hover:bg-[#2d6a4f]/5 md:w-auto"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[#2d6a4f]"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
            <path d="m9 16 2 2 4-4" />
          </svg>
          Track my booking
        </a>
        <p className="font-heading font-semibold text-lg text-ink">
          This is a live demo. Get your own branded booking page in minutes.
        </p>
        <Link
          href={`/${op.slug}/dashboard`}
          className="mt-4 inline-block text-xs text-ink-muted hover:text-brand transition-colors"
        >
          Operator login
        </Link>
        <p className="mt-3 text-xs text-ink-muted">Powered by DavaoBook</p>
        <a
          href="https://welcome-tinycoder-studio.vercel.app"
          target="_blank"
          rel="noopener"
          className="mt-1 inline-block text-xs text-ink-muted hover:text-brand transition-colors"
        >
          Built by TinyCoder Studio
        </a>
      </footer>
    </main>
  );
}