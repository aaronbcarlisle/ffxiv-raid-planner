/**
 * AdminAssignUserModal - Admin-only modal for assigning users to player cards
 *
 * Allows admins to assign any Discord user ID to a player card or unassign.
 */

import { useState } from 'react';
import { Modal, Input } from '../ui';
import { Button } from '../primitives';
import { Link2, X } from 'lucide-react';
import type { SnapshotPlayer } from '../../types';

interface AdminAssignUserModalProps {
  player: SnapshotPlayer;
  onClose: () => void;
  onAssign: (userId: string | null) => void;
}

export function AdminAssignUserModal({
  player,
  onClose,
  onAssign,
}: AdminAssignUserModalProps) {
  const [discordId, setDiscordId] = useState(player.userId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAssign = async () => {
    setIsSubmitting(true);
    try {
      await onAssign(discordId.trim() || null);
    } catch (error) {
      console.error('Failed to assign user:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnassign = async () => {
    setIsSubmitting(true);
    try {
      await onAssign(null);
    } catch (error) {
      console.error('Failed to unassign user:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-status-warning" />
          Assign User to {player.name}
        </span>
      }
      size="md"
    >
      <div className="space-y-4">
        {/* Warning */}
        <div className="p-3 bg-status-warning/10 border border-status-warning/20 rounded-lg">
          <p className="text-sm text-status-warning">
            <strong>Admin Only:</strong> This action bypasses normal ownership restrictions.
          </p>
        </div>

        {/* Current status */}
        {player.userId && player.linkedUser && (
          <div className="p-3 bg-surface-elevated rounded-lg">
            <p className="text-sm text-text-secondary mb-1">Currently Assigned To:</p>
            <p className="text-text-primary font-medium">
              {player.linkedUser.displayName}{' '}
              <span className="text-text-muted">({player.userId})</span>
            </p>
          </div>
        )}

        {/* Discord ID input */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Discord User ID
          </label>
          <Input
            type="text"
            value={discordId}
            onChange={(e) => setDiscordId(e.target.value)}
            placeholder="Enter Discord User ID"
            className="w-full"
            disabled={isSubmitting}
          />
          <p className="text-xs text-text-muted mt-1">
            Enter the 18-digit Discord User ID, or leave blank to unassign.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={handleAssign}
            disabled={isSubmitting || discordId === player.userId}
            className="flex-1"
          >
            {discordId.trim() ? 'Assign User' : 'Unassign'}
          </Button>

          {player.userId && (
            <Button
              type="button"
              variant="danger"
              onClick={handleUnassign}
              disabled={isSubmitting}
              title="Remove current assignment"
            >
              <X className="w-4 h-4" />
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
