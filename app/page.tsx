import { redirect } from "next/navigation";
import { supabase } from "../lib/supabase";

export const revalidate = 60;

export default async function Home() {
  // Oldest operator = seed/demo operator; its landing is the public home.
  const { data: operators } = await supabase
    .from("operators")
    .select("slug")
    .order("created_at", { ascending: true })
    .limit(1);

  const slug = operators?.[0]?.slug;
  if (!slug) redirect("/auth/signup"); // no operators yet — nothing to show

  redirect(`/${slug}`);
}