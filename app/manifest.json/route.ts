import { NextResponse } from "next/server";

/**
 * GET /manifest.json — Dynamic PWA manifest per operator.
 *
 * Query params:
 *   ?slug={operator_slug}  — looks up operator by slug
 *   No param → falls back to default "DavaoBook" branding
 *
 * ponytail: per-tenant lookup via DB on every request is fine at this scale;
 * add Redis/LRU cache if manifest endpoint becomes a hot path.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  // Default branding — swapped for DB lookup when operator routing is wired
  let operatorName = "DavaoBook";
  let themeColor = "#16a34a"; // green default

  if (slug) {
    // ponytail: direct import to avoid circular dep; swap for supabase query later
    try {
      const { supabaseAdmin } = await import("@/lib/supabase-server");
      const { data } = await supabaseAdmin
        .from("operators")
        .select("name, slug")
        .eq("slug", slug)
        .eq("active", true)
        .single();

      if (data) {
        operatorName = data.name;
      }
    } catch {
      // fall through to defaults — unconfigured operator gets generic manifest
    }
  }

  const manifest = {
    name: `${operatorName} Booking`,
    short_name: operatorName.length > 12 ? operatorName.slice(0, 12) : operatorName,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: themeColor,
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
