import { useEffect, useState } from 'react';
import { Check, ExternalLink, Plus, Trash2, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../primitives/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../primitives/Badge';
import { usePlayerProfileStore } from '../../stores/playerProfileStore';
import type { PlayerBisTargetSet } from '../../stores/playerProfileStore';
import { getJobDisplayName } from '../../gamedata/jobs';
import { toast } from '../../stores/toastStore';

interface ManageBiSModalProps {
  jobProfileId: string;
  job: string;
  onClose: () => void;
}

const PURPOSE_OPTIONS = [
  { value: 'savage', label: 'Savage prog/clear' },
  { value: 'ultimate', label: 'Ultimate prog/clear' },
  { value: 'prog', label: 'General prog' },
  { value: 'farm', label: 'Farm set' },
  { value: 'speed', label: 'Speed kill / parse' },
  { value: 'comfort', label: 'Comfort / casual' },
  { value: 'custom', label: 'Custom' },
];

const PURPOSE_LABELS: Record<string, string> = {
  savage: 'Savage', ultimate: 'Ultimate', prog: 'Prog',
  farm: 'Farm', speed: 'Speed', comfort: 'Comfort', custom: 'Custom',
};

const SOURCE_OPTIONS = [
  { value: 'manual', label: 'Manual (by hand)' },
  { value: 'xivgear', label: 'xivgear.app' },
  { value: 'etro', label: 'etro.gg' },
  { value: 'ariyala', label: 'Ariyala' },
  { value: 'custom_link', label: 'Other URL' },
];

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual', xivgear: 'XIVGear', etro: 'Etro',
  ariyala: 'Ariyala', custom_link: 'Link',
};

interface AddForm {
  name: string;
  purpose: string;
  sourceType: string;
  externalUrl: string;
  notes: string;
}

const EMPTY_FORM: AddForm = {
  name: '',
  purpose: 'savage',
  sourceType: 'manual',
  externalUrl: '',
  notes: '',
};

