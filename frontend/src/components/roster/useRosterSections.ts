/**
 * useRosterSections — per-section collapse state for the v2 roster (Phase C
 * slice C6, D-08 / legacy R-022, R-159).
 *
 * Restores legacy `PlayerGrid`'s folding (`PlayerGrid.tsx:463-525`) with two
 * deltas, both recorded on matrix D-08:
 *
 *  1. **Unassigned folds too.** v2's grouped view renders a fourth section that
 *     legacy's `CollapsedState` has no slot for.
 *  2. **v2-scoped key.** Legacy persists `roster-collapse-{groupId}-{tierId}`;
 *     writing it would make a v2 fold change what the frozen shell renders on
 *     its next visit — a V1-visible effect with zero file diff. Same call C1
 *     made for the density key (plan §5). v2 folds start fresh rather than
 *     inheriting legacy's, which is the honest trade for keeping the freeze
 *     strict: a fold is a transient layout preference, not a setting the user
 *     configured once.
 *
 * Density is deliberately independent of folding — switching Compact ⇄ Expanded
 * never touches fold state, so a folded group reveals its cards at whatever
 * density is current (legacy parity, and the reason the C1 checkpoint moved
 * re-click-Expanded here rather than leaving it on the density control).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { groupPlayersByLightParty } from '../../utils/calculations';
import type { SnapshotPlayer } from '../../types';

/** The foldable sections of the v2 roster. */
export type RosterSectionId = 'g1' | 'g2' | 'unassigned' | 'subs';

export interface VisibleSectionsInput {
  players: SnapshotPlayer[];
  groupView: boolean;
  subsView: boolean;
  subsHidden: boolean;
}

/**
 * The sections `RosterCards` is rendering right now, in render order — the
 * input `toggleAll` needs so fold-all can never act on an off-screen section.
 *
 * `RosterCards` derives its own sections from the same inputs while it renders
 * (it already has the grouped players in hand); this mirrors those conditions
 * rather than being consumed by them, so the two must be changed together.
 *
 * The flat view has no foldable main grid — only the substitutes section folds
 * there (legacy parity: `PlayerGrid`'s expand-all considers `g1`/`g2` only in
 * grouped view).
 */
export function visibleRosterSections({
  players,
  groupView,
  subsView,
  subsHidden,
}: VisibleSectionsInput): RosterSectionId[] {
  const sections: RosterSectionId[] = [];
  const grouped = groupPlayersByLightParty(players, subsView);

  if (groupView) {
    if (grouped.group1.length > 0) sections.push('g1');
    if (grouped.group2.length > 0) sections.push('g2');
    if (grouped.unassigned.length > 0) sections.push('unassigned');
  }

  const subs = groupView ? grouped.substitutes : players.filter((p) => p.isSubstitute);
  if (subsView && !subsHidden && subs.length > 0) sections.push('subs');

  return sections;
}

type CollapsedState = Partial<Record<RosterSectionId, boolean>>;

/** v2-scoped persistence key (strict freeze — never legacy's `roster-collapse-*`). */
export function rosterCollapseKey(groupId: string, tierId: string): string {
  return `v2-roster-collapse-${groupId}-${tierId}`;
}

function readCollapsedState(key: string): CollapsedState {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '{}');
    // Guard a stale non-object value ("null" / "[]" / a bare string) that would
    // otherwise break `collapsed[section]` reads downstream (legacy's guard).
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeCollapsedState(key: string, value: CollapsedState): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore localStorage errors — a storage failure must never break a fold.
  }
}

export interface UseRosterSectionsOptions {
  groupId: string;
  /**
   * Folds are scoped per static+tier. Undefined until the tier resolves — the
   * hook then keeps state in memory and touches storage not at all, rather
   * than writing a placeholder key (director F13).
   */
  tierId: string | undefined;
  /**
   * The sections actually on screen right now, in render order. `toggleAll`
   * acts on exactly these — folding a section the user cannot see would
   * surprise them the next time the view changes.
   */
  sections: readonly string[];
}

export interface UseRosterSectionsReturn {
  isCollapsed: (section: RosterSectionId) => boolean;
  toggleSection: (section: RosterSectionId) => void;
  /** Expand-all, or fold-all when everything rendered is already open. */
  toggleAll: () => void;
}

export function useRosterSections({
  groupId,
  tierId,
  sections,
}: UseRosterSectionsOptions): UseRosterSectionsReturn {
  const key = tierId ? rosterCollapseKey(groupId, tierId) : null;
  const [collapsed, setCollapsed] = useState<CollapsedState>(() =>
    key ? readCollapsedState(key) : {}
  );

  // Re-read when the static/tier (and so the key) changes. The component stays
  // mounted across tier switches, so without this the previous tier's folds
  // would linger. React's "adjust state while rendering" pattern, as legacy
  // does it — persistence stays out of render, in the effect below.
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setCollapsed(key ? readCollapsedState(key) : {});
  }

  useEffect(() => {
    if (key) writeCollapsedState(key, collapsed);
  }, [key, collapsed]);

  const isCollapsed = useCallback(
    (section: RosterSectionId) => Boolean(collapsed[section]),
    [collapsed]
  );

  const toggleSection = useCallback((section: RosterSectionId) => {
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  // `sections` is typically a fresh array each render; join it so the callback
  // identity tracks its CONTENTS rather than its reference.
  const sectionKey = sections.join(',');
  const toggleAll = useCallback(() => {
    const rendered = sectionKey ? (sectionKey.split(',') as RosterSectionId[]) : [];
    if (rendered.length === 0) return;
    setCollapsed((prev) => {
      const everyExpanded = rendered.every((s) => !prev[s]);
      const next: CollapsedState = {};
      if (everyExpanded) rendered.forEach((s) => { next[s] = true; });
      return next;
    });
  }, [sectionKey]);

  return useMemo(
    () => ({ isCollapsed, toggleSection, toggleAll }),
    [isCollapsed, toggleSection, toggleAll]
  );
}
