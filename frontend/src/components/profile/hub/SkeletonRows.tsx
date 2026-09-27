/**
 * SkeletonRows — the two-row loading placeholder shared by NeedsYouCard and
 * YourStaticsCard (R-PH2-O). Markup/classes are the pre-extraction verbatim
 * copy each card rendered inline; both cards' skeleton tests stay green.
 */

export function SkeletonRows() {
  return (
    <div className="flex flex-col gap-2">
      {[1, 2].map((i) => (
        <div key={i} className="h-10 animate-pulse rounded bg-surface-interactive" />
      ))}
    </div>
  );
}
