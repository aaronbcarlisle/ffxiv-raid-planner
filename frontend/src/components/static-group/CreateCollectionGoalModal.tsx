/* eslint-disable design-system/no-raw-button */
import { useState } from 'react';
import { Target } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../primitives/Button';
import {
  useCollectionGoalStore,
  type CollectionGoalCreate,
  type CollectionGoalType,
  type CollectionGoalStatus,
} from '../../stores/collectionGoalStore';

interface CreateCollectionGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
}

const GOAL_TYPE_OPTIONS: { value: CollectionGoalType; label: string }[] = [
  { value: 'mount', label: 'Mount' },
  { value: 'token', label: 'Token / Totem' },
  { value: 'minion', label: 'Minion' },
  { value: 'orchestrion', label: 'Orchestrion Roll' },
  { value: 'glam', label: 'Glamour / Other Item' },
  { value: 'custom_reward', label: 'Custom / Other Reward' },
];

const STATUS_OPTIONS: { value: CollectionGoalStatus; label: string }[] = [
  { value: 'wanted', label: 'Wanted — planning to farm' },
  { value: 'farming', label: 'Farming — actively running' },
  { value: 'scheduled', label: 'Scheduled — on the calendar' },
  { value: 'complete', label: 'Complete — obtained' },
];

const GOAL_TYPE_PLACEHOLDERS: Record<CollectionGoalType, string> = {
  mount: 'e.g. Lynx of Fallen Shadow',
  token: 'e.g. Skyruin Totem ×99',
  minion: 'e.g. Wind-up Zodiark',
  orchestrion: 'e.g. Close in the Distance',
  glam: 'e.g. Augmented Credendum Coat',
  custom_reward: 'e.g. Gordian Weapon Coffer',
};

interface FormState {
  goalType: CollectionGoalType;
  title: string;
  status: CollectionGoalStatus;
  summary: string;
  linkedDutyId: string;
  targetCount: string;
  currentCount: string;
  note: string;
}

const EMPTY_FORM: FormState = {
  goalType: 'mount',
  title: '',
  status: 'wanted',
  summary: '',
  linkedDutyId: '',
  targetCount: '',
  currentCount: '',
  note: '',
};

export function CreateCollectionGoalModal({
  isOpen,
  onClose,
  groupId,
}: CreateCollectionGoalModalProps) {
  const { createGoal } = useCollectionGoalStore();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const patch = (update: Partial<FormState>) => setForm((prev) => ({ ...prev, ...update }));

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setError(null);
    onClose();
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required.'); return; }

    const targetNum = form.targetCount.trim() ? parseInt(form.targetCount.trim(), 10) : null;
    const currentNum = form.currentCount.trim() ? parseInt(form.currentCount.trim(), 10) : null;

    if (form.targetCount.trim() && (isNaN(targetNum!) || targetNum! < 0)) {
      setError('Target count must be a non-negative whole number.'); return;
    }
    if (form.currentCount.trim() && (isNaN(currentNum!) || currentNum! < 0)) {
      setError('Current count must be a non-negative whole number.'); return;
    }

    const data: CollectionGoalCreate = {
      goalType: form.goalType,
      title: form.title.trim(),
      status: form.status,
      summary: form.summary.trim() || null,
      linkedDutyId: form.linkedDutyId.trim() || null,
      targetCount: targetNum,
      currentCount: currentNum,
      note: form.note.trim() || null,
    };

    setIsSaving(true);
    setError(null);
    try {
      await createGoal(groupId, data);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save goal.');
    } finally {
      setIsSaving(false);
    }
  };

  const showCountFields = form.goalType === 'token';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <span className="flex items-center gap-2">
          <Target className="w-4 h-4 text-accent" />
          Create Collection Goal
        </span>
      }
      size="lg"
    >
      <div className="space-y-4">
        {/* Type + Status row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-secondary">Type</label>
            <Select
              value={form.goalType}
              onChange={(v) => patch({ goalType: v as CollectionGoalType, title: '' })}
              options={GOAL_TYPE_OPTIONS}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-text-secondary">Status</label>
            <Select
              value={form.status}
              onChange={(v) => patch({ status: v as CollectionGoalStatus })}
              options={STATUS_OPTIONS}
            />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-text-secondary">Title</label>
          <Input
            value={form.title}
            onChange={(v) => patch({ title: v })}
            placeholder={GOAL_TYPE_PLACEHOLDERS[form.goalType]}
            autoFocus
          />
        </div>

        {/* Summary (optional) */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-text-secondary">
            Summary
            <span className="ml-1 font-normal text-text-muted">(optional)</span>
          </label>
          <Input
            value={form.summary}
            onChange={(v) => patch({ summary: v })}
            placeholder="Short description shown on the overview card"
          />
        </div>

        {/* Token/Totem count tracking */}
        {showCountFields && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">
                Target count
                <span className="ml-1 font-normal text-text-muted">(optional)</span>
              </label>
              <Input
                value={form.targetCount}
                onChange={(v) => patch({ targetCount: v })}
                placeholder="e.g. 99"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-text-secondary">
                Current count
                <span className="ml-1 font-normal text-text-muted">(optional)</span>
              </label>
              <Input
                value={form.currentCount}
                onChange={(v) => patch({ currentCount: v })}
                placeholder="e.g. 40"
              />
            </div>
          </div>
        )}

        {/* Note (optional) */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-text-secondary">
            Internal note
            <span className="ml-1 font-normal text-text-muted">(optional, lead-only)</span>
          </label>
          <Input
            value={form.note}
            onChange={(v) => patch({ note: v })}
            placeholder="e.g. Target week-1 drop, or save coffer for tank first"
          />
        </div>

        {error && <p className="text-sm text-status-error">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving || !form.title.trim()}>
            {isSaving ? 'Saving…' : 'Create Goal'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
