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
  const { data: operator } = await supabase
    .from("operators")
    .select("*")
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
        <p className="font-heading font-semibold text-lg text-ink">
          This is a live demo. Get your own branded booking page in minutes.
        </p>
        <Link
          href="/auth/signup"
          className="mt-4 inline-flex min-h-touch items-center justify-center rounded-touch bg-brand px-8 py-3 text-sm font-semibold text-white hover:bg-brand-hover transition-colors"
        >
          Create Operator Account
        </Link>
        <p className="mt-3 text-xs text-ink-muted">Powered by DavaoBook</p>
        <Link
          href="/track"
          className="mt-1 inline-block text-xs text-ink-muted hover:text-brand transition-colors"
        >
          Track my booking
        </Link>
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