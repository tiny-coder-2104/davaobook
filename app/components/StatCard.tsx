export default function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-surface rounded-touch border border-gray-200 p-4 sm:p-5">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 font-heading font-bold text-xl sm:text-2xl text-ink truncate">
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-ink-muted">{sub}</p>}
    </div>
  );
}