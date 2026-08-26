import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * GET /api/admin/packages — List packages for the authenticated operator.
 */
export async function GET(request: NextRequest) {
  const operatorId = request.headers.get("x-operator-id");
  if (!operatorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("packages")
    .select("*")
    .eq("operator_id", operatorId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ packages: data ?? [] });
}

/**
 * POST /api/admin/packages — Create a new package.
 * Body: { name, description?, photo_url?, tiers, days_of_week,
 *         capacity_per_day, downpayment_pct, cutoff_hours, dp_refundable }
 */
export async function POST(request: NextRequest) {
  const operatorId = request.headers.get("x-operator-id");
  if (!operatorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      description,
      photo_url,
      tiers,
      days_of_week,
      capacity_per_day,
      downpayment_pct,
      cutoff_hours,
      dp_refundable,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!tiers || !Array.isArray(tiers) || tiers.length === 0) {
      return NextResponse.json(
        { error: "At least one pricing tier is required" },
        { status: 400 }
      );
    }

    // Generate slug from name
    let slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50);

    // Check slug uniqueness within operator
    const { data: existing } = await supabaseAdmin
      .from("packages")
      .select("id")
      .eq("operator_id", operatorId)
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }

    const { data, error } = await supabaseAdmin
      .from("packages")
      .insert({
        operator_id: operatorId,
        name: name.trim(),
        slug,
        description: description || "",
        photo_url: photo_url || null,
        tiers,
        days_of_week: days_of_week ?? [0, 1, 2, 3, 4, 5, 6],
        capacity_per_day: capacity_per_day ?? 20,
        downpayment_pct: downpayment_pct ?? 0,
        cutoff_hours: cutoff_hours ?? 24,
        dp_refundable: dp_refundable ?? false,
        active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ package: data }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
