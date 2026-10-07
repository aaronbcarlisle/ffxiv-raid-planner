/**
 * AuthSkeleton - the pre-hydration placeholder for a V2 top bar's auth slot.
 *
 * The exact `Header.tsx:407-408` pulse circle (H13): a cold load renders this
 * instead of flashing LoginButton for a frame. V1's Header keeps its own inline
 * copy; only the V2 chrome in `pages/chrome/` imports this one.
 */

export function AuthSkeleton() {
  return <div data-testid="auth-skeleton" className="w-8 h-8 rounded-full bg-surface-interactive animate-pulse" />;
}
