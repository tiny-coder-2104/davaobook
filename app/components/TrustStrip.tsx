import type { Operator } from "../../lib/types";

export default function TrustStrip({ operator }: { operator: Operator }) {
  return (
    <div className="mb-6">
      <h1 className="font-heading text-2xl font-bold">{operator.name}</h1>
      <div className="mt-2 flex flex-wrap gap-3 text-sm text-ink-muted">
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true">&#10003;</span> Confirmed bookings
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true">&#9993;</span> SMS updates
        </span>
      </div>
    </div>
  );
}
