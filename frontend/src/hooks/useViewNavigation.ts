/**
 * useViewNavigation Hook
 *
 * Provides navigation functions for cross-tab navigation in GroupView.
 * Handles navigating to player cards and loot entries with scroll and highlight.
 */

import { useCallback } from 'react';
import { toast } from '../stores/toastStore';
import type { PageMode, LootLogEntry } from '../types';

interface HighlightedEntry {
  id: string;
  type: 'loot' | 'material';
  week: number;
}

interface UseViewNavigationParams {
  setPageMode: (mode: PageMode) => void;
  setHighlightedPlayerId: (id: string | null) => void;
  setHighlightedEntry: (entry: HighlightedEntry | null) => void;
  lootLog: LootLogEntry[];
}

export interface UseViewNavigationReturn {
  /** Navigate to a player card and highlight it */
  handleNavigateToPlayer: (playerId: string) => void;

  /** Navigate to a loot entry from a player's gear slot */
  handleNavigateToLootEntry: (playerId: string, slot: string) => void;
}

export function useViewNavigation({
  setPageMode,
  setHighlightedPlayerId,
  setHighlightedEntry,
  lootLog,
}: UseViewNavigationParams): UseViewNavigationReturn {
  // Navigate to player card from other tabs (e.g., from Log entry context menu)
  const handleNavigateToPlayer = useCallback((playerId: string) => {
    // Switch to players tab
    setPageMode('players');
    // Set highlighted player ID
    setHighlightedPlayerId(playerId);
    // Scroll to player card after short delay to allow tab change render
    setTimeout(() => {
      const element = document.getElementById(`player-card-${playerId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    // Clear highlight after animation completes
    setTimeout(() => {
      setHighlightedPlayerId(null);
    }, 2500);
  }, [setPageMode, setHighlightedPlayerId]);

  // Navigate to loot entry from player card (gear slot → loot entry)
  const handleNavigateToLootEntry = useCallback((playerId: string, slot: string) => {
    // Find the loot entry for this player and slot
    const entry = lootLog.find(e => e.recipientPlayerId === playerId && e.itemSlot === slot);
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
    setTimeout(() => {
      setHighlightedEntry(null);
    }, 2500);
  }, [lootLog, setPageMode, setHighlightedEntry]);

  return {
    handleNavigateToPlayer,
    handleNavigateToLootEntry,
  };
}
