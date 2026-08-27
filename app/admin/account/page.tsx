"use client";

import { useState } from "react";
import BusinessProfile from "./sections/BusinessProfile";
import LoginSecurity from "./sections/LoginSecurity";
import Notifications from "./sections/Notifications";

type SectionId = "business" | "security" | "notifications";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "business", label: "Business profile" },
  { id: "security", label: "Login & security" },
  { id: "notifications", label: "Notifications" },
];

export default function AccountPage() {
  const [active, setActive] = useState<SectionId>("business");

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="font-heading font-bold text-2xl text-ink">Account</h1>

      <div className="mt-5 flex flex-col sm:flex-row gap-5">
        {/* Section rail: stacked cards on mobile, vertical rail on desktop */}
        <nav
          className="flex sm:flex-col gap-2 overflow-x-auto sm:overflow-visible
                     sm:w-56 shrink-0"
          aria-label="Account sections"
        >
          {SECTIONS.map((s) => {
            const selected = s.id === active;
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                aria-current={selected ? "page" : undefined}
                className={`whitespace-nowrap px-4 py-2.5 rounded-touch text-sm font-medium
                            text-left transition-colors
                            ${selected
                              ? "bg-brand/10 text-brand"
                              : "bg-surface text-ink-muted hover:bg-gray-50 hover:text-ink border border-gray-200"}`}
              >
                {s.label}
              </button>
            );
          })}
        </nav>

        {/* Content panel */}
        <div className="flex-1 min-w-0">
          {active === "business" && <BusinessProfile />}
          {active === "security" && <LoginSecurity />}
          {active === "notifications" && <Notifications />}
        </div>
      </div>
    </div>
  );
}
