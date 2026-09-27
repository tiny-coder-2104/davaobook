import { PackageTier } from "./types";

/* ── Rates on request ────────────────────────────────────────────────
 * 0 / missing = no published rate (demo rooms have no verified rates).
 * Every money display routes through hasRate() + these labels so an
 * unpriced room/booking never renders as ₱0 or an invented figure.
 * ponytail: 0 is the sentinel (bookings.total_amount is NOT NULL, so a
 * real booking can't be NULL) — swap for a nullable column if a package
 * ever needs a genuinely free rate. */

export const RATE_ON_REQUEST = "Message for rates";
export const TOTAL_ON_REQUEST = "To be confirmed by the resort";

/** True only for a real, positive amount. */
export function hasRate(amount: number | null | undefined): boolean {
  return typeof amount === "number" && amount > 0;
}

/** Lowest published nightly rate across tiers, or null when none published. */
export function lowestRate(tiers: PackageTier[]): number | null {
  const prices = (tiers ?? [])
    .map((t) => t.price_per_pax)
    .filter((p): p is number => hasRate(p));
  return prices.length > 0 ? Math.min(...prices) : null;
}

/**
 * Finds the matching tier for a given pax count and returns the price.
 * Tiers are ordered by min_pax; the first matching tier wins.
 *
 * Rooms are priced FLAT per night: the tier price is the nightly rate for
 * the tier's guest capacity, NOT per guest. Total = nightly rate x nights
 * within the tier. (DB field stays price_per_pax — no schema change.)
 *
 * @param nights consecutive nights (default 1 = legacy single-day behavior)
 * @returns { pricePerPax, total } or null if no tier matches OR the tier
 *          has no published rate (rates on request)
 */
export function calculateTierPrice(
  tiers: PackageTier[],
  pax: number,
  nights = 1
): { pricePerPax: number; total: number } | null {
  const tier = tiers.find((t) => pax >= t.min_pax && pax <= t.max_pax);
  if (!tier || !hasRate(tier.price_per_pax)) return null;
  const pricePerPax = tier.price_per_pax as number;
  return {
    pricePerPax,
    total: pricePerPax * nights,
  };
}

/** True when some tier matches this pax count (regardless of rate). */
export function hasTierForPax(tiers: PackageTier[], pax: number): boolean {
  return tiers.some((t) => pax >= t.min_pax && pax <= t.max_pax);
}

/**
 * Write boundary for packages.tiers: price_per_pax is always a number >= 0
 * (0 = rates on request). create_booking_transactional does arithmetic on it
 * and bookings.total_amount is NOT NULL — a null/NaN price would 500 the
 * booking flow, so both package write routes run tiers through this.
 */
export function normalizeTiers(tiers: unknown): PackageTier[] {
  if (!Array.isArray(tiers)) return [];
  return tiers.map((t) => {
    const tier = (t ?? {}) as Partial<PackageTier>;
    return {
      min_pax: Number(tier.min_pax) > 0 ? Number(tier.min_pax) : 1,
      max_pax: Number(tier.max_pax) > 0 ? Number(tier.max_pax) : 1,
      price_per_pax: Number(tier.price_per_pax) > 0 ? Number(tier.price_per_pax) : 0,
    };
  });
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
