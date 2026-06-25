/**
 * ObjectiveGoalsPanel — static-group raid/progression objective management.
 *
 * Owners and leads can add, edit, and delete objective goals.
 * Members see the list read-only.
 */

import { useEffect, useState } from 'react';
import { Pencil, Plus, Target, Trash2, Check } from 'lucide-react';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { IconButton } from '../primitives/IconButton';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { TextArea } from '../ui/TextArea';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Spinner } from '../ui/Spinner';
import { useModal } from '../../hooks/useModal';
import { useObjectiveGoalStore } from '../../stores/objectiveGoalStore';
import { toast } from '../../stores/toastStore';
import { EmptyState } from '../ui/EmptyState';

// ---- Option lists ----

const CATEGORY_OPTIONS = [
  { value: 'ultimate_clear',    label: 'Ultimate — Clear' },
  { value: 'ultimate_farm',     label: 'Ultimate — Farm' },
  { value: 'savage_bis',        label: 'Savage — BiS' },
  { value: 'savage_mount',      label: 'Savage — Mount' },
  { value: 'savage_achievement',label: 'Savage — Achievement' },
  { value: 'savage_alt_jobs',   label: 'Savage — Alt Jobs' },
  { value: 'criterion_title',   label: 'Criterion — Title' },
  { value: 'gil_farm',          label: 'Gil Farm' },
  { value: 'loot_farm',         label: 'Loot Farm' },
  { value: 'custom',            label: 'Custom' },
];

const PRIORITY_OPTIONS = [
  { value: 'required',   label: 'Required' },
  { value: 'preferred',  label: 'Preferred' },
  { value: 'optional',   label: 'Optional' },
  { value: 'not_doing',  label: 'Not Doing' },
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((o) => [o.value, o.label])
);

const PRIORITY_VARIANTS: Record<string, 'error' | 'info' | 'default'> = {
  required:  'error',
  preferred: 'info',
  optional:  'default',
  not_doing: 'default',
};

// ---- Inline form ----

interface ObjectiveFormState {
  category: string;
  title: string;
  description: string;
  priority: string;
}

const EMPTY_FORM: ObjectiveFormState = {
  category: 'savage_bis',
  title: '',
  description: '',
  priority: 'required',
};

interface ObjectiveFormProps {
  initial?: ObjectiveFormState;
  onSave: (data: ObjectiveFormState) => Promise<void>;
  onCancel: () => void;
}

