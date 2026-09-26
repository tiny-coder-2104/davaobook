import { PackageTier } from "./types";

/**
 * Finds the matching tier for a given pax count and returns the price.
 * Tiers are ordered by min_pax; the first matching tier wins.
 *
 * Rooms are priced FLAT per night: the tier price is the nightly rate for
 * the tier's guest capacity, NOT per guest. Total = nightly rate x nights
 * within the tier. (DB field stays price_per_pax — no schema change.)
 *
 * @param nights consecutive nights (default 1 = legacy single-day behavior)
 * @returns { pricePerPax, total } or null if no tier matches
 */
export function calculateTierPrice(
  tiers: PackageTier[],
  pax: number,
  nights = 1
): { pricePerPax: number; total: number } | null {
  const tier = tiers.find((t) => pax >= t.min_pax && pax <= t.max_pax);
  if (!tier) return null;
  return {
    pricePerPax: tier.price_per_pax,
    total: tier.price_per_pax * nights,
  };
}

/**
 * capacity_per_day is DERIVED from the tiers — the operator no longer sets it
 * (the widest tier's max_pax IS the cap). Never returns 0: the column is read
 * by create_booking_transactional's capacity check, and 0 would block every
 * booking. `fallback` keeps the stored value when tiers are empty/unusable.
 */
export function deriveCapacityPerDay(
  tiers: PackageTier[] | null | undefined,
  fallback = 1
): number {
  const max = Array.isArray(tiers)
    ? Math.max(...tiers.map((t) => Number(t?.max_pax) || 0))
    : 0;
  return max >= 1 ? Math.floor(max) : Math.max(1, fallback);
}
