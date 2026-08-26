"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/admin/today", label: "Today", icon: "📋" },
  { href: "/admin/bookings", label: "Bookings", icon: "📦" },
  { href: "/admin/calendar", label: "Calendar", icon: "📅" },
  { href: "/admin/packages", label: "Packages", icon: "🏝️" },
  { href: "/admin/new-booking", label: "New Booking", icon: "➕" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
            onClick={() => {
              // Clear cookies and reload
              document.cookie =
                "sb-access-token=; Path=/; Max-Age=0";
              document.cookie =
                "sb-refresh-token=; Path=/; Max-Age=0";
              window.location.href = "/auth/login";
            }}
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
        </header>

        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
