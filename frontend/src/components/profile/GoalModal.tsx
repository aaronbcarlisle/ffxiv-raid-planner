import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../primitives/Button';
import { Badge } from '../primitives/Badge';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { TextArea } from '../ui/TextArea';
import { Spinner } from '../ui/Spinner';
import { usePlayerProfileStore } from '../../stores/playerProfileStore';
import type { PlayerGoal } from '../../stores/playerProfileStore';
import { api } from '../../services/api';
import { toast } from '../../stores/toastStore';

interface CatalogEntry {
  trialId: string;
  expansion: string;
  dutyName: string;
  mountName: string;
  totemName: string | null;
  totemTarget: number;
}

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

const EXPANSION_ORDER = ['DT', 'EW', 'ShB', 'SB', 'HW', 'ARR'];

interface GoalModalProps {
  existing?: PlayerGoal;
  defaultGoalType?: string;
  onClose: () => void;
}

type ModalMode = 'catalog' | 'custom';

export function GoalModal({ existing, defaultGoalType, onClose }: GoalModalProps) {
  const { createGoal, updateGoal } = usePlayerProfileStore();
  const isEditing = !!existing;
  const showCatalog = !isEditing && (defaultGoalType === 'mount_farm' || defaultGoalType === 'totem_farm');

  const [mode, setMode] = useState<ModalMode>(showCatalog ? 'catalog' : 'custom');
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

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

  useEffect(() => {
    if (mode === 'catalog' && catalog.length === 0) {
      setLoadingCatalog(true);
      api.get<{ entries: CatalogEntry[] }>('/api/player/mount-farm-catalog')
        .then((data) => setCatalog(data.entries))
        .catch(() => setMode('custom'))
        .finally(() => setLoadingCatalog(false));
    }
  }, [mode, catalog.length]);

  const isCountBased = targetCount !== '' && Number(targetCount) > 0;

  const handleCatalogSelect = async (entry: CatalogEntry) => {
    setSaving(true);
    setError(null);
    try {
      await createGoal({
        title: `${entry.mountName} Mount`,
        goalType: 'mount_farm',
        sourceContent: entry.trialId,
        sourceItem: entry.totemName ?? entry.mountName,
        targetCount: entry.totemTarget,
        currentCount: 0,
      });
      toast.success(`Added ${entry.mountName} mount farm`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create goal');
    } finally {
      setSaving(false);
    }
  };

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

  // Group catalog by expansion
  const groupedCatalog = EXPANSION_ORDER.map((exp) => ({
    expansion: exp,
    entries: catalog.filter((e) => e.expansion === exp),
  })).filter((g) => g.entries.length > 0);

  if (mode === 'catalog' && !isEditing) {
    return (
      <Modal isOpen={true} title="Add Mount Farm Goal" onClose={onClose} className="max-w-lg">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Pick an EX trial to track, or create a custom goal.
          </p>

          {loadingCatalog ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-4">
              {groupedCatalog.map(({ expansion, entries }) => (
                <div key={expansion}>
                  <div className="text-xs text-text-tertiary uppercase tracking-wider font-medium mb-1.5 sticky top-0 bg-surface-base py-1">
                    {expansion}
                  </div>
                  <div className="space-y-1">
                    {entries.map((entry) => (
                      /* design-system-ignore: Catalog item requires specific clickable card styling */
                      <button
                        key={entry.trialId}
                        type="button"
                        disabled={saving}
                        onClick={() => handleCatalogSelect(entry)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border-default bg-surface-elevated hover:border-accent/40 hover:bg-accent/5 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-text-primary truncate">{entry.mountName}</div>
                          <div className="text-xs text-text-tertiary truncate">{entry.dutyName}</div>
                        </div>
                        <Badge variant="default" size="sm">
                          {entry.totemTarget} totems
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="text-sm text-status-error bg-status-error/10 rounded px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex justify-between items-center pt-2 border-t border-border-default">
            <Button variant="ghost" size="sm" onClick={() => setMode('custom')}>
              Custom Goal Instead
            </Button>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </Modal>
    );
  }

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
          {showCatalog && !isEditing && (
            <Button variant="ghost" size="sm" onClick={() => setMode('catalog')} className="mr-auto">
              Pick from Catalog
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !title.trim()}>
            {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Goal'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
