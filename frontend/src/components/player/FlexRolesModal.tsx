import { useEffect, useState } from 'react';
import { XivIcon } from '../ui/XivIcon';
import { Button } from '../primitives';
import { Checkbox, Input, Modal, TextArea } from '../ui';
import type { FlexRole, SnapshotPlayer } from '../../types';

const FLEX_ROLE_OPTIONS: FlexRole[] = ['MT', 'ST', 'H1', 'H2', 'M1', 'M2', 'R1', 'R2'];
const MAX_FLEX_ROLES = 4;

interface FlexRolesModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: SnapshotPlayer;
  onSave: (updates: Pick<SnapshotPlayer, 'rosterTitle' | 'rosterNote' | 'flexRoles'>) => Promise<void> | void;
}

export function FlexRolesModal({ isOpen, onClose, player, onSave }: FlexRolesModalProps) {
  const [rosterTitle, setRosterTitle] = useState(player.rosterTitle ?? '');
  const [rosterNote, setRosterNote] = useState(player.rosterNote ?? '');
  const [selectedRoles, setSelectedRoles] = useState<FlexRole[]>(player.flexRoles ?? []);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRosterTitle(player.rosterTitle ?? '');
      setRosterNote(player.rosterNote ?? '');
      setSelectedRoles(player.flexRoles ?? []);
    }
  }, [isOpen, player.flexRoles, player.rosterNote, player.rosterTitle]);

  const toggleRole = (role: FlexRole) => {
    setSelectedRoles((current) => {
      if (current.includes(role)) {
        return current.filter((item) => item !== role);
      }
      if (current.length >= MAX_FLEX_ROLES) {
        return current;
      }
      return [...current, role];
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        rosterTitle: rosterTitle.trim() || null,
        rosterNote: rosterNote.trim() || null,
        flexRoles: selectedRoles,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title={
        <span className="flex items-center gap-2">
          <XivIcon name="crystal" size={20} />
          Roster personalization
        </span>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="text-sm text-text-secondary">
            Give {player.name || 'this player'} a little static-board flavor without changing their assigned raid slot.
          </p>
          <p className="mt-1 text-xs text-text-muted">
            These details are planning notes only and do not affect loot, gear priority, or availability.
          </p>
        </div>

        <div className="space-y-3">
          <Input
            value={rosterTitle}
            onChange={(value) => setRosterTitle(value.slice(0, 40))}
            maxLength={40}
            placeholder="Reclear gremlin, Alt job enjoyer..."
            helperText={`${rosterTitle.length}/40 characters`}
            disabled={isSaving}
            fullWidth
            aria-label="Roster title"
          />
          <TextArea
            value={rosterNote}
            onChange={(value) => setRosterNote(value.slice(0, 160))}
            maxLength={160}
            rows={3}
            placeholder="Usually comfy on ranged spots, can swap for prog nights."
            helperText={`${rosterNote.length}/160 characters`}
            disabled={isSaving}
            aria-label="Roster note"
          />
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
            Flex roles
          </p>
        <div className="grid grid-cols-2 gap-2" data-testid="flex-roles-options">
          {FLEX_ROLE_OPTIONS.map((role) => {
            const isSelected = selectedRoles.includes(role);
            const isDisabled = !isSelected && selectedRoles.length >= MAX_FLEX_ROLES;
            return (
              <Checkbox
                key={role}
                checked={isSelected}
                disabled={isDisabled || isSaving}
                onChange={() => toggleRole(role)}
                label={<span className="font-medium text-text-primary">{role}</span>}
                aria-label={`Toggle ${role} flex role`}
                className="rounded-lg border border-border-subtle bg-surface-elevated/60 px-2 py-2"
              />
            );
          })}
        </div>
          <p className="mt-2 text-xs text-text-muted">
            Pick up to {MAX_FLEX_ROLES}. Main assignment stays unchanged.
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save personalization'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
