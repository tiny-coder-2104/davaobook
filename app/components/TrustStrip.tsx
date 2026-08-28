import type { Operator } from "../../lib/types";

export default function TrustStrip({ operator }: { operator: Operator | null }) {
  const title = operator?.name ?? "Samal Island Tours";

  return (
    <header className="mb-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        {/* Branding left */}
        <div className="flex gap-3">
          {/* ponytail: gray placeholder box, emoji keeps it zero-asset */}
          <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border bg-gray-200">
            <span aria-hidden="true" className="text-base leading-none">
              🏝️
            </span>
            <span className="text-[7px] font-medium uppercase tracking-wide text-gray-500">
              Your Logo
            </span>
          </div>
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-bold leading-tight text-ink">
              {title}
            </h1>
            <p className="mt-0.5 text-sm text-ink-muted">
              Confirmed bookings • Instant SMS updates • Easy online payments
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Confirmed bookings
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                SMS updates
              </span>
            </div>
          </div>
        </div>

        {/* CTAs right: stacked mobile, row desktop */}
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
          <a
            href="/auth/signup"
            className="inline-flex min-h-touch items-center justify-center rounded-touch bg-brand px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-hover text-center"
          >
            Create an operator account
          </a>
          <a
            href="/auth/login"
            className="inline-flex min-h-touch items-center justify-center px-4 py-2 text-center text-sm font-medium text-ink-muted underline-offset-4 transition-colors hover:text-brand hover:underline"
          >
            Operator sign in
          </a>
        </div>
      </div>
    </header>
  );
}
