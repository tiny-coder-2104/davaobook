import Link from "next/link";
import { supabase } from "../lib/supabase";
import type { Operator, Package } from "../lib/types";
import TrustStrip from "./components/TrustStrip";
import PackageCard from "./components/PackageCard";

export const revalidate = 60;

export default async function Home() {
  // Fetch first operator with their packages
  const { data: operators } = await supabase
    .from("operators")
    .select("*")
    .limit(1);

  const operator: Operator | null = operators?.[0] ?? null;

  if (!operator) {
    return (
      <main className="px-4 py-8">
        <p className="text-ink-muted">No operators found.</p>
      </main>
    );
  }

  const { data: packages } = await supabase
    .from("packages")
    .select("*")
    .eq("operator_id", operator.id)
    .eq("active", true);

  const pkgList: Package[] = (packages ?? []) as Package[];

  return (
    <main className="px-4 py-8 max-w-5xl mx-auto">
      <header className="flex items-center justify-end gap-6 pb-8">
        <Link
          href="/auth/login"
          className="text-brand text-sm font-medium hover:underline"
        >
          Operator sign in
        </Link>
        <Link
          href="/auth/signup"
          className="text-ink-muted text-sm font-medium hover:text-brand"
        >
          Create an operator account
        </Link>
      </header>

      <TrustStrip operator={operator} />

      {pkgList.length === 0 ? (
        <p className="text-ink-muted mt-8">No packages available.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pkgList.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
      )}
    </main>
  );
}
