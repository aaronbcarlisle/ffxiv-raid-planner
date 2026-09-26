/**
 * Player Hub (V2) tab ids, the legacy `?tab=` map, and the one URL transform.
 *
 * The primary `tab` param is hand-rolled rather than going through
 * `useUrlTabState`: that hook can't map legacy ids, would render Overview for
 * one frame on a legacy id, and doesn't clear sub-tab params — the same three
 * reasons `useGroupViewState` and V1 `Profile` hand-roll theirs.
 */
import { clearRegisteredTabParams } from '../../../hooks/useUrlTabState';

export type HubTab = 'overview' | 'characters' | 'availability' | 'tracking' | 'sharing';

export const HUB_TABS: ReadonlyArray<{ id: HubTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'characters', label: 'Characters & gear' },
  { id: 'availability', label: 'Availability' },
  { id: 'tracking', label: 'Tracking' },
  { id: 'sharing', label: 'Sharing' },
];

const TAB_FOR_ID: Record<string, HubTab> = {
  characters: 'characters',
  availability: 'availability',
  tracking: 'tracking',
  sharing: 'sharing',
  // V1 Profile ids and their old redirects — ~25 inbound links still use them.
  sync: 'characters',
  'jobs-gear': 'characters',
  jobs: 'characters',
  gear: 'characters',
  preview: 'sharing',
  share: 'sharing',
  collections: 'tracking',
  goals: 'tracking',
  statics: 'overview',
};

/** The Hub tab a raw (possibly legacy) tab id lands on; unknown ids land on Overview. */
export function hubTabForId(id: string): HubTab {
  return Object.hasOwn(TAB_FOR_ID, id) ? TAB_FOR_ID[id] : 'overview';
}

/**
 * Resolve the Hub tab from the URL. `canonical` is false when the URL should be
 * rewritten to name that tab directly (a legacy or unknown id, an explicit
 * `tab=overview`, or a bare `focus=availability`).
 */
export function resolveHubTab(params: URLSearchParams): { tab: HubTab; canonical: boolean } {
  const raw = params.get('tab');
  if (!raw && params.get('focus') === 'availability') {
    return { tab: 'availability', canonical: false };
  }
  if (raw === null) return { tab: 'overview', canonical: true };
  const tab = hubTabForId(raw);
  return { tab, canonical: tab !== 'overview' && raw === tab };
}

/**
 * The URL for `tab`, keeping every other param. Overview omits `tab`, which
 * would let a leftover `focus=availability` pull the Hub back to Availability,
 * so that one is dropped too. When `remember` is false the registered sub-tab
 * params are cleared, as on a static.
 */
export function hubTabParams(prev: URLSearchParams, tab: HubTab, remember: boolean): URLSearchParams {
  const params = new URLSearchParams(prev);
  if (tab === 'overview') {
    params.delete('tab');
    if (params.get('focus') === 'availability') params.delete('focus');
  } else {
    params.set('tab', tab);
  }
  if (!remember) clearRegisteredTabParams(params);
  return params;
}
