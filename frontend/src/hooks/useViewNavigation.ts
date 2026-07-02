/**
 * useViewNavigation Hook
 *
 * Provides navigation functions for cross-tab navigation in GroupView.
 * Handles navigating to player cards and loot entries with scroll and highlight.
 */

import { useCallback, useRef, useEffect } from 'react';
import { toast } from '../stores/toastStore';
import type { PageMode, GearSubTab, LootLogEntry, MaterialLogEntry } from '../types';

/**
 * Scroll an element into view once it actually exists in the DOM.
 *
 * Cross-tab navigation switches pageMode and the target tab mounts behind an
 * AnimatePresence `mode="wait"` transition (the outgoing tab animates out
 * first), so the target element isn't present on the next frame. A single
 * fixed timeout races that animation. Instead we poll for the element and
 * scroll the moment it appears (then once more after the enter animation
 * settles so `block: 'center'` lands accurately).
 *
 * Returns a cancel function that clears any pending timer, so a fast
 * navigate-away (or a new navigation) can't leave a stale scroll queued.
 */
function scrollIntoViewWhenReady(
  getId: () => string,
  getFallbackId?: () => string,
  { attempts = 24, interval = 40 }: { attempts?: number; interval?: number } = {},
): () => void {
  let tries = 0;
  // Only ever one timer is pending at a time (the next poll, or the re-center).
  let timer: ReturnType<typeof setTimeout> | null = null;
  const tick = () => {
    const el =
      document.getElementById(getId()) ??
      (getFallbackId ? document.getElementById(getFallbackId()) : null);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Re-center after the enter animation finishes so it isn't left off-screen.
      timer = setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 220);
      return;
    }
    if (++tries < attempts) timer = setTimeout(tick, interval);
  };
  tick();
  return () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
}

interface HighlightedEntry {
  id: string;
  type: 'loot' | 'material';
  week: number;
}

interface UseViewNavigationParams {
  setPageMode: (mode: PageMode) => void;
  setGearSubTab: (tab: GearSubTab) => void;
  setHighlightedPlayerId: (id: string | null) => void;
  setHighlightedSlot: (slot: string | null) => void;
  setHighlightedEntry: (entry: HighlightedEntry | null) => void;
  setHighlightedBookPlayerId: (id: string | null) => void;
  lootLog: LootLogEntry[];
  materialLog: MaterialLogEntry[];
}

export interface UseViewNavigationReturn {
  /** Navigate to a player card and highlight it (optionally highlight a specific gear slot) */
  handleNavigateToPlayer: (playerId: string, slot?: string) => void;

  /** Navigate to a loot entry from a player's gear slot */
  handleNavigateToLootEntry: (playerId: string, slot: string) => void;

  /** Navigate to a material entry from a player's gear slot */
  handleNavigateToMaterialEntry: (playerId: string, slot: string) => void;

  /** Navigate to the Books panel and highlight the player's row */
  handleNavigateToBooksPanel: (playerId: string) => void;
}

