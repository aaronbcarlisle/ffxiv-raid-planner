import { useState } from 'react';
import type { RoleInStatic, StaticCharacterRegistration, StaticCharacterRegistrationCreate } from '../../types';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Button } from '../primitives';

interface AddManualCharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  snapshotPlayerId: string;
  /** If provided, we're editing an existing registration. */
  editing?: StaticCharacterRegistration | null;
  onSave: (payload: StaticCharacterRegistrationCreate) => Promise<void>;
}

const ROLE_OPTIONS: { value: RoleInStatic; label: string }[] = [
  { value: 'main', label: 'Main' },
  { value: 'alt', label: 'Alt' },
  { value: 'substitute', label: 'Substitute' },
  { value: 'manual', label: 'Manual (no role)' },
];

export function AddManualCharacterModal({
  isOpen,
  onClose,
  playerName,
  snapshotPlayerId,
  editing,
  onSave,
}: AddManualCharacterModalProps) {
  const [name, setName] = useState(editing?.manualCharacterName ?? editing?.resolvedName ?? '');
  const [world, setWorld] = useState(editing?.manualWorld ?? editing?.resolvedWorld ?? '');
  const [dc, setDc] = useState(editing?.manualDataCenter ?? editing?.resolvedDataCenter ?? '');
  const [role, setRole] = useState<RoleInStatic>(editing?.roleInStatic ?? 'alt');
  const [job, setJob] = useState(editing?.job ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName(editing?.manualCharacterName ?? '');
    setWorld(editing?.manualWorld ?? '');
    setDc(editing?.manualDataCenter ?? '');
    setRole(editing?.roleInStatic ?? 'alt');
    setJob(editing?.job ?? '');
    setError(null);
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Character name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        snapshotPlayerId,
        manualCharacterName: name.trim(),
        manualWorld: world.trim() || null,
        manualDataCenter: dc.trim() || null,
        roleInStatic: role,
        job: job.trim() || null,
        source: 'manual',
      });
      reset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (saving) return;
    reset();
    onClose();
  }

  const title = editing ? `Edit character — ${playerName}` : `Add manual character — ${playerName}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="accent-subtle"
            size="sm"
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add character'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {error && (
          <p className="text-sm text-status-error bg-status-error/10 rounded-lg px-3 py-2">{error}</p>
        )}

        <div>
          <Label size="sm" required>Character name</Label>
          <Input
            value={name}
            onChange={setName}
            placeholder="Firstname Lastname"
            aria-label="Character name"
          />
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <Label size="sm">World</Label>
            <Input value={world} onChange={setWorld} placeholder="Tonberry" aria-label="World" />
          </div>
          <div className="flex-1">
            <Label size="sm">Data center</Label>
            <Input value={dc} onChange={setDc} placeholder="Elemental" aria-label="Data center" />
          </div>
        </div>

        <div>
          <Label size="sm">Role in static</Label>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_OPTIONS.map(opt => (
              <Button
                key={opt.value}
                type="button"
                size="sm"
                variant={role === opt.value ? 'accent-subtle' : 'secondary'}
                onClick={() => setRole(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <Label size="sm">Job (optional)</Label>
          <Input
            value={job}
            onChange={v => setJob(v.toUpperCase().slice(0, 5))}
            placeholder="DRK"
            className="w-24"
            aria-label="Job abbreviation"
          />
        </div>
      </div>
    </Modal>
  );
}
