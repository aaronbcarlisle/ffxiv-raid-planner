import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../primitives/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Label } from '../ui/Label';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import type { CollectionGoal, CollectionGoalCreate, CollectionGoalUpdate, CollectionGoalType, CollectionGoalStatus, CollectionPriorityMode } from '../../stores/collectionGoalStore';
import { toast } from '../../stores/toastStore';

const GOAL_TYPE_OPTIONS: { value: CollectionGoalType; label: string }[] = [
  { value: 'mount', label: 'Mount' },
  { value: 'orchestrion', label: 'Orchestrion Roll (Music)' },
  { value: 'minion', label: 'Minion' },
  { value: 'glam', label: 'Glamour / Fashion' },
  { value: 'title', label: 'Title' },
  { value: 'weapon', label: 'Weapon' },
  { value: 'weapon_coffer', label: 'Weapon Coffer' },
  { value: 'token', label: 'Token' },
  { value: 'custom_reward', label: 'Custom Reward' },
  { value: 'clear_count', label: 'Clear Count' },
];

const STATUS_OPTIONS: { value: CollectionGoalStatus; label: string }[] = [
  { value: 'wanted', label: 'Wanted (not yet farming)' },
  { value: 'farming', label: 'Actively farming' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'complete', label: 'Complete' },
];

const PRIORITY_MODE_OPTIONS: { value: CollectionPriorityMode | ''; label: string }[] = [
  { value: '', label: 'No priority mode' },
  { value: 'everyone_gets_one', label: 'Everyone gets one' },
  { value: 'priority_order', label: 'Priority order' },
  { value: 'free_roll', label: 'Free roll' },
  { value: 'desired_only', label: 'Desired only (want/need)' },
  { value: 'custom', label: 'Custom' },
];

const CONTENT_TYPE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'extreme', label: 'Extreme Trial' },
  { value: 'ultimate', label: 'Ultimate' },
  { value: 'unreal', label: 'Unreal' },
  { value: 'eureka', label: 'Eureka / Bozjan' },
  { value: 'deep_dungeon', label: 'Deep Dungeon' },
  { value: 'treasure_map', label: 'Treasure Map' },
  { value: 'criterion', label: 'Criterion / Savage' },
  { value: 'crafted', label: 'Crafted' },
  { value: 'other', label: 'Other' },
];

interface RewardGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  editGoal?: CollectionGoal | null;
}

export function RewardGoalModal({ isOpen, onClose, groupId, editGoal }: RewardGoalModalProps) {
  const { createGoal, updateGoal } = useCollectionGoalStore();

  const [title, setTitle] = useState('');
  const [goalType, setGoalType] = useState<CollectionGoalType>('mount');
  const [status, setStatus] = useState<CollectionGoalStatus>('farming');
  const [priorityMode, setPriorityMode] = useState<CollectionPriorityMode | ''>('');
  const [contentType, setContentType] = useState('');
  const [contentKey, setContentKey] = useState('');
  const [summary, setSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (editGoal) {
      setTitle(editGoal.title);
      setGoalType(editGoal.goalType);
      setStatus(editGoal.status);
      setPriorityMode(editGoal.priorityMode ?? '');
      setContentType(editGoal.contentType ?? '');
      setContentKey(editGoal.contentKey ?? '');
      setSummary(editGoal.summary ?? '');
    } else {
      setTitle('');
      setGoalType('mount');
      setStatus('farming');
      setPriorityMode('');
      setContentType('');
      setContentKey('');
      setSummary('');
    }
  }, [editGoal, isOpen]);

  async function handleSubmit() {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const baseData = {
        title: title.trim(),
        goalType,
        status,
        priorityMode: priorityMode || null,
        contentType: contentType as CollectionGoal['contentType'] || null,
        contentKey: contentKey.trim() || null,
        summary: summary.trim() || null,
      };

      if (editGoal) {
        const data: CollectionGoalUpdate = baseData;
        await updateGoal(groupId, editGoal.id, data);
        toast.success('Goal updated.');
      } else {
        const data: CollectionGoalCreate = baseData;
        await createGoal(groupId, data);
        toast.success('Goal created.');
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save goal');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editGoal ? 'Edit Collection Goal' : 'New Collection Goal'}
    >
      <div className="flex flex-col gap-4">
        <div>
          <Label className="block text-sm text-text-secondary mb-1">Title *</Label>
          <Input
            value={title}
            onChange={setTitle}
            placeholder="e.g. Valigarmanda EX Mount, Ultima Thule Orchestrion"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="block text-sm text-text-secondary mb-1">Type</Label>
            <Select
              value={goalType}
              onChange={(v) => setGoalType(v as CollectionGoalType)}
              options={GOAL_TYPE_OPTIONS}
            />
          </div>
          <div>
            <Label className="block text-sm text-text-secondary mb-1">Status</Label>
            <Select
              value={status}
              onChange={(v) => setStatus(v as CollectionGoalStatus)}
              options={STATUS_OPTIONS}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="block text-sm text-text-secondary mb-1">Content Type</Label>
            <Select
              value={contentType}
              onChange={setContentType}
              options={CONTENT_TYPE_OPTIONS}
            />
          </div>
          <div>
            <Label className="block text-sm text-text-secondary mb-1">Content Key (optional)</Label>
            <Input
              value={contentKey}
              onChange={setContentKey}
              placeholder="e.g. dt-valigarmanda"
            />
          </div>
        </div>

        <div>
          <Label className="block text-sm text-text-secondary mb-1">Priority Mode</Label>
          <Select
            value={priorityMode}
            onChange={(v) => setPriorityMode(v as CollectionPriorityMode | '')}
            options={PRIORITY_MODE_OPTIONS}
          />
        </div>

        <div>
          <Label className="block text-sm text-text-secondary mb-1">Notes (optional)</Label>
          <Input
            value={summary}
            onChange={setSummary}
            placeholder="Any extra context for the static"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !title.trim()}>
            {submitting ? 'Saving…' : editGoal ? 'Save Changes' : 'Create Goal'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
