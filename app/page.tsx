import { redirect } from "next/navigation";
import { supabase } from "../lib/supabase";

// Resolves the home redirect from the operators table — mutable, and a stale
// slug here bounces every visitor to the wrong resort (QA 0043 fetch cache).
export const revalidate = 60;
export const fetchCache = "force-no-store";

export default async function Home() {
  // Oldest operator = seed/demo operator; its landing is the public home.
  const { data: operators } = await supabase
    .from("operators")
    .select("slug")
    .order("created_at", { ascending: true })
    .limit(1);

  const slug = operators?.[0]?.slug;
  if (!slug) redirect("/auth/login"); // no operators yet — nothing to show

  redirect(`/${slug}`);
}