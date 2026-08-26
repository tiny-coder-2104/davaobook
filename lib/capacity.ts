import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Non-transactional capacity check — use for UI display (booking form).
 * The actual transactional check lives in the DB function called by the API route.
 */
export async function checkCapacity(
  supabase: SupabaseClient,
  packageId: string,
  tourDate: string,
  pax: number
): Promise<{ available: boolean; remaining: number }> {
  const { data: pkg } = await supabase
    .from("packages")
    .select("capacity_per_day")
    .eq("id", packageId)
    .single();

  if (!pkg) return { available: false, remaining: 0 };

  const { count } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("package_id", packageId)
    .eq("tour_date", tourDate)
    .in("status", ["PENDING_PAYMENT", "PENDING_CONFIRMATION", "CONFIRMED"]);

  const booked = count ?? 0;
  const remaining = Math.max(0, pkg.capacity_per_day - booked);

  return { available: remaining >= pax, remaining };
}
