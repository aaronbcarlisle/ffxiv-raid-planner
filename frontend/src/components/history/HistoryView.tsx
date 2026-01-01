/**
 * History View
 *
 * Main container for the History tab.
 * Shows loot log and page balances side-by-side with week navigation.
 */

import { useState, useEffect, useCallback } from 'react';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { WeekSelector } from './WeekSelector';
import { LootLogPanel } from './LootLogPanel';
import { PageBalancesPanel } from './PageBalancesPanel';
import type { SnapshotPlayer } from '../../types';

interface HistoryViewProps {
  groupId: string;
  tierId: string;
  players: SnapshotPlayer[];
  floors: string[];
  userRole: string;
}

export function HistoryView({
  groupId,
  tierId,
  players,
  floors,
  userRole,
}: HistoryViewProps) {
  const { currentWeek, maxWeek, weeksWithEntries, fetchCurrentWeek, fetchWeeksWithEntries } = useLootTrackingStore();

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

  // Fetch current week and weeks with entries on mount
  useEffect(() => {
    fetchCurrentWeek(groupId, tierId);
    fetchWeeksWithEntries(groupId, tierId);
  }, [groupId, tierId, fetchCurrentWeek, fetchWeeksWithEntries]);

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

  const handleWeekChange = (week: number) => {
    setSelectedWeek(week);
  };

  // Determine if user can edit (Owner/Lead)
  const canEdit = ['owner', 'lead'].includes(userRole);

  return (
    <div className="space-y-4">
      {/* Week selector */}
      <div className="flex justify-center">
        <WeekSelector
          currentWeek={selectedWeek}
          maxWeek={maxWeek}
          onWeekChange={handleWeekChange}
          weeksWithEntries={weeksWithEntries}
        />
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Loot Log (left) */}
        <LootLogPanel
          groupId={groupId}
          tierId={tierId}
          players={players}
          floors={floors}
          currentWeek={selectedWeek}
          canEdit={canEdit}
          onLootLogged={(weekNumber) => setSelectedWeek(weekNumber)}
        />

        {/* Page Balances (right) */}
        <PageBalancesPanel
          groupId={groupId}
          tierId={tierId}
          players={players}
          floors={floors}
          currentWeek={selectedWeek}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
