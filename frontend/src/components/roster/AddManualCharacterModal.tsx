import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import type { RoleInStatic, StaticCharacterRegistration, StaticCharacterRegistrationCreate } from '../../types';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { JobIcon } from '../ui/JobIcon';
import { WorldSelect } from '../player/WorldSelect';
import { JobPicker } from '../player/JobPicker';
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
  const [showJobPicker, setShowJobPicker] = useState(false);
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={<span className="flex items-center gap-2"><UserPlus className="w-5 h-5" />{editing ? 'Edit Character' : 'Add Character'}</span>}
      size="md"
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
        <p className="text-sm text-text-muted">for {playerName}</p>

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

        <div>
          <Label size="sm">Data center &amp; world</Label>
          <WorldSelect showDataCenter dataCenter={dc} onDataCenterChange={setDc} world={world} onWorldChange={setWorld} />
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
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowJobPicker(v => !v)}
              aria-label="Select job"
            >
              {job
                ? <span className="flex items-center gap-1.5"><JobIcon job={job} className="w-4 h-4" />{job}</span>
                : 'Select job'}
            </Button>
            {job && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setJob('')}>
                Clear
              </Button>
            )}
          </div>
          {showJobPicker && (
            <div className="mt-2">
              <JobPicker
                selectedJob={job}
                onJobSelect={(j) => { setJob(j); setShowJobPicker(false); }}
                onRequestClose={() => setShowJobPicker(false)}
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
