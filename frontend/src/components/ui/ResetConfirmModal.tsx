/**
 * ResetConfirmModal - Type-to-confirm destructive reset modal
 *
 * Requires user to type "RESET" to enable the confirm button.
 * Used for dangerous bulk delete operations.
 */

import { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { Modal } from './Modal';
import { Label } from './Label';
import { Input } from './Input';
import { Button } from '../primitives';

// Scope: what data to reset
export type ResetScope = 'week' | 'floor' | 'all';

// Target: which type of data
export type ResetTarget = 'loot' | 'books' | 'data';

export interface ResetConfig {
  scope: ResetScope;
  target: ResetTarget;
  /** Week number (required for 'week' and 'floor' scope) */
  week?: number;
  /** Floor number 1-4 (required for 'floor' scope) */
  floor?: number;
  /** Player ID (for player-specific book reset) */
  playerId?: string;
  /** Player name (for player-specific book reset, used in confirmation text) */
  playerName?: string;
}

// Legacy type for backward compatibility
export type ResetType = 'loot' | 'books' | 'all';

interface ResetConfirmModalProps {
  isOpen: boolean;
  /** New config-based approach */
  config?: ResetConfig;
  /** @deprecated Use config instead */
  resetType?: ResetType;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

function getResetDescription(config: ResetConfig): string {
  const { scope, target, week, floor, playerName } = config;

  // Player-specific book reset
  if (playerName) {
    return `${playerName}'s book entries for Week ${week}`;
  }

  // Floor-specific reset
  if (scope === 'floor' && floor) {
    if (target === 'loot') return `loot entries for Floor ${floor} in Week ${week}`;
    if (target === 'books') return `book entries for Floor ${floor} in Week ${week}`;
    return `all data for Floor ${floor} in Week ${week}`;
  }

  // Week-specific reset
  if (scope === 'week' && week) {
    if (target === 'loot') return `loot entries for Week ${week}`;
    if (target === 'books') return `book entries for Week ${week}`;
    return `all data for Week ${week}`;
  }

  // All (tier-wide) reset
  if (target === 'loot') return 'ALL loot entries for this tier';
  if (target === 'books') return 'ALL book balances for this tier';
  return 'ALL data (loot and books) for this tier';
}

// Convert legacy resetType to new config
function legacyToConfig(resetType: ResetType): ResetConfig {
  if (resetType === 'loot') return { scope: 'all', target: 'loot' };
  if (resetType === 'books') return { scope: 'all', target: 'books' };
  return { scope: 'all', target: 'data' };
}

export function ResetConfirmModal({
  isOpen,
  config,
  resetType,
  onConfirm,
  onCancel,
}: ResetConfirmModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Use config if provided, otherwise convert legacy resetType
  const effectiveConfig = config ?? (resetType ? legacyToConfig(resetType) : { scope: 'all', target: 'data' });

  // Reset the confirm text when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setConfirmText('');
      setIsResetting(false);
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (confirmText !== 'RESET') return;
    setIsResetting(true);
    try {
      await onConfirm();
    } finally {
      setIsResetting(false);
    }
  };

  const canConfirm = confirmText === 'RESET' && !isResetting;
  const description = getResetDescription(effectiveConfig);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={
        <span className="flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-status-error" />
          Confirm Reset
        </span>
      }
      size="md"
    >
      <div className="space-y-4">
        {/* Warning icon and message */}
        <div className="flex items-start gap-3 p-3 rounded-lg border bg-status-error/10 border-status-error/30">
          <svg className="w-6 h-6 flex-shrink-0 mt-0.5 text-status-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-medium text-status-error">
              This action cannot be undone
            </p>
            <p className="text-sm text-text-secondary mt-1">
              This will permanently delete {description}.
            </p>
          </div>
        </div>

        {/* Type to confirm */}
        <div className="space-y-2">
          <Label htmlFor="reset-confirm">
            Type <span className="font-mono font-bold text-text-primary">RESET</span> to confirm:
          </Label>
          <Input
            id="reset-confirm"
            value={confirmText}
            onChange={setConfirmText}
            placeholder="Type RESET"
            disabled={isResetting}
            autoFocus
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isResetting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleConfirm}
            disabled={!canConfirm}
            loading={isResetting}
          >
            Reset
          </Button>
        </div>
      </div>
    </Modal>
  );
}
