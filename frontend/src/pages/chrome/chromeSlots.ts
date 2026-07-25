/**
 * chromeSlots — host-owned portal targets for route-supplied chrome (Stage-1 T3).
 *
 * The chrome host (`AppChrome`) renders two empty container divs — one where
 * the group TopBar belongs, one where the Spine belongs — and publishes the
 * two DOM nodes through this context. The group route (`NewShell`) renders
 * `createPortal(<TopBar/>, topBar)` / `createPortal(<Spine/>, spine)` into
 * them, so the bars sit in the host's DOM position while remaining React-tree
 * children of NewShell.
 *
 * Why portals and NOT element-passing slots (RC1, director-mandated): React
 * context is positional. `TopBar` unconditionally renders `TierBreadcrumb`,
 * which calls `useGroupActions()` — that THROWS outside the
 * `GroupActionModals` provider, and the provider lives in NewShell, BELOW the
 * host. A slot element rendered by AppChrome would resolve context at the
 * host's position (no provider ancestor) → throw → the app ErrorBoundary
 * swallows the whole v2 group route. Portal children keep NewShell's context
 * tree, so `GroupActionModals` (and every future route-scoped provider)
 * resolves correctly. Hoisting `GroupActionModals` into the host instead is
 * ruled out: it would mount AddPlayerModal/CreateTierModal/RolloverDialog
 * app-wide, and its `onTierCreated` needs the route-scoped `setPageMode`.
 *
 * Why DOM nodes and NOT slot-element registration (RC2): registering elements
 * requires an ancestor `setState` on every render in which the slot content's
 * identity changes (every query-param write under react-router 7 — new
 * `setSearchParams` identity per URL change), re-rendering the whole app tree.
 * The published NODES change identity only when the host containers
 * mount/unmount, so consumers re-render only their own portal contents.
 *
 * Plain .ts (no JSX, no components) on purpose — mixed component+hook exports
 * would trip react-refresh/only-export-components; this file exports only the
 * context object and a hook, so no suppression is needed.
 */
import { createContext, useContext } from 'react';

export interface ChromeSlotNodes {
  /** Host container for the group TopBar portal — null until the host commits
   *  (or when no chrome host is mounted, e.g. unit tests rendering NewShell
   *  bare: the portals simply don't render). */
  topBar: HTMLElement | null;
  /** Host container for the group Spine portal. */
  spine: HTMLElement | null;
}

const NO_SLOTS: ChromeSlotNodes = { topBar: null, spine: null };

export const ChromeSlotNodesContext = createContext<ChromeSlotNodes>(NO_SLOTS);

/** The chrome host's published portal targets (both null outside a host). */
export function useChromeSlotNodes(): ChromeSlotNodes {
  return useContext(ChromeSlotNodesContext);
}
