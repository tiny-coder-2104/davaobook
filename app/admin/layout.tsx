"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@/lib/supabase-browser";

const NAV = [
  { href: "/admin/today", label: "Today", icon: "📋" },
  { href: "/admin/bookings", label: "Bookings", icon: "📦" },
  { href: "/admin/calendar", label: "Calendar", icon: "📅" },
  { href: "/admin/packages", label: "Packages", icon: "🏝️" },
  { href: "/admin/new-booking", label: "New Booking", icon: "➕" },
];

/** Clears Supabase auth cookies and routes to the login screen. */
function signOut() {
  document.cookie = "sb-access-token=; Path=/; Max-Age=0";
  document.cookie = "sb-refresh-token=; Path=/; Max-Age=0";
  window.location.href = "/auth/login";
}

/** Derives up to two initials from a name or email for the avatar. */
function getInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0][0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
    return (first + last).toUpperCase();
  }
  if (email && email.trim()) return email.trim()[0].toUpperCase();
  return "👤";
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Avatar / operator identity
  const [initials, setInitials] = useState<string>("👤");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createBrowserClient();
        const { data } = await supabase.auth.getUser();
        if (!active || !data.user) return;
        const u = data.user;
        const name =
          (u.user_metadata as { name?: string } | undefined)?.name ||
          (u.app_metadata as { name?: string } | undefined)?.name;
        setInitials(getInitials(name, u.email));
      } catch {
        // keep placeholder
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Close the avatar dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200
          transform transition-transform lg:translate-x-0 lg:static lg:z-auto
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="h-16 flex items-center px-4 border-b border-gray-100">
          <span className="font-heading text-lg font-bold text-brand">
            DavaoBook
          </span>
        </div>

        <nav className="p-3 space-y-1">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-touch text-sm font-medium transition-colors
                  ${active ? "bg-brand/10 text-brand" : "text-ink-muted hover:bg-gray-50 hover:text-ink"}`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-4 left-0 right-0 px-4">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-touch text-sm
                       text-ink-muted hover:bg-red-50 hover:text-status-cancelled transition-colors"
          >
            <span className="text-lg">🚪</span>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 gap-3 sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-touch hover:bg-gray-100"
            aria-label="Open menu"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          <h1 className="font-heading font-semibold text-base truncate">
            {NAV.find((n) => pathname.startsWith(n.href))?.label ?? "Admin"}
          </h1>

          {/* Right side: account avatar + dropdown */}
          <div className="ml-auto relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="w-10 h-10 flex items-center justify-center rounded-touch
                         bg-brand/10 text-brand font-heading font-semibold
                         hover:bg-brand/20 transition-colors min-w-touch min-h-touch"
              aria-label="Account menu"
            >
              {initials}
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-48 bg-surface rounded-touch
                           border border-gray-200 shadow-lg py-1 z-50"
              >
                <Link
                  href="/admin/account"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2.5 text-sm text-ink
                             hover:bg-gray-50 transition-colors"
                >
                  Account
                </Link>
                <button
                  role="menuitem"
                  onClick={signOut}
                  className="w-full text-left px-4 py-2.5 text-sm
                             text-status-cancelled hover:bg-red-50 transition-colors"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
