/**
 * History View
 *
 * Main container for the History tab (now called "Log" tab).
 * Shows sectioned view with Loot, Materials, and Books sections.
 */

import { useState, useEffect, useCallback } from 'react';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { WeekSelector } from './WeekSelector';
import { SectionedLogView } from './SectionedLogView';
import type { SnapshotPlayer } from '../../types';

interface HistoryViewProps {
  groupId: string;
  tierId: string;
  players: SnapshotPlayer[];
  floors: string[];
  userRole: string;
  isAdmin?: boolean;
  onNavigateToPlayer?: (playerId: string) => void;
  highlightedEntryId?: string | null;
  highlightedEntryType?: 'loot' | 'material' | null;
  /** Target week for navigation (switches to this week when set) */
  targetWeek?: number | null;
  /** Open Log Loot modal (from keyboard shortcut) */
  openLogLootModal?: boolean;
  onLogLootModalClose?: () => void;
  /** Open Log Material modal (from keyboard shortcut) */
  openLogMaterialModal?: boolean;
  onLogMaterialModalClose?: () => void;
  /** Open Mark Floor Cleared modal (from keyboard shortcut) */
  openMarkFloorClearedModal?: boolean;
  onMarkFloorClearedModalClose?: () => void;
}

export function HistoryView({
  groupId,
  tierId,
  players,
  floors,
  userRole,
  isAdmin = false,
  onNavigateToPlayer,
  highlightedEntryId,
  highlightedEntryType,
  targetWeek,
  openLogLootModal,
  onLogLootModalClose,
  openLogMaterialModal,
  onLogMaterialModalClose,
  openMarkFloorClearedModal,
  onMarkFloorClearedModalClose,
}: HistoryViewProps) {
  const {
    currentWeek,
    maxWeek,
    weeksWithEntries,
    weekDataTypes,
    fetchCurrentWeek,
    fetchWeekDataTypes,
  } = useLootTrackingStore();

  // Get localStorage key for this tier's week selection
  const weekStorageKey = `history-week-${groupId}-${tierId}`;

  // Initialize selected week from localStorage or default to currentWeek
  const [selectedWeek, setSelectedWeekState] = useState(() => {
    try {
      const saved = localStorage.getItem(weekStorageKey);
      return saved ? parseInt(saved, 10) : currentWeek;
    } catch {
      return currentWeek;
    }
  });

  // Persist week selection to localStorage
  const setSelectedWeek = useCallback((week: number) => {
    setSelectedWeekState(week);
    try {
      localStorage.setItem(weekStorageKey, String(week));
    } catch {
      // Ignore localStorage errors
    }
  }, [weekStorageKey]);

  // Fetch current week and week data types on mount
  useEffect(() => {
    fetchCurrentWeek(groupId, tierId);
    fetchWeekDataTypes(groupId, tierId);
  }, [groupId, tierId, fetchCurrentWeek, fetchWeekDataTypes]);

  // Sync selected week with store's current week only on first load (when no saved value)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(weekStorageKey);
      if (!saved) {
        setSelectedWeek(currentWeek);
      }
    } catch {
      setSelectedWeek(currentWeek);
    }
  }, [currentWeek, weekStorageKey, setSelectedWeek]);

  // Switch to target week when navigation occurs (from gear slot → loot entry)
  useEffect(() => {
    if (targetWeek != null && targetWeek !== selectedWeek) {
      setSelectedWeek(targetWeek);
    }
  }, [targetWeek, selectedWeek, setSelectedWeek]);

  const handleWeekChange = (week: number) => {
    setSelectedWeek(week);
  };

  // Determine if user can edit (Owner/Lead or Admin)
  const canEdit = ['owner', 'lead'].includes(userRole) || isAdmin;

  return (
    <div className="space-y-4">
      {/* Week selector */}
      <div className="flex justify-center">
        <WeekSelector
          currentWeek={selectedWeek}
          maxWeek={maxWeek}
          calculatedCurrentWeek={currentWeek}
          onWeekChange={handleWeekChange}
          weeksWithEntries={weeksWithEntries}
          weekDataTypes={weekDataTypes}
        />
      </div>

      {/* Sectioned log view */}
      <SectionedLogView
        groupId={groupId}
        tierId={tierId}
        players={players}
        floors={floors}
        currentWeek={selectedWeek}
        canEdit={canEdit}
        onWeekChange={handleWeekChange}
        onNavigateToPlayer={onNavigateToPlayer}
        highlightedEntryId={highlightedEntryId}
        highlightedEntryType={highlightedEntryType}
        openLogLootModal={openLogLootModal}
        onLogLootModalClose={onLogLootModalClose}
        openLogMaterialModal={openLogMaterialModal}
        onLogMaterialModalClose={onLogMaterialModalClose}
        openMarkFloorClearedModal={openMarkFloorClearedModal}
        onMarkFloorClearedModalClose={onMarkFloorClearedModalClose}
      />
    </div>
  );
}
