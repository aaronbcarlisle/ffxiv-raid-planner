/**
 * Loot Log Modals
 *
 * Manages all modals for the loot tracking system:
 * - Add/Edit Loot Entry
 * - Log Material
 * - Mark Floor Cleared
 * - Edit Book Balance
 * - Player Ledger
 * - Reset Confirmation
 * - Generic Confirmation
 * - Context Menu
 */

import { AddLootEntryModal } from './AddLootEntryModal';
import { LogMaterialModal } from './LogMaterialModal';
import { MarkFloorClearedModal } from './MarkFloorClearedModal';
import { EditBookBalanceModal } from './EditBookBalanceModal';
import { PlayerLedgerModal } from './PlayerLedgerModal';
import { ResetConfirmModal, type ResetType } from '../ui/ResetConfirmModal';
import { ConfirmModal } from '../ui/ConfirmModal';
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu';
import type {
  SnapshotPlayer,
  LootLogEntry,
  LootLogEntryUpdate,
  MaterialLogEntry,
  MaterialLogEntryUpdate,
  MaterialType,
} from '../../types';

export interface LootLogModalsProps {
  // Loot Entry Modal
  showLootModal: boolean;
  onCloseLootModal: () => void;
  onAddLoot: (
    entry: Parameters<typeof AddLootEntryModal>[0]['onSubmit'] extends (entry: infer E, options: any) => any ? E : never,
    options: { updateGear: boolean }
  ) => Promise<void>;
  onUpdateLoot: (updates: LootLogEntryUpdate) => Promise<void>;
  lootModalKey: string;
  entryToEdit?: LootLogEntry;
  players: SnapshotPlayer[];
  floors: string[];
  currentWeek: number;
  gridModalState: { floor?: number; slot?: string; materialType?: MaterialType } | null;

  // Material Modal
  showMaterialModal: boolean;
  onCloseMaterialModal: () => void;
  onMaterialSubmit: (data: {
    weekNumber: number;
    floor: string;
    materialType: MaterialType;
    recipientPlayerId: string;
    notes?: string;
  }) => Promise<void>;
  onUpdateMaterial: (updates: MaterialLogEntryUpdate) => Promise<void>;
  materialEntryToEdit?: MaterialLogEntry;

  // Mark Floor Cleared Modal
  showFloorClearedModal: boolean;
  onCloseFloorClearedModal: () => void;
  onMarkFloorCleared: (data: {
    weekNumber: number;
    floor: string;
    playerIds: string[];
  }) => Promise<void>;

  // Edit Book Balance Modal
  editBookState: {
    playerId: string;
    playerName: string;
    bookType: 'I' | 'II' | 'III' | 'IV';
    currentValue: number;
  } | null;
  onCloseEditBook: () => void;
  onEditBookBalance: (adjustment: number) => Promise<void>;

  // Player Ledger Modal
  ledgerState: {
    playerId: string;
    playerName: string;
  } | null;
  onCloseLedger: () => void;
  groupId: string;
  tierId: string;
  canEdit: boolean;
  onHistoryCleared: () => void;

  // Reset Confirmation Modal
  resetModalType: ResetType | null;
  onResetConfirm: () => Promise<void>;
  onCancelReset: () => void;

  // Generic Confirmation Modal
  confirmState: {
    type: 'deleteLoot' | 'deleteMaterial' | 'resetRow' | 'resetColumn' | 'resetAll';
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  } | null;
  onCancelConfirm: () => void;

  // Context Menu
  listContextMenu: { x: number; y: number; entry?: LootLogEntry | MaterialLogEntry; type: 'loot' | 'material' } | null;
  listContextMenuItems: ContextMenuItem[];
  onCloseContextMenu: () => void;
}

