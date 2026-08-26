/**
 * Skeleton loading card — replaces spinner with content-shaped placeholder.
 */
export default function SkeletonCard() {
  return (
    <div className="rounded-touch border border-gray-100 bg-white p-4 animate-pulse">
      <div className="flex gap-3">
        {/* Thumbnail skeleton */}
        <div className="w-[60px] h-[60px] rounded-lg bg-gray-200 shrink-0" />

        <div className="flex-1 space-y-2">
          {/* Title line */}
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          {/* Subtitle line */}
          <div className="h-3 bg-gray-100 rounded w-1/2" />
          {/* Status pill */}
          <div className="h-5 bg-gray-100 rounded-full w-20" />
        </div>
      </div>
      {/* Bottom row */}
      <div className="mt-3 flex justify-between">
        <div className="h-3 bg-gray-100 rounded w-16" />
        <div className="h-3 bg-gray-100 rounded w-24" />
      </div>
    </div>
  );
}
