import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * PUT /api/admin/packages/[id] — Update a package.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const operatorId = request.headers.get("x-operator-id");
  if (!operatorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  // Verify ownership
  const { data: existing } = await supabaseAdmin
    .from("packages")
    .select("id")
    .eq("id", id)
    .eq("operator_id", operatorId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
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
      active,
    } = body;

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (photo_url !== undefined) updates.photo_url = photo_url || null;
    if (tiers !== undefined) updates.tiers = tiers;
    if (days_of_week !== undefined) updates.days_of_week = days_of_week;
    if (capacity_per_day !== undefined) updates.capacity_per_day = capacity_per_day;
    if (downpayment_pct !== undefined) updates.downpayment_pct = downpayment_pct;
    if (cutoff_hours !== undefined) updates.cutoff_hours = cutoff_hours;
    if (dp_refundable !== undefined) updates.dp_refundable = dp_refundable;
    if (active !== undefined) updates.active = active;

    // Update slug if name changed
    if (name !== undefined) {
      let slug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 50);

      // Check slug uniqueness (excluding current package)
      const { data: slugConflict } = await supabaseAdmin
        .from("packages")
        .select("id")
        .eq("operator_id", operatorId)
        .eq("slug", slug)
        .neq("id", id)
        .maybeSingle();

      if (slugConflict) {
        slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      }
      updates.slug = slug;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("packages")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ package: data });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/admin/packages/[id] — Soft delete (set active=false).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const operatorId = request.headers.get("x-operator-id");
  if (!operatorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  const { data, error } = await supabaseAdmin
    .from("packages")
    .update({ active: false })
    .eq("id", id)
    .eq("operator_id", operatorId)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