export function useViewNavigation({
  setPageMode,
  setGearSubTab,
  setHighlightedPlayerId,
  setHighlightedSlot,
  setHighlightedEntry,
  setHighlightedBookPlayerId,
  lootLog,
  materialLog,
}: UseViewNavigationParams): UseViewNavigationReturn {
  // Track timeout IDs for cleanup to prevent stale state updates
  const playerHighlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entryHighlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bookHighlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cancels the in-flight scroll poll/re-center, so a new navigation or unmount
  // doesn't leave a queued scroll that fires against the wrong content.
  const scrollCancelRef = useRef<(() => void) | null>(null);
  const startScroll = useCallback((getId: () => string, getFallbackId?: () => string) => {
    scrollCancelRef.current?.();
    scrollCancelRef.current = scrollIntoViewWhenReady(getId, getFallbackId);
  }, []);

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      if (playerHighlightTimeoutRef.current) clearTimeout(playerHighlightTimeoutRef.current);
      if (entryHighlightTimeoutRef.current) clearTimeout(entryHighlightTimeoutRef.current);
      if (bookHighlightTimeoutRef.current) clearTimeout(bookHighlightTimeoutRef.current);
      scrollCancelRef.current?.();
    };
  }, []);

  // Navigate to player card from other tabs (e.g., from Log entry alt+click)
  // When slot is provided, highlights the specific gear row instead of the whole card
  const handleNavigateToPlayer = useCallback((playerId: string, slot?: string) => {
    // Clear any existing timeout
    if (playerHighlightTimeoutRef.current) clearTimeout(playerHighlightTimeoutRef.current);
    // Normalize slot values to match gear row IDs in GearTable
    // - tome_weapon → weapon (tome weapon sub-row is part of the weapon section)
    // - ring → ring1 (generic "ring" from loot log maps to first ring row)
    const normalizedSlot = slot === 'tome_weapon' ? 'weapon'
      : slot === 'ring' ? 'ring1'
      : slot;
    // Switch to roster tab
    setPageMode('roster');
    // Set highlighted player and optional slot
    setHighlightedPlayerId(playerId);
    setHighlightedSlot(normalizedSlot ?? null);
    // Scroll to the specific gear row (falling back to the whole card) once it
    // mounts — polls past the tab-switch animation so it doesn't no-op early.
    startScroll(
      () => (normalizedSlot ? `gear-row-${playerId}-${normalizedSlot}` : `player-card-${playerId}`),
      () => `player-card-${playerId}`,
    );
    // Clear highlight after animation completes
    playerHighlightTimeoutRef.current = setTimeout(() => {
      setHighlightedPlayerId(null);
      setHighlightedSlot(null);
    }, 2500);
  }, [setPageMode, setGearSubTab, setHighlightedPlayerId, setHighlightedSlot, startScroll]);

  // Navigate to loot entry from player card (gear slot → loot entry)
  const handleNavigateToLootEntry = useCallback((playerId: string, slot: string) => {
    // Clear any existing timeout
    if (entryHighlightTimeoutRef.current) clearTimeout(entryHighlightTimeoutRef.current);
    // Find the loot entry for this player and slot
    // Search priority: exact slot + non-extra > exact slot > ring variant + non-extra > ring variant
    // Ring slots: gear uses ring1/ring2, loot log may store as "ring", "ring1", or "ring2"
    const isPlayer = (e: LootLogEntry) => e.recipientPlayerId === playerId;
    const isRingSlot = slot === 'ring1' || slot === 'ring2';
    const isRingVariant = (e: LootLogEntry) =>
      e.itemSlot === 'ring' || e.itemSlot === 'ring1' || e.itemSlot === 'ring2';
    const entry =
      // 1. Exact slot match, non-extra
      lootLog.find(e => isPlayer(e) && e.itemSlot === slot && !e.isExtra)
      // 2. Exact slot match, any
      ?? lootLog.find(e => isPlayer(e) && e.itemSlot === slot)
      // 3. Ring variant fallback, non-extra (only for ring slots)
      ?? (isRingSlot ? lootLog.find(e => isPlayer(e) && isRingVariant(e) && !e.isExtra) : undefined)
      // 4. Ring variant fallback, any
      ?? (isRingSlot ? lootLog.find(e => isPlayer(e) && isRingVariant(e)) : undefined);
    if (!entry) {
      toast.info('No loot entry found for this slot');
      return;
    }
    // Switch to gear tab, loot log sub-tab
    setPageMode('gear');
    setGearSubTab('history');
    // Set highlighted entry with week for cross-week navigation
    setHighlightedEntry({ id: String(entry.id), type: 'loot', week: entry.weekNumber });
    // Scroll once the entry row mounts (after tab change + week switch render).
    startScroll(() => `loot-entry-${entry.id}`);
    // Clear highlight after animation completes
    entryHighlightTimeoutRef.current = setTimeout(() => {
      setHighlightedEntry(null);
    }, 2500);
  }, [lootLog, setPageMode, setGearSubTab, setHighlightedEntry, startScroll]);

  // Navigate to material entry from player card (gear slot → material entry)
  const handleNavigateToMaterialEntry = useCallback((playerId: string, slot: string) => {
    // Clear any existing timeout
    if (entryHighlightTimeoutRef.current) clearTimeout(entryHighlightTimeoutRef.current);
    // Find the material entry for this player and slot
    // Universal tomestone has no slotAugmented but maps to 'tome_weapon'
    const entry = materialLog.find(e => e.recipientPlayerId === playerId &&
      (e.slotAugmented === slot || (slot === 'tome_weapon' && e.materialType === 'universal_tomestone' && !e.slotAugmented)));
    if (!entry) {
      toast.info('No material entry found for this slot');
      return;
    }
    // Switch to gear tab, loot log sub-tab
    setPageMode('gear');
    setGearSubTab('history');
    // Set highlighted entry with week for cross-week navigation
    setHighlightedEntry({ id: String(entry.id), type: 'material', week: entry.weekNumber });
    // Scroll once the entry row mounts (after tab change + week switch render).
    startScroll(() => `material-entry-${entry.id}`);
    // Clear highlight after animation completes
    entryHighlightTimeoutRef.current = setTimeout(() => {
      setHighlightedEntry(null);
    }, 2500);
  }, [materialLog, setPageMode, setGearSubTab, setHighlightedEntry, startScroll]);

  // Navigate to Books panel from player card context menu
  const handleNavigateToBooksPanel = useCallback((playerId: string) => {
    // Clear any existing timeout
    if (bookHighlightTimeoutRef.current) clearTimeout(bookHighlightTimeoutRef.current);
    // Switch to gear tab, loot log sub-tab
    setPageMode('gear');
    setGearSubTab('history');
    // Set highlighted book player ID
    setHighlightedBookPlayerId(playerId);
    // Scroll once the row mounts (after tab change render).
    startScroll(() => `book-row-${playerId}`);
    // Clear highlight after animation completes
    bookHighlightTimeoutRef.current = setTimeout(() => {
      setHighlightedBookPlayerId(null);
    }, 2500);
  }, [setPageMode, setGearSubTab, setHighlightedBookPlayerId, startScroll]);

  return {
    handleNavigateToPlayer,
    handleNavigateToLootEntry,
    handleNavigateToMaterialEntry,
    handleNavigateToBooksPanel,
  };
}
