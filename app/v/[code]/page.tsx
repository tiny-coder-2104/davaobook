import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-server";
import VoucherCard, { type VoucherData } from "../../components/VoucherCard";
import type { Metadata } from "next";

interface PageProps {
  params: { code: string };
}

/** Fetch booking + operator data server-side. Returns null if not found. */
async function fetchVoucherData(
  code: string
): Promise<VoucherData | null> {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(
      `code, status, tour_date, pax, total_amount, guest_name, mobile,
       pickup_area, notes,
       packages(name, operator_id, operators(name, phone, email, logo_url))`
    )
    .eq("code", code.toUpperCase())
    .single();

  if (error || !data) return null;

  // Supabase returns nested joins as arrays — normalize
  const pkgRaw = data.packages as unknown;
  const pkg = Array.isArray(pkgRaw)
    ? (pkgRaw[0] as Record<string, unknown>)
    : (pkgRaw as Record<string, unknown>) ?? null;

  const operatorsRaw = pkg?.operators as unknown;
  const op = Array.isArray(operatorsRaw)
    ? (operatorsRaw[0] as Record<string, unknown>)
    : (operatorsRaw as Record<string, unknown>) ?? null;

  return {
    code: data.code as string,
    status: data.status as string,
    tour_date: data.tour_date as string,
    pax: data.pax as number,
    guest_name: data.guest_name as string,
    mobile: data.mobile as string,
    pickup_area: data.pickup_area as string,
    notes: (data.notes as string) ?? null,
    package_name: (pkg?.name as string) ?? "Tour Package",
    total_amount: data.total_amount as number,
    operator_name: (op?.name as string) ?? "Tour Operator",
    operator_phone: (op?.phone as string) ?? "",
    operator_email: (op?.email as string) ?? "",
    operator_logo_url: (op?.logo_url as string) ?? null,
  };
}

/* ── SEO ── */

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const data = await fetchVoucherData(params.code);
  if (!data) return { title: "Voucher Not Found" };

  return {
    title: `Voucher — ${data.package_name} | DavaoBook`,
    description: `Booking voucher for ${data.guest_name}: ${data.package_name} on ${data.tour_date}. Code: ${data.code}`,
  };
}

/* ── Page ── */

export default async function VoucherPage({ params }: PageProps) {
  const data = await fetchVoucherData(params.code);

  if (!data) {
    notFound();
  }

  return (
    <main className="px-4 py-6 min-h-screen bg-gray-50">
      <VoucherCard data={data} isOnline={true} />
    </main>
  );
}
