import Link from "next/link";

/**
 * /admin/help — Plain-language guide to DavaoBook for the operator.
 * Static content, no data fetching.
 */

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "How a booking works",
    items: [
      "A guest books on your site and picks a room, date, and number of guests.",
      "The booking appears in your dashboard as \"Needs Confirm\" — it is a request, not a final sale.",
      "You review it (check capacity and details) and click Confirm to accept it.",
      "Payment is handled outside the app — cash on arrival or bank transfer, whatever you agree with the guest.",
      "After the stay, mark the booking Completed to keep your records tidy.",
    ],
  },
  {
    title: "What the statuses mean",
    items: [
      "Needs Confirm — new request, waiting for you to accept or decline.",
      "Confirmed — you accepted it. The guest sees \"Confirmed\" on their booking page.",
      "Completed — the stay happened and is finished.",
      "Cancelled — you or the guest cancelled.",
      "Declined — you rejected the request.",
      "Expired — the request sat too long without a response and was auto-cancelled.",
    ],
  },
  {
    title: "What each tab does",
    items: [
      "Today — today's arrivals, pending requests, and this month's revenue at a glance.",
      "Insights — all-time totals, revenue for the last 6 months, popular rooms, and average occupancy.",
      "Bookings — every booking, with search, status filters, and date range.",
      "Calendar — month view per room. Click a date to block it (blocks new bookings).",
      "Packages — edit room names, prices, capacity, and photos.",
      "New Booking — add a walk-in or phone booking yourself.",
    ],
  },
  {
    title: "How guests track their booking",
    items: [
      "Every booking gets a code like STAND-0926-JUAN, shown on the confirmation screen and in your dashboard.",
      "Guests enter that code — or the email they booked with — on the Track my booking page to see their status.",
    ],
  },
];

export default function AdminHelp() {
  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-sm text-ink-muted">
        The short version of how DavaoBook works. Bookmark this page.
      </p>

      {SECTIONS.map((s) => (
        <div
          key={s.title}
          className="bg-surface rounded-touch border border-gray-200 p-5"
        >
          <h3 className="font-heading font-semibold text-ink">{s.title}</h3>
          <ul className="mt-3 space-y-2">
            {s.items.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-ink">
                <span className="text-brand shrink-0">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <Link
        href="/track"
        className="inline-block text-sm text-brand font-medium underline underline-offset-2 hover:text-brand-hover transition-colors"
      >
        Preview the guest Track my booking page →
      </Link>
    </div>
  );
}
