/**
 * localStorage helper for offline voucher access.
 * Caches voucher data on confirmed visits so the page
 * can render without network (spec §9: network-first with cached fallback).
 */

export interface CachedVoucher {
  code: string;
  status: string;
  tour_date: string;
  pax: number;
  guest_name: string;
  mobile: string;
  pickup_area: string;
  notes: string | null;
  package_name: string;
  operator_name: string;
  operator_phone: string;
  operator_email: string;
  total_amount: number;
  cached_at: string; // ISO timestamp
}

const STORAGE_KEY = "davaobook_vouchers";

function _getAll(): Record<string, CachedVoucher> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Save voucher data to localStorage. Adds cached_at automatically. */
export function cacheVoucher(data: Omit<CachedVoucher, "cached_at">): void {
  try {
    const all = _getAll();
    all[data.code] = { ...data, cached_at: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // ponytail: storage full or unavailable — silent fail, not critical
  }
}

/** Retrieve cached voucher by booking code, or null. */
export function getCachedVoucher(code: string): CachedVoucher | null {
  const all = _getAll();
  return all[code] ?? null;
}

/** Remove a specific cached voucher. */
export function clearCachedVoucher(code: string): void {
  try {
    const all = _getAll();
    delete all[code];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // silent fail
  }
}
