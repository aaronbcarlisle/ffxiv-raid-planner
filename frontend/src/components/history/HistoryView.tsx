/**
 * History View
 *
 * Main container for the History tab.
 * Shows loot log and page balances side-by-side with week navigation.
 */

import { useState, useEffect } from 'react';
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
  const { currentWeek, fetchCurrentWeek } = useLootTrackingStore();
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);

  // Fetch current week on mount
  useEffect(() => {
    fetchCurrentWeek(groupId, tierId);
  }, [groupId, tierId, fetchCurrentWeek]);

  // Sync selected week with store's current week
  useEffect(() => {
    setSelectedWeek(currentWeek);
  }, [currentWeek]);

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
          maxWeek={currentWeek}
          onWeekChange={handleWeekChange}
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
