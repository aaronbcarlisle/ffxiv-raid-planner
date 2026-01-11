import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Modal, Checkbox, Label, Input } from '../ui';
import { Button } from '../primitives';
import { JobPicker } from './JobPicker';
import { getRoleForJob } from '../../gamedata';
import type { SnapshotPlayer, GearSlotStatus } from '../../types';
import { GEAR_SLOTS } from '../../types';

interface AddPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (player: Omit<SnapshotPlayer, 'id' | 'tierSnapshotId' | 'createdAt' | 'updatedAt'>) => void;
  existingPlayerCount: number;
}

// Create default gear with all slots empty
// Ring2 defaults to tome since you can't equip two identical raid rings
function createDefaultGear(): GearSlotStatus[] {
  return GEAR_SLOTS.map((slot) => ({
    slot,
    bisSource: slot === 'ring2' ? 'tome' as const : 'raid' as const,
    hasItem: false,
    isAugmented: false,
  }));
}

export function AddPlayerModal({ isOpen, onClose, onAdd, existingPlayerCount }: AddPlayerModalProps) {
  const [name, setName] = useState('');
  const [job, setJob] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubstitute, setIsSubstitute] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !job) return;

    const role = getRoleForJob(job);
    if (!role) return;

    onAdd({
      name: name.trim(),
      job,
      role,
      configured: true,
      sortOrder: existingPlayerCount,
      isSubstitute,
      notes: notes.trim() || undefined,
      gear: createDefaultGear(),
      tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false },
      weaponPriorities: [],
      weaponPrioritiesLocked: false,
    });

    // Reset form
    setName('');
    setJob('');
    setNotes('');
    setIsSubstitute(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Add Player
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="playerName">Player Name</Label>
          <Input
            id="playerName"
            value={name}
            onChange={setName}
            placeholder="e.g., Cloud Strife"
            autoFocus
          />
        </div>

        <div>
          <Label>Job</Label>
          <JobPicker selectedJob={job} onJobSelect={setJob} />
        </div>

        <div>
          <Label htmlFor="playerNotes">
            Notes <span className="text-text-muted">(optional)</span>
          </Label>
          <Input
            id="playerNotes"
            value={notes}
            onChange={setNotes}
            placeholder="e.g., Out Dec 28-Jan 2"
          />
        </div>

        <Checkbox
          checked={isSubstitute}
          onChange={setIsSubstitute}
          label="This player is a substitute"
        />

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || !job} className="flex-1">
            Add Player
          </Button>
        </div>
      </form>
    </Modal>
  );
}
