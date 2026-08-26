import { PackageTier } from "./types";

/**
 * Finds the matching tier for a given pax count and returns the price.
 * Tiers are ordered by min_pax; the first matching tier wins.
 *
 * @returns { pricePerPax, total } or null if no tier matches
 */
export function calculateTierPrice(
  tiers: PackageTier[],
  pax: number
): { pricePerPax: number; total: number } | null {
  const tier = tiers.find((t) => pax >= t.min_pax && pax <= t.max_pax);
  if (!tier) return null;
  return {
    pricePerPax: tier.price_per_pax,
    total: tier.price_per_pax * pax,
  };
}
