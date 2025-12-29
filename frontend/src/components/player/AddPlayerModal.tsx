import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Checkbox } from '../ui/Checkbox';
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
    });

    // Reset form
    setName('');
    setJob('');
    setNotes('');
    setIsSubstitute(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Player">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="playerName" className="block text-text-secondary mb-1 text-sm">
            Player Name
          </label>
          <input
            id="playerName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Cloud Strife"
            className="w-full bg-surface-base border border-border-default rounded-lg px-4 py-2 text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="block text-text-secondary mb-1 text-sm">
            Job
          </label>
          <JobPicker value={job} onChange={setJob} />
        </div>

        <div>
          <label htmlFor="playerNotes" className="block text-text-secondary mb-1 text-sm">
            Notes <span className="text-text-muted">(optional)</span>
          </label>
          <input
            id="playerNotes"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Out Dec 28-Jan 2"
            className="w-full bg-surface-base border border-border-default rounded-lg px-4 py-2 text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </div>

        <Checkbox
          checked={isSubstitute}
          onChange={setIsSubstitute}
          label="This player is a substitute"
        />

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-surface-base border border-border-default px-4 py-2 rounded-lg text-text-secondary hover:text-text-primary hover:border-text-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || !job}
            className="flex-1 bg-accent text-bg-primary px-4 py-2 rounded-lg font-medium hover:bg-accent-bright disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Player
          </button>
        </div>
      </form>
    </Modal>
  );
}
