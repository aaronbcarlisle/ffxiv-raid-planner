export function SkipLink({ targetId = 'main-content' }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-3 focus:py-1.5 focus:rounded-md focus:bg-surface-raised focus:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      Skip to content
    </a>
  );
}
