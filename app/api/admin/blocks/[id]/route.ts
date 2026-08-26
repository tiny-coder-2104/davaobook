import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * DELETE /api/admin/blocks/:id — Remove a date block.
 * Only allows deleting blocks owned by the current operator.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const operatorId = _request.headers.get("x-operator-id");
  if (!operatorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  const { error } = await supabaseAdmin
    .from("blocks")
    .delete()
    .eq("id", id)
    .eq("operator_id", operatorId);

  if (error) {
    console.error("Block delete error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
