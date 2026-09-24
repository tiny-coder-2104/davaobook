import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 0;

/**
 * Public operator portal. If a session exists, send the user straight to
 * the admin instead of showing the sign-in card.
 */
export default async function OperatorDashboard({
  params,
}: {
  params: { operatorSlug: string };
}) {
  // ponytail: cookie + getUser mirrors middleware's session check; a service-role
  // client (lib/supabase-server) has no user context, so it can't see browser sessions.
  const accessToken = cookies().get("sb-access-token")?.value;
  if (accessToken) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const {
      data: { user },
    } = await supabase.auth.getUser(accessToken);
    if (user) redirect("/admin");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-sm bg-surface rounded-2xl shadow-lg p-8 text-center">
        <p className="text-xs font-heading text-brand uppercase tracking-wide mb-3">
          DavaoBook
        </p>
        <h1 className="font-heading text-2xl font-bold mb-2">For resort owners</h1>
        <p className="text-ink-muted mb-8">
          Manage your booking page, rooms, and availability.
        </p>
        <Link href="/auth/login" className="btn-primary w-full block text-center">
          Sign in
        </Link>
        <a
          href="https://welcome-tinycoder-studio.vercel.app"
          target="_blank"
          rel="noopener"
          className="mt-4 inline-block text-sm text-brand underline"
        >
          Get your own booking page
        </a>
      </div>
    </main>
  );
}