export function ManageBiSModal({ jobProfileId, job, onClose }: ManageBiSModalProps) {
  const { bisTargets, fetchBisTargets, createBisTarget, updateBisTarget, deleteBisTarget, setBisTargetActive } =
    usePlayerProfileStore();

  const targets = bisTargets[jobProfileId] ?? [];
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<AddForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AddForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchBisTargets(jobProfileId);
  }, [jobProfileId, fetchBisTargets]);

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await createBisTarget(jobProfileId, {
        name: form.name.trim(),
        purpose: form.purpose,
        sourceType: form.sourceType,
        externalUrl: form.externalUrl.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      setForm(EMPTY_FORM);
      setShowAddForm(false);
      toast.success('BiS target added');
    } catch {
      toast.error('Failed to add BiS target');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (targetId: string) => {
    if (!editForm.name.trim()) return;
    setSaving(true);
    try {
      await updateBisTarget(jobProfileId, targetId, {
        name: editForm.name.trim(),
        purpose: editForm.purpose,
        sourceType: editForm.sourceType,
        externalUrl: editForm.externalUrl.trim() || undefined,
        notes: editForm.notes.trim() || undefined,
      });
      setEditingId(null);
      toast.success('BiS target updated');
    } catch {
      toast.error('Failed to update BiS target');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (targetId: string) => {
    setDeletingId(targetId);
    try {
      await deleteBisTarget(jobProfileId, targetId);
      toast.success('BiS target removed');
    } catch {
      toast.error('Failed to remove BiS target');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetActive = async (target: PlayerBisTargetSet) => {
    try {
      await setBisTargetActive(jobProfileId, target.id);
      toast.success(`"${target.name}" set as active`);
    } catch {
      toast.error('Failed to set active BiS target');
    }
  };

  const startEdit = (target: PlayerBisTargetSet) => {
    setEditingId(target.id);
    setEditForm({
      name: target.name,
      purpose: target.purpose,
      sourceType: target.sourceType,
      externalUrl: target.externalUrl ?? '',
      notes: target.notes ?? '',
    });
  };

  return (
    <Modal isOpen onClose={onClose} title={`BiS Targets — ${getJobDisplayName(job)}`} size="lg">
      <div className="space-y-4">
        {targets.length === 0 && !showAddForm && (
          <p className="text-sm text-text-secondary">
            No BiS targets configured for this job yet. Add one to track your gear goals.
          </p>
        )}

        {targets.map((target) => (
          <div
            key={target.id}
            className={`rounded-lg border p-3 transition-colors ${
              target.isActive
                ? 'border-accent/40 bg-accent/5'
                : 'border-border-default bg-surface-elevated/50'
            }`}
            data-testid={`bis-target-row-${target.id}`}
          >
            {editingId === target.id ? (
              <BiSForm
                form={editForm}
                onChange={setEditForm}
                onSubmit={() => handleUpdate(target.id)}
                onCancel={() => setEditingId(null)}
                saving={saving}
                submitLabel="Save"
              />
            ) : (
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {target.isActive && (
                      <Check className="h-3.5 w-3.5 flex-shrink-0 text-accent" aria-label="Active" />
                    )}
                    <span className="min-w-0 truncate font-medium text-text-primary">{target.name}</span>
                    <Badge variant="default" size="sm">
                      {PURPOSE_LABELS[target.purpose] ?? target.purpose}
                    </Badge>
                    <span className="text-xs text-text-tertiary">
                      {SOURCE_LABELS[target.sourceType] ?? target.sourceType}
                    </span>
                  </div>
                  {target.externalUrl && (
                    <a
                      href={target.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 flex items-center gap-1 text-xs text-accent hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span className="truncate">{target.externalUrl}</span>
                    </a>
                  )}
                  {target.notes && (
                    <p className="mt-1 text-xs text-text-secondary italic">{target.notes}</p>
                  )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  {!target.isActive && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSetActive(target)}
                      title="Set as active"
                    >
                      Set active
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => startEdit(target)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(target.id)}
                    disabled={deletingId === target.id}
                    aria-label="Remove BiS target"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-status-error" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}

        {showAddForm ? (
          <div className="rounded-lg border border-border-default bg-surface-elevated/50 p-3">
            <p className="mb-3 text-sm font-medium text-text-primary">New BiS target</p>
            <BiSForm
              form={form}
              onChange={setForm}
              onSubmit={handleAdd}
              onCancel={() => { setShowAddForm(false); setForm(EMPTY_FORM); }}
              saving={saving}
              submitLabel="Add"
            />
          </div>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setShowAddForm(true)}
            data-testid="add-bis-target-btn"
          >
            Add target
          </Button>
        )}
      </div>
    </Modal>
  );
}

function BiSForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  saving,
  submitLabel,
}: {
  form: AddForm;
  onChange: (form: AddForm) => void;
  onSubmit: () => void;
  onCancel: () => void;
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <div className="space-y-3">
      <div>
        {/* design-system-ignore: no Label primitive in design system */}<label className="mb-1 block text-xs text-text-secondary">Name</label>
        <Input
          value={form.name}
          onChange={(val) => onChange({ ...form, name: val })}
          placeholder="e.g. Prog Set, Farm Set"
          data-testid="bis-name-input"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          {/* design-system-ignore: no Label primitive in design system */}<label className="mb-1 block text-xs text-text-secondary">Purpose</label>
          <Select
            value={form.purpose}
            onChange={(val) => onChange({ ...form, purpose: val })}
            options={PURPOSE_OPTIONS}
            data-testid="bis-purpose-select"
          />
        </div>
        <div>
          {/* design-system-ignore: no Label primitive in design system */}<label className="mb-1 block text-xs text-text-secondary">Source</label>
          <Select
            value={form.sourceType}
            onChange={(val) => onChange({ ...form, sourceType: val })}
            options={SOURCE_OPTIONS}
            data-testid="bis-source-select"
          />
        </div>
      </div>
      {form.sourceType !== 'manual' && (
        <div>
          {/* design-system-ignore: no Label primitive in design system */}<label className="mb-1 block text-xs text-text-secondary">URL (optional)</label>
          <Input
            value={form.externalUrl}
            onChange={(val) => onChange({ ...form, externalUrl: val })}
            placeholder="https://..."
            data-testid="bis-url-input"
          />
        </div>
      )}
      <div>
        {/* design-system-ignore: no Label primitive in design system */}<label className="mb-1 block text-xs text-text-secondary">Notes (optional)</label>
        <Input
          value={form.notes}
          onChange={(val) => onChange({ ...form, notes: val })}
          placeholder="e.g. missing ring 2"
          data-testid="bis-notes-input"
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onSubmit} disabled={!form.name.trim() || saving}>
          {submitLabel}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
