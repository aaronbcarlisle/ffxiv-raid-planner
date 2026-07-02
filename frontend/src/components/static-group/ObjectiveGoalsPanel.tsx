/**
 * ObjectiveGoalsPanel — static-group raid/progression objective management.
 *
 * Owners and leads can add, edit, and delete objective goals.
 * Members see the list read-only.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Target, Trash2, Check } from 'lucide-react';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { IconButton } from '../primitives/IconButton';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { TextArea } from '../ui/TextArea';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Spinner } from '../ui/Spinner';
import { useModal } from '../../hooks/useModal';
import { useObjectiveGoalStore } from '../../stores/objectiveGoalStore';
import { toast } from '../../stores/toastStore';
import { EmptyState } from '../ui/EmptyState';

// ---- Option lists ----

function getCategoryOptions(t: (key: string) => string) {
  return [
    { value: 'ultimate_clear', label: t('objectiveCategory.ultimate_clear') },
    { value: 'ultimate_farm', label: t('objectiveCategory.ultimate_farm') },
    { value: 'savage_bis', label: t('objectiveCategory.savage_bis') },
    { value: 'savage_mount', label: t('objectiveCategory.savage_mount') },
    { value: 'savage_achievement', label: t('objectiveCategory.savage_achievement') },
    { value: 'savage_alt_jobs', label: t('objectiveCategory.savage_alt_jobs') },
    { value: 'criterion_title', label: t('objectiveCategory.criterion_title') },
    { value: 'gil_farm', label: t('objectiveCategory.gil_farm') },
    { value: 'loot_farm', label: t('objectiveCategory.loot_farm') },
    { value: 'custom', label: t('objectiveCategory.custom') },
  ];
}

function getPriorityOptions(t: (key: string) => string) {
  return [
    { value: 'required', label: t('objectivePriority.required') },
    { value: 'preferred', label: t('objectivePriority.preferred') },
    { value: 'optional', label: t('objectivePriority.optional') },
    { value: 'not_doing', label: t('objectivePriority.not_doing') },
  ];
}

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
  categoryOptions: Array<{ value: string; label: string }>;
  priorityOptions: Array<{ value: string; label: string }>;
  onSave: (data: ObjectiveFormState) => Promise<void>;
  onCancel: () => void;
}

function ObjectiveForm({
  initial = EMPTY_FORM,
  categoryOptions,
  priorityOptions,
  onSave,
  onCancel,
}: ObjectiveFormProps) {
  const { t } = useTranslation();
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
          <Label size="sm">{t('goalsPage.category')}</Label>
          <Select
            value={form.category}
            onChange={(v) => setForm((f) => ({ ...f, category: v }))}
            options={categoryOptions}
          />
        </div>
        <div>
          <Label size="sm">{t('goalsPage.priority')}</Label>
          <Select
            value={form.priority}
            onChange={(v) => setForm((f) => ({ ...f, priority: v }))}
            options={priorityOptions}
          />
        </div>
      </div>
      <div>
        <Label size="sm">{t('goalsPage.title')}</Label>
        <Input
          value={form.title}
          onChange={(v) => setForm((f) => ({ ...f, title: v }))}
          placeholder={t('goalsPage.titlePlaceholder')}
          maxLength={200}
        />
      </div>
      <div>
        <Label size="sm">{t('goalsPage.descriptionOptional')}</Label>
        <TextArea
          value={form.description}
          onChange={(v) => setForm((f) => ({ ...f, description: v }))}
          placeholder={t('goalsPage.descriptionPlaceholder')}
          maxLength={2000}
          rows={2}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !form.title.trim()}
          leftIcon={saving ? undefined : <Check className="w-3.5 h-3.5" />}
        >
          {saving ? t('common.saving') : t('common.save')}
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
  const { t } = useTranslation();
  const { objectives, loading, objectivesError, fetchObjectives, createObjective, updateObjective, deleteObjective } =
    useObjectiveGoalStore();
  const categoryOptions = useMemo(() => getCategoryOptions(t), [t]);
  const priorityOptions = useMemo(() => getPriorityOptions(t), [t]);
  const categoryLabels = useMemo<Record<string, string>>(
    () => Object.fromEntries(categoryOptions.map((option) => [option.value, option.label])),
    [categoryOptions],
  );
  const priorityLabels = useMemo<Record<string, string>>(
    () => Object.fromEntries(priorityOptions.map((option) => [option.value, option.label])),
    [priorityOptions],
  );

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
      toast.success(t('goalsPage.objectiveAdded'));
      setShowAddForm(false);
    } catch {
      toast.error(t('goalsPage.objectiveAddFailed'));
    }
  };

  const handleUpdate = async (id: string, data: ObjectiveFormState) => {
    try {
      await updateObjective(groupId, id, {
        title: data.title,
        description: data.description || undefined,
        priority: data.priority,
      });
      toast.success(t('goalsPage.objectiveUpdated'));
      setEditingId(null);
    } catch {
      toast.error(t('goalsPage.objectiveUpdateFailed'));
    }
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteId) return;
    try {
      await deleteObjective(groupId, pendingDeleteId);
      toast.success(t('goalsPage.objectiveRemoved'));
    } catch {
      toast.error(t('goalsPage.objectiveRemoveFailed'));
    } finally {
      setPendingDeleteId(null);
      deleteModal.close();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{t('goalsPage.staticObjectivesTitle')}</h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            {t('goalsPage.staticObjectivesDesc')}
          </p>
        </div>
        {canManage && !showAddForm && (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setShowAddForm(true)}
          >
            {t('goalsPage.addStaticGoal')}
          </Button>
        )}
      </div>

      {showAddForm && canManage && (
        <ObjectiveForm
          categoryOptions={categoryOptions}
          priorityOptions={priorityOptions}
          onSave={handleCreate}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {loading && objectives.length === 0 && (
        <div className="flex justify-center py-6"><Spinner /></div>
      )}

      {objectivesError && (
        <div className="flex items-center justify-between text-sm text-status-error bg-status-error/10 rounded px-3 py-2">
          <span>{t('goalsPage.loadFailed')}</span>
          {/* design-system-ignore: inline retry link */}
          <button
            type="button"
            className="text-xs underline ml-2 flex-shrink-0"
            onClick={() => fetchObjectives(groupId)}
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      {!loading && objectives.length === 0 && !showAddForm && (
        <EmptyState
          icon={<Target size={24} />}
          heading={t('goalsPage.noObjectives')}
          description={
            canManage
              ? t('goalsPage.noObjectivesManageDesc')
              : t('goalsPage.noObjectivesMemberDesc')
          }
          action={canManage ? { label: t('goalsPage.addStaticGoal'), onClick: () => setShowAddForm(true) } : undefined}
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
                categoryOptions={categoryOptions}
                priorityOptions={priorityOptions}
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
                    {categoryLabels[obj.category] ?? obj.category}
                  </Badge>
                  <Badge variant={PRIORITY_VARIANTS[obj.priority] ?? 'default'} size="sm">
                    {priorityLabels[obj.priority] ?? obj.priority.replace('_', ' ')}
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
                    aria-label={t('goalsPage.editObjective')}
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingId(obj.id)}
                  />
                  <IconButton
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                    aria-label={t('goalsPage.deleteObjective')}
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
          title={t('goalsPage.removeObjectiveTitle')}
          message={t('goalsPage.removeObjectiveMessage')}
          confirmLabel={t('goalsPage.removeObjectiveConfirm')}
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
