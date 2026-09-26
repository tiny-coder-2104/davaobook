import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Package } from "@/lib/types";
import BookingFormFlow from "@/app/components/BookingFormFlow";

// Same staleness class as /p/[pkg] and /b/[code] (QA 0043): the packages.active
// filter must take effect on the next request, so pin the fetch to no-store.
export const revalidate = 60;
export const fetchCache = "force-no-store";

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

  return (
    <main className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="px-4 pt-6 pb-2">
        <h1 className="font-heading text-xl font-bold">{pkgData.name}</h1>
        <p className="text-ink-muted text-sm mt-1">
          Select a date and group size
        </p>
      </div>

      {/* Full booking flow: picker → details → confirm → success */}
      <BookingFormFlow
        pkgId={pkgData.id}
        pkgSlug={pkgData.slug}
        pkgName={pkgData.name}
        tiers={pkgData.tiers}
        maxNights={pkgData.max_nights}
      />
    </main>
  );
}