function ObjectiveForm({ initial = EMPTY_FORM, onSave, onCancel }: ObjectiveFormProps) {
  const [form, setForm] = useState<ObjectiveFormState>(initial);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await onSave({ ...form, title: form.title.trim(), description: form.description.trim() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 bg-surface-elevated rounded-lg border border-border-default p-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1"> {/* design-system-ignore */}
            Category
          </label>
          <Select
            value={form.category}
            onChange={(v) => setForm((f) => ({ ...f, category: v }))}
            options={CATEGORY_OPTIONS}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1"> {/* design-system-ignore */}
            Priority
          </label>
          <Select
            value={form.priority}
            onChange={(v) => setForm((f) => ({ ...f, priority: v }))}
            options={PRIORITY_OPTIONS}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1"> {/* design-system-ignore */}
          Title
        </label>
        <Input
          value={form.title}
          onChange={(v) => setForm((f) => ({ ...f, title: v }))}
          placeholder="e.g., Clear The Futures Rewritten (Ultimate)"
          maxLength={200}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1"> {/* design-system-ignore */}
          Description (optional)
        </label>
        <TextArea
          value={form.description}
          onChange={(v) => setForm((f) => ({ ...f, description: v }))}
          placeholder="Additional context for this objective"
          maxLength={2000}
          rows={2}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !form.title.trim()}
          leftIcon={saving ? undefined : <Check className="w-3.5 h-3.5" />}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

// ---- Main panel ----

interface ObjectiveGoalsPanelProps {
  groupId: string;
  canManage: boolean;
}

export function ObjectiveGoalsPanel({ groupId, canManage }: ObjectiveGoalsPanelProps) {
  const { objectives, loading, objectivesError, fetchObjectives, createObjective, updateObjective, deleteObjective } =
    useObjectiveGoalStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const deleteModal = useModal();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchObjectives(groupId);
  }, [groupId, fetchObjectives]);

  const handleCreate = async (data: ObjectiveFormState) => {
    try {
      await createObjective(groupId, {
        category: data.category,
        title: data.title,
        description: data.description || undefined,
        priority: data.priority,
      });
      toast.success('Objective added');
      setShowAddForm(false);
    } catch {
      toast.error('Failed to add objective');
    }
  };

  const handleUpdate = async (id: string, data: ObjectiveFormState) => {
    try {
      await updateObjective(groupId, id, {
        title: data.title,
        description: data.description || undefined,
        priority: data.priority,
      });
      toast.success('Objective updated');
      setEditingId(null);
    } catch {
      toast.error('Failed to update objective');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteId) return;
    try {
      await deleteObjective(groupId, pendingDeleteId);
      toast.success('Objective removed');
    } catch {
      toast.error('Failed to remove objective');
    } finally {
      setPendingDeleteId(null);
      deleteModal.close();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Static Objectives</h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            Official static goals are used for matching, discovery, applications, and roster alignment.
          </p>
        </div>
        {canManage && !showAddForm && (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setShowAddForm(true)}
          >
            Add Static Goal
          </Button>
        )}
      </div>

      {showAddForm && canManage && (
        <ObjectiveForm
          onSave={handleCreate}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {loading && objectives.length === 0 && (
        <div className="flex justify-center py-6"><Spinner /></div>
      )}

      {objectivesError && (
        <div className="flex items-center justify-between text-sm text-status-error bg-status-error/10 rounded px-3 py-2">
          <span>Couldn&apos;t load objectives.</span>
          {/* design-system-ignore: inline retry link */}
          <button
            type="button"
            className="text-xs underline ml-2 flex-shrink-0"
            onClick={() => fetchObjectives(groupId)}
          >
            Retry
          </button>
        </div>
      )}

      {!loading && objectives.length === 0 && !showAddForm && (
        <EmptyState
          icon={<Target size={24} />}
          heading="No objectives set"
          description={
            canManage
              ? 'Add a static goal to enable matching for applicants and discovery.'
              : 'No official goals have been set for this static yet.'
          }
          action={canManage ? { label: 'Add static goal', onClick: () => setShowAddForm(true) } : undefined}
        />
      )}

      <div className="space-y-2">
        {objectives.map((obj) => {
          const isEditing = editingId === obj.id;

          if (isEditing && canManage) {
            return (
              <ObjectiveForm
                key={obj.id}
                initial={{
                  category: obj.category,
                  title: obj.title,
                  description: obj.description ?? '',
                  priority: obj.priority,
                }}
                onSave={(data) => handleUpdate(obj.id, data)}
                onCancel={() => setEditingId(null)}
              />
            );
          }

          return (
            <div
              key={obj.id}
              className="flex items-start gap-3 bg-surface-raised rounded-lg border border-border-default px-3 py-2.5"
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="default" size="sm">
                    {CATEGORY_LABELS[obj.category] ?? obj.category}
                  </Badge>
                  <Badge variant={PRIORITY_VARIANTS[obj.priority] ?? 'default'} size="sm">
                    {obj.priority.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="text-sm font-medium text-text-primary">{obj.title}</div>
                {obj.description && (
                  <div className="text-xs text-text-secondary">{obj.description}</div>
                )}
              </div>
              {canManage && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <IconButton
                    icon={<Pencil className="w-3.5 h-3.5" />}
                    aria-label="Edit objective"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingId(obj.id)}
                  />
                  <IconButton
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                    aria-label="Delete objective"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPendingDeleteId(obj.id);
                      deleteModal.open();
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {deleteModal.isOpen && (
        <ConfirmModal
          isOpen={deleteModal.isOpen}
          title="Remove Objective"
          message="Remove this objective? This cannot be undone."
          confirmLabel="Remove"
          variant="danger"
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            setPendingDeleteId(null);
            deleteModal.close();
          }}
        />
      )}
    </div>
  );
}
