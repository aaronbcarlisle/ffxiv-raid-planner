/**
 * Skeleton Loading Components
 *
 * Placeholder components shown while content is loading.
 * Uses a subtle pulse animation for better UX.
 */

interface SkeletonProps {
  className?: string;
}

/**
 * Base skeleton component - a pulsing placeholder block
 */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-slate-700/50 rounded ${className}`}
      aria-hidden="true"
    />
  );
}

/**
 * Skeleton for a single player card
 */
export function PlayerCardSkeleton() {
  return (
    <div className="bg-slate-800 rounded-lg p-4 space-y-3 border border-slate-700">
      {/* Header: avatar + name + job */}
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-6 w-12" />
      </div>

      {/* Gear slots grid */}
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8" />
        ))}
      </div>

      {/* Progress indicators */}
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-16" />
      </div>
    </div>
  );
}

/**
 * Skeleton for a grid of player cards
 */
export function PlayerGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <PlayerCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for a table row
 */
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b border-slate-700">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}

/**
 * Skeleton for a data table
 */
export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-700">
      <table className="w-full">
        <thead className="bg-slate-800">
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3 text-left">
                <Skeleton className="h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-slate-900">
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Skeleton for a list item
 */
export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
      <Skeleton className="w-8 h-8 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-6 w-16" />
    </div>
  );
}

/**
 * Skeleton for a list of items
 */
export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <ListItemSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for a card with text content
 */
export function CardSkeleton() {
  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 space-y-3">
      <Skeleton className="h-5 w-32" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

/**
 * Full-page loading skeleton
 */
export function PageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-20" />
      </div>

      {/* Content grid */}
      <PlayerGridSkeleton count={8} />
    </div>
  );
}

/**
 * Skeleton for a static group card (Dashboard grid view)
 */
export function StaticCardSkeleton() {
  return (
    <div className="bg-surface-card rounded-lg border border-border-default p-4 space-y-3">
      {/* Header: name + role badge */}
      <div className="flex items-start justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-5 w-14 rounded" />
      </div>

      {/* Meta: member count + visibility */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>

      {/* Footer: share code + copy button */}
      <div className="pt-3 border-t border-border-subtle flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-6 rounded" />
      </div>
    </div>
  );
}

/**
 * Skeleton for static group cards in grid view
 */
export function StaticGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <StaticCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for a static group list item (Dashboard list view)
 */
export function StaticListItemSkeleton() {
  return (
    <div className="flex items-center justify-between p-4">
      {/* Left: name + role */}
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-5 w-14 rounded" />
      </div>

      {/* Right: meta info */}
      <div className="flex items-center gap-6 flex-shrink-0">
        <Skeleton className="h-4 w-8" />
        <Skeleton className="h-4 w-16" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-6 w-6 rounded" />
        </div>
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}

/**
 * Skeleton for static groups in list view
 */
export function StaticListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="bg-surface-card rounded-lg border border-border-default divide-y divide-border-subtle">
      {Array.from({ length: count }).map((_, i) => (
        <StaticListItemSkeleton key={i} />
      ))}
    </div>
  );
}
