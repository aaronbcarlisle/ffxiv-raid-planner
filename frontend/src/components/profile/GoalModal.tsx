import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../primitives/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { TextArea } from '../ui/TextArea';
import { usePlayerProfileStore } from '../../stores/playerProfileStore';
import type { PlayerGoal } from '../../stores/playerProfileStore';
import { toast } from '../../stores/toastStore';

const GOAL_TYPE_OPTIONS = [
  { value: 'mount_farm', label: 'Mount Farm' },
  { value: 'totem_farm', label: 'Totem Farm' },
  { value: 'weekly_clear', label: 'Weekly Clear' },
  { value: 'collection', label: 'Collection' },
  { value: 'personal', label: 'Personal' },
  { value: 'gear', label: 'Gear' },
  { value: 'raid', label: 'Raid' },
  { value: 'custom', label: 'Custom' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'paused', label: 'Paused' },
  { value: 'abandoned', label: 'Abandoned' },
];

interface GoalModalProps {
  existing?: PlayerGoal;
  defaultGoalType?: string;
  onClose: () => void;
}

export function GoalModal({ existing, defaultGoalType, onClose }: GoalModalProps) {
  const { createGoal, updateGoal } = usePlayerProfileStore();
  const isEditing = !!existing;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [goalType, setGoalType] = useState(existing?.goalType ?? defaultGoalType ?? 'personal');
  const [status, setStatus] = useState(existing?.status ?? 'active');
  const [currentCount, setCurrentCount] = useState(String(existing?.currentCount ?? 0));
  const [targetCount, setTargetCount] = useState(existing?.targetCount != null ? String(existing.targetCount) : '');
  const [sourceContent, setSourceContent] = useState(existing?.sourceContent ?? '');
  const [sourceItem, setSourceItem] = useState(existing?.sourceItem ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCountBased = targetCount !== '' && Number(targetCount) > 0;

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const data: Record<string, unknown> = {
        title: title.trim(),
        goalType,
        status,
        description: description.trim() || undefined,
        sourceContent: sourceContent.trim() || undefined,
        sourceItem: sourceItem.trim() || undefined,
        currentCount: isCountBased ? Number(currentCount) || 0 : 0,
        targetCount: isCountBased ? Number(targetCount) : undefined,
      };

      if (isEditing) {
        await updateGoal(existing.id, data);
        toast.success('Goal updated');
      } else {
        await createGoal(data as Parameters<typeof createGoal>[0]);
        toast.success('Goal created');
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const showSourceFields = ['mount_farm', 'totem_farm', 'weekly_clear', 'collection', 'raid'].includes(goalType);

  return (
    <Modal
      isOpen={true}
      title={isEditing ? 'Edit Goal' : 'New Goal'}
      onClose={onClose}
    >
      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Title</label> {/* design-system-ignore */}
          <Input
            value={title}
            onChange={setTitle}
            placeholder="e.g., Farm Valigarmanda mount"
            maxLength={200}
          />
        </div>

        {/* Goal type (only for new) */}
        {!isEditing && (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Type</label> {/* design-system-ignore */}
            <Select
              value={goalType}
              onChange={setGoalType}
              options={GOAL_TYPE_OPTIONS}
            />
          </div>
        )}

        {/* Status (only for editing) */}
        {isEditing && (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Status</label> {/* design-system-ignore */}
            <Select
              value={status}
              onChange={setStatus}
              options={STATUS_OPTIONS}
            />
          </div>
        )}

        {/* Source fields for content-based goals */}
        {showSourceFields && (
          <>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Content / Duty</label> {/* design-system-ignore */}
              <Input
                value={sourceContent}
                onChange={setSourceContent}
                placeholder="e.g., Worqor Lar Dor (Extreme)"
                maxLength={200}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Target Item</label> {/* design-system-ignore */}
              <Input
                value={sourceItem}
                onChange={setSourceItem}
                placeholder="e.g., Valigarmanda Totem"
                maxLength={200}
              />
            </div>
          </>
        )}

        {/* Count tracking */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Target Count</label> {/* design-system-ignore */}
            <Input
              value={targetCount}
              onChange={setTargetCount}
              placeholder="Leave empty for checkbox goal"
              type="number"
            />
          </div>
          {isCountBased && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Current Count</label> {/* design-system-ignore */}
              <Input
                value={currentCount}
                onChange={setCurrentCount}
                placeholder="0"
                type="number"
              />
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Notes</label> {/* design-system-ignore */}
          <TextArea
            value={description}
            onChange={setDescription}
            placeholder="Optional notes"
            maxLength={2000}
            rows={2}
          />
        </div>

        {error && (
          <div className="text-sm text-status-error bg-status-error/10 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !title.trim()}>
            {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Goal'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