export function LootLogModals({
  // Loot Entry Modal
  showLootModal,
  onCloseLootModal,
  onAddLoot,
  onUpdateLoot,
  lootModalKey,
  entryToEdit,
  players,
  floors,
  currentWeek,
  gridModalState,

  // Material Modal
  showMaterialModal,
  onCloseMaterialModal,
  onMaterialSubmit,
  onUpdateMaterial,
  materialEntryToEdit,

  // Mark Floor Cleared Modal
  showFloorClearedModal,
  onCloseFloorClearedModal,
  onMarkFloorCleared,

  // Edit Book Balance Modal
  editBookState,
  onCloseEditBook,
  onEditBookBalance,

  // Player Ledger Modal
  ledgerState,
  onCloseLedger,
  groupId,
  tierId,
  canEdit,
  onHistoryCleared,

  // Reset Confirmation Modal
  resetModalType,
  onResetConfirm,
  onCancelReset,

  // Generic Confirmation Modal
  confirmState,
  onCancelConfirm,

  // Context Menu
  listContextMenu,
  listContextMenuItems,
  onCloseContextMenu,
}: LootLogModalsProps) {
  return (
    <>
      {/* Add/Edit Loot Entry Modal */}
      {showLootModal && (
        <AddLootEntryModal
          key={lootModalKey}
          isOpen={showLootModal}
          onClose={onCloseLootModal}
          onSubmit={onAddLoot}
          onUpdate={onUpdateLoot}
          players={players}
          floors={floors}
          currentWeek={currentWeek}
          editEntry={entryToEdit}
          presetFloor={gridModalState?.floor ? floors[gridModalState.floor - 1] : undefined}
          presetSlot={gridModalState?.slot}
        />
      )}

      {/* Log Material Modal */}
      {showMaterialModal && (
        <LogMaterialModal
          isOpen={showMaterialModal}
          onClose={onCloseMaterialModal}
          onSubmit={onMaterialSubmit}
          onUpdate={onUpdateMaterial}
          players={players}
          floors={floors}
          currentWeek={currentWeek}
          presetFloor={gridModalState?.floor ? floors[gridModalState.floor - 1] : undefined}
          suggestedMaterial={gridModalState?.materialType as 'twine' | 'glaze' | 'solvent' | undefined}
          editEntry={materialEntryToEdit}
        />
      )}

      {/* Mark Floor Cleared Modal */}
      {showFloorClearedModal && (
        <MarkFloorClearedModal
          isOpen={showFloorClearedModal}
          onClose={onCloseFloorClearedModal}
          onSubmit={onMarkFloorCleared}
          players={players}
          floors={floors}
          currentWeek={currentWeek}
        />
      )}

      {/* Edit Book Balance Modal */}
      {editBookState && (
        <EditBookBalanceModal
          isOpen={!!editBookState}
          onClose={onCloseEditBook}
          onSubmit={onEditBookBalance}
          playerName={editBookState.playerName}
          bookType={editBookState.bookType}
          currentBalance={editBookState.currentValue}
        />
      )}

      {/* Player Ledger Modal */}
      {ledgerState && (
        <PlayerLedgerModal
          isOpen={!!ledgerState}
          onClose={onCloseLedger}
          groupId={groupId}
          tierId={tierId}
          playerId={ledgerState.playerId}
          playerName={ledgerState.playerName}
          canEdit={canEdit}
          onHistoryCleared={onHistoryCleared}
        />
      )}

      {/* Reset Confirmation Modal */}
      {resetModalType && (
        <ResetConfirmModal
          isOpen={!!resetModalType}
          resetType={resetModalType}
          onConfirm={onResetConfirm}
          onCancel={onCancelReset}
        />
      )}

      {/* Generic Confirmation Modal */}
      {confirmState && (
        <ConfirmModal
          isOpen={!!confirmState}
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.type.startsWith('delete') ? 'Delete' : 'Reset'}
          variant="danger"
          onConfirm={confirmState.onConfirm}
          onCancel={onCancelConfirm}
        />
      )}

      {/* List View Context Menu */}
      {listContextMenu && (
        <ContextMenu
          x={listContextMenu.x}
          y={listContextMenu.y}
          items={listContextMenuItems}
          onClose={onCloseContextMenu}
        />
      )}
    </>
  );
}
