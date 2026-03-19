/**
 * useViewNavigation Hook
 *
 * Provides navigation functions for cross-tab navigation in GroupView.
 * Handles navigating to player cards and loot entries with scroll and highlight.
 */

import { useCallback, useRef, useEffect } from 'react';
import { toast } from '../stores/toastStore';
import type { PageMode, LootLogEntry, MaterialLogEntry } from '../types';

interface HighlightedEntry {
  id: string;
  type: 'loot' | 'material';
  week: number;
}

interface UseViewNavigationParams {
  setPageMode: (mode: PageMode) => void;
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

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      if (playerHighlightTimeoutRef.current) clearTimeout(playerHighlightTimeoutRef.current);
      if (entryHighlightTimeoutRef.current) clearTimeout(entryHighlightTimeoutRef.current);
      if (bookHighlightTimeoutRef.current) clearTimeout(bookHighlightTimeoutRef.current);
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
    // Switch to players tab
    setPageMode('players');
    // Set highlighted player and optional slot
    setHighlightedPlayerId(playerId);
    setHighlightedSlot(normalizedSlot ?? null);
    // Scroll to player card (or specific gear row) after short delay to allow tab change render
    setTimeout(() => {
      // If a slot is specified, try to scroll to the gear row
      const scrollTarget = normalizedSlot
        ? document.getElementById(`gear-row-${playerId}-${normalizedSlot}`)
        : document.getElementById(`player-card-${playerId}`);
      const element = scrollTarget ?? document.getElementById(`player-card-${playerId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    // Clear highlight after animation completes
    playerHighlightTimeoutRef.current = setTimeout(() => {
      setHighlightedPlayerId(null);
      setHighlightedSlot(null);
    }, 2500);
  }, [setPageMode, setHighlightedPlayerId, setHighlightedSlot]);

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
    // Switch to history (Log) tab
    setPageMode('history');
    // Set highlighted entry with week for cross-week navigation
    setHighlightedEntry({ id: String(entry.id), type: 'loot', week: entry.weekNumber });
    // Scroll to entry after short delay to allow tab change and week switch
    setTimeout(() => {
      const element = document.getElementById(`loot-entry-${entry.id}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 200); // Slightly longer delay to allow week switch
    // Clear highlight after animation completes
    entryHighlightTimeoutRef.current = setTimeout(() => {
      setHighlightedEntry(null);
    }, 2500);
  }, [lootLog, setPageMode, setHighlightedEntry]);

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
    // Switch to history (Log) tab
    setPageMode('history');
    // Set highlighted entry with week for cross-week navigation
    setHighlightedEntry({ id: String(entry.id), type: 'material', week: entry.weekNumber });
    // Scroll to entry after short delay to allow tab change and week switch
    setTimeout(() => {
      const element = document.getElementById(`material-entry-${entry.id}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 200); // Slightly longer delay to allow week switch
    // Clear highlight after animation completes
    entryHighlightTimeoutRef.current = setTimeout(() => {
      setHighlightedEntry(null);
    }, 2500);
  }, [materialLog, setPageMode, setHighlightedEntry]);

  // Navigate to Books panel from player card context menu
  const handleNavigateToBooksPanel = useCallback((playerId: string) => {
    // Clear any existing timeout
    if (bookHighlightTimeoutRef.current) clearTimeout(bookHighlightTimeoutRef.current);
    // Switch to history (Log) tab
    setPageMode('history');
    // Set highlighted book player ID
    setHighlightedBookPlayerId(playerId);
    // Scroll to the row after short delay to allow tab change render
    setTimeout(() => {
      const element = document.getElementById(`book-row-${playerId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 200);
    // Clear highlight after animation completes
    bookHighlightTimeoutRef.current = setTimeout(() => {
      setHighlightedBookPlayerId(null);
    }, 2500);
  }, [setPageMode, setHighlightedBookPlayerId]);

  return {
    handleNavigateToPlayer,
    handleNavigateToLootEntry,
    handleNavigateToMaterialEntry,
    handleNavigateToBooksPanel,
  };
}
