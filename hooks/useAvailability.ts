"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface DayAvailability {
  date: string;
  status: "available" | "few-left" | "full" | "closed";
  remaining: number;
}

interface AvailabilityCache {
  [key: string]: DayAvailability[];
}

// Ponytail: simple in-memory cache; evicts on page reload which is fine for
// a booking flow that rarely re-queries the same month twice.
const _cache: AvailabilityCache = {};

export function useAvailability(pkgSlug: string, month: number, year: number) {
  const [availability, setAvailability] = useState<DayAvailability[]>(
    _cache[cacheKey(pkgSlug, month, year)] ?? []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Avoid stale closures
  const abortRef = useRef<AbortController | null>(null);

  const fetchAvailability = useCallback(async () => {
    const key = cacheKey(pkgSlug, month, year);

    // Serve from cache
    if (_cache[key]) {
      setAvailability(_cache[key]);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/packages/${pkgSlug}/availability?month=${month}&year=${year}`,
        { signal: controller.signal }
      );

      if (!res.ok) {
        throw new Error(`Availability fetch failed: ${res.status}`);
      }

      const data = await res.json();
      const days: DayAvailability[] = data.availability ?? [];

      _cache[key] = days;
      setAvailability(days);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to load availability");
    } finally {
      setLoading(false);
    }
  }, [pkgSlug, month, year]);

  useEffect(() => {
    fetchAvailability();
    return () => abortRef.current?.abort();
  }, [fetchAvailability]);

  // Convert array to map for O(1) lookup
  const availabilityMap = availability.reduce<
    Record<string, DayAvailability>
  >((acc, day) => {
    acc[day.date] = day;
    return acc;
  }, {});

  return { availability, availabilityMap, loading, error, refetch: fetchAvailability };
}

function cacheKey(slug: string, month: number, year: number): string {
  return `${slug}-${year}-${month}`;
}
