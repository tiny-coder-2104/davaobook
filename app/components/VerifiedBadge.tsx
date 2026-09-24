/** Green check-circle "Verified" badge — shown next to an operator's name. */
export default function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1" title="Verified operator">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="shrink-0"
      >
        <circle cx="12" cy="12" r="10" fill="#2d6a4f" />
        <path
          d="m8.5 12.5 2.5 2.5 4.5-5"
          fill="none"
          stroke="#fff"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-xs font-medium text-[#2d6a4f]">Verified</span>
    </span>
  );
}