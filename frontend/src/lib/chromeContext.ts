/**
 * chromeContext — the "am I rendered inside v2 app chrome?" signal (Stage 1, G2).
 *
 * `V2ChromeContext`'s provider is mounted ONLY by the v2 chrome host —
 * pages/chrome/AppChrome, mounted solely by Layout's v2 branch (T3 landed;
 * NewShell hosted it temporarily during T1). Because no legacy render path
 * ever mounts the provider, the
 * default value `false` is STRUCTURALLY guaranteed on every legacy render path
 * and on `/` (the excluded route, where the legacy Header renders even for
 * v2-resolved users). This is ruling G2's no-leak mechanism: consumers key
 * v2-chrome-only affordances (e.g. UserMenu's "Switch to classic UI") on this
 * context instead of on `resolvedShell`/route checks — a bare `resolvedShell`
 * check would leak the affordance into the legacy Header's UserMenu on `/`.
 *
 * Lives in `lib/` (boundary-unrestricted: consumed by `person` UserMenu, by
 * pages, and by the host — same placement logic as `shellPreference.ts`).
 * Plain .ts (no JSX) on purpose, so react-refresh/only-export-components
 * never applies to the mixed context+hook exports.
 */
import { createContext, useContext } from 'react';

export const V2ChromeContext = createContext(false);

/** True only when rendered under the v2 chrome host's provider. */
export function useInV2Chrome(): boolean {
  return useContext(V2ChromeContext);
}
