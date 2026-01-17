/**
 * History View
 *
 * Main container for the History tab (now called "Log" tab).
 * Shows sectioned view with Loot, Materials, and Books sections.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { toast } from '../../stores/toastStore';
import { logger } from '../../lib/logger';
import { WeekSelector } from './WeekSelector';
import { SectionedLogView } from './SectionedLogView';
import { RevertWeekConfirmModal } from './RevertWeekConfirmModal';
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
    lootLog,
    materialLog,
    pageLedger,
    fetchCurrentWeek,
    fetchWeekDataTypes,
    fetchLootLog,
    fetchMaterialLog,
    fetchPageLedger,
    startNextWeek,
    revertWeek,
  } = useLootTrackingStore();

  // URL state management
  const [searchParams, setSearchParams] = useSearchParams();

  // State for start next week and revert week actions
  const [isStartingNextWeek, setIsStartingNextWeek] = useState(false);
  const [isRevertingWeek, setIsRevertingWeek] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);

  // Get localStorage key for this tier's week selection
  const weekStorageKey = `history-week-${groupId}-${tierId}`;

  // Initialize selected week from URL param > localStorage > currentWeek
  const [selectedWeek, setSelectedWeekState] = useState(() => {
    const urlWeek = searchParams.get('week');
    if (urlWeek) {
      const parsed = parseInt(urlWeek, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    try {
      const saved = localStorage.getItem(weekStorageKey);
      return saved ? parseInt(saved, 10) : currentWeek;
    } catch {
      return currentWeek;
    }
  });

  // Persist week selection to localStorage and URL
  const setSelectedWeek = useCallback((week: number) => {
    setSelectedWeekState(week);
    try {
      localStorage.setItem(weekStorageKey, String(week));
    } catch {
      // Ignore localStorage errors
    }
    // Update URL - omit if viewing current calculated week
    // Use getState() to avoid currentWeek in dependency array (prevents unnecessary recreations)
    const storeCurrentWeek = useLootTrackingStore.getState().currentWeek;
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (week === storeCurrentWeek) {
        params.delete('week');
      } else {
        params.set('week', String(week));
      }
      return params;
    }, { replace: true });
  }, [weekStorageKey, setSearchParams]);

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
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing with external store value on first load
        setSelectedWeek(currentWeek);
      }
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Fallback sync with external store value
      setSelectedWeek(currentWeek);
    }
  }, [currentWeek, weekStorageKey, setSelectedWeek]);

  // Switch to target week when navigation occurs (from gear slot → loot entry)
  useEffect(() => {
    if (targetWeek != null && targetWeek !== selectedWeek) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Controlled prop sync for navigation
      setSelectedWeek(targetWeek);
    }
  }, [targetWeek, selectedWeek, setSelectedWeek]);

  const handleWeekChange = (week: number) => {
    setSelectedWeek(week);
  };

  // Handler for starting the next week manually
  const handleStartNextWeek = useCallback(async () => {
    setIsStartingNextWeek(true);
    try {
      const newWeek = await startNextWeek(groupId, tierId);
      setSelectedWeek(newWeek);
      toast.success(`Advanced to Week ${newWeek}`);
    } catch {
      toast.error('Failed to start next week');
    } finally {
      setIsStartingNextWeek(false);
    }
  }, [groupId, tierId, startNextWeek, setSelectedWeek]);

  // Handler for confirming the revert (extracted to avoid circular dependency)
  const executeRevert = useCallback(async () => {
    setIsRevertingWeek(true);
    setShowRevertConfirm(false);
    try {
      const newWeek = await revertWeek(groupId, tierId);
      setSelectedWeek(newWeek);
      // Refresh week data types to update the selector (non-critical)
      try {
        await fetchWeekDataTypes(groupId, tierId);
      } catch {
        // Secondary fetch failed - week selector may be stale until next page load
        logger.warn('Failed to refresh week data types after revert');
      }
      toast.success(`Reverted to Week ${newWeek}`);
    } catch {
      toast.error('Failed to revert week');
    } finally {
      setIsRevertingWeek(false);
    }
  }, [groupId, tierId, revertWeek, setSelectedWeek, fetchWeekDataTypes]);

  // Handler for revert week button click - show confirm if data exists
  const handleRevertWeekClick = useCallback(async () => {
    // Prevent double-clicks during the check/revert process
    if (isRevertingWeek) return;
    setIsRevertingWeek(true);

    try {
      // Fetch the latest data for the current week to show in the modal
      await Promise.all([
        fetchLootLog(groupId, tierId),
        fetchMaterialLog(groupId, tierId),
        fetchPageLedger(groupId, tierId),
      ]);

      // Re-check with fresh data (store will have updated)
      const store = useLootTrackingStore.getState();
      const hasLoot = store.lootLog.some((e) => e.weekNumber === currentWeek);
      const hasMaterials = store.materialLog.some((e) => e.weekNumber === currentWeek);
      const hasBooks = store.pageLedger.some((e) => e.weekNumber === currentWeek);

      if (hasLoot || hasMaterials || hasBooks) {
        // Show confirmation modal (will reset loading when user cancels or confirms)
        setShowRevertConfirm(true);
        setIsRevertingWeek(false); // Reset loading - modal will handle next step
      } else {
        // No data, proceed directly (executeRevert will manage its own loading state)
        setIsRevertingWeek(false);
        await executeRevert();
      }
    } catch {
      toast.error('Failed to check week data');
      setIsRevertingWeek(false);
    }
  }, [groupId, tierId, fetchLootLog, fetchMaterialLog, fetchPageLedger, currentWeek, executeRevert, isRevertingWeek]);

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
          onStartNextWeek={canEdit ? handleStartNextWeek : undefined}
          isStartingNextWeek={isStartingNextWeek}
          onRevertWeek={canEdit ? handleRevertWeekClick : undefined}
          isRevertingWeek={isRevertingWeek}
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

      {/* Revert week confirmation modal */}
      <RevertWeekConfirmModal
        isOpen={showRevertConfirm}
        week={currentWeek}
        lootLog={lootLog}
        materialLog={materialLog}
        pageLedger={pageLedger}
        players={players}
        isReverting={isRevertingWeek}
        onConfirm={executeRevert}
        onCancel={() => setShowRevertConfirm(false)}
      />
    </div>
  );
}
