/* eslint-disable design-system/no-raw-button */
import { useState } from 'react';
import { Check, ExternalLink, Info, Plus, Star, Trash2, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../primitives/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { useBisTargetStore } from '../../stores/bisTargetStore';
import { getJobDisplayName } from '../../gamedata/jobs';
import type { BisTargetSet, BisTargetSource, BisTargetPurpose } from '../../types';

interface BiSTargetPanelProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  playerId: string;
  job: string;
  canEdit: boolean;
}

const SOURCE_OPTIONS: { value: BisTargetSource; label: string }[] = [
  { value: 'manual', label: 'Manual (configured by hand)' },
  { value: 'etro', label: 'Etro.gg link' },
  { value: 'xivgear', label: 'xivgear.app link' },
  { value: 'ariyala', label: 'Ariyala link' },
  { value: 'external', label: 'Other external URL' },
];

const PURPOSE_OPTIONS: { value: BisTargetPurpose; label: string }[] = [
  { value: 'savage', label: 'Savage prog/clear' },
  { value: 'ultimate', label: 'Ultimate prog/clear' },
  { value: 'prog', label: 'General prog' },
  { value: 'farm', label: 'Farm set' },
  { value: 'speed', label: 'Speed kill / parse' },
  { value: 'comfort', label: 'Comfort / casual' },
  { value: 'custom', label: 'Custom' },
];

const PURPOSE_LABELS: Record<BisTargetPurpose, string> = {
  savage: 'Savage', ultimate: 'Ultimate', prog: 'Prog',
  farm: 'Farm', speed: 'Speed', comfort: 'Comfort', custom: 'Custom',
};

interface EditFormState {
  name: string;
  source: BisTargetSource;
  purpose: BisTargetPurpose;
  externalUrl: string;
  patch: string;
  tier: string;
  targetItemLevel: string;
}

const EMPTY_FORM: EditFormState = {
  name: '', source: 'manual', purpose: 'savage',
  externalUrl: '', patch: '', tier: '', targetItemLevel: '',
};

function formFromTarget(t: BisTargetSet): EditFormState {
  return {
    name: t.name,
    source: t.source,
    purpose: t.purpose,
    externalUrl: t.externalUrl ?? '',
    patch: t.patch ?? '',
    tier: t.tier ?? '',
    targetItemLevel: t.targetItemLevel != null ? String(t.targetItemLevel) : '',
  };
}

function validateForm(form: EditFormState): string | null {
  if (!form.name.trim()) return 'Name is required.';
  const urlNeeded = form.source !== 'manual';
  if (urlNeeded && form.externalUrl.trim()) {
    try { new URL(form.externalUrl.trim()); } catch { return 'External URL is not valid.'; }
  }
  if (form.targetItemLevel && !/^\d+$/.test(form.targetItemLevel.trim())) {
    return 'Target item level must be a whole number.';
  }
  return null;
}

export function BiSTargetPanel({ isOpen, onClose, groupId, playerId, job, canEdit }: BiSTargetPanelProps) {
  const { getTargets, getActive, addTarget, updateTarget, removeTarget, setActive } = useBisTargetStore();
  const targets = getTargets(groupId, playerId, job);
  const active = getActive(groupId, playerId, job);

  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<EditFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setEditingId('new');
  };

  const openEdit = (t: BisTargetSet) => {
    setForm(formFromTarget(t));
    setFormError(null);
    setEditingId(t.id);
    setConfirmDeleteId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormError(null);
  };

  const handleSave = () => {
    const err = validateForm(form);
    if (err) { setFormError(err); return; }

    const fields = {
      name: form.name.trim(),
      source: form.source,
      purpose: form.purpose,
      externalUrl: form.externalUrl.trim() || undefined,
      patch: form.patch.trim() || undefined,
      tier: form.tier.trim() || undefined,
      targetItemLevel: form.targetItemLevel.trim() ? parseInt(form.targetItemLevel.trim(), 10) : undefined,
    };

    if (editingId === 'new') {
      addTarget(groupId, playerId, job, fields);
    } else if (editingId) {
      updateTarget(groupId, playerId, job, editingId, fields);
    }
    setEditingId(null);
    setFormError(null);
  };

  const handleDelete = (id: string) => {
    removeTarget(groupId, playerId, job, id);
    if (editingId === id) setEditingId(null);
    setConfirmDeleteId(null);
  };

  const patchForm = (patch: Partial<EditFormState>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`BiS Targets — ${getJobDisplayName(job)}`}
      size="lg"
    >
      <div className="space-y-4">
        {/* Local-only disclosure — V1 is browser-local, backend sync planned */}
        <div className="flex items-start gap-2 rounded-lg bg-surface-elevated border border-border-default px-3 py-2.5 text-xs text-text-muted">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            Target sets are saved locally in this browser only. They are not visible to teammates or synced across devices.
            Backend sync is planned for a future update.
          </span>
        </div>

        {targets.length === 0 && editingId !== 'new' && (
          <div className="rounded-lg border border-border-default bg-surface-elevated px-4 py-6 text-center">
            <p className="text-sm text-text-secondary">
              No BiS target sets yet.
              {canEdit && ' Add one to track what gear you\'re aiming for.'}
            </p>
          </div>
        )}

        {/* Target list */}
        {targets.map((t) => (
          <div key={t.id}>
            {editingId === t.id ? (
              <TargetForm
                form={form}
                error={formError}
                onChange={patchForm}
                onSave={handleSave}
                onCancel={cancelEdit}
              />
            ) : (
              <div
                className={`rounded-lg border p-3 flex items-start gap-3 ${
                  t.isActive
                    ? 'border-accent/40 bg-accent/5'
                    : 'border-border-default bg-surface-raised'
                }`}
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-text-primary">{t.name}</span>
                    {t.isActive && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-accent bg-accent/10 rounded px-1.5 py-0.5 uppercase tracking-wide">
                        <Star className="w-2.5 h-2.5" /> Active
                      </span>
                    )}
                    <span className="text-xs text-text-muted">{PURPOSE_LABELS[t.purpose]}</span>
                    {t.targetItemLevel && (
                      <span className="text-xs font-medium text-text-secondary">iLv {t.targetItemLevel}</span>
                    )}
                    {t.patch && (
                      <span className="text-xs text-text-muted">Patch {t.patch}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-text-muted capitalize">{t.source.replace(/_/g, ' ')}</span>
                    {t.externalUrl && (
                      <a
                        href={t.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3" />
                        View set
                      </a>
                    )}
                  </div>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!t.isActive && (
                      <button
                        type="button"
                        className="p-1.5 rounded text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
                        title="Set as active"
                        onClick={() => setActive(groupId, playerId, job, t.id)}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors text-xs font-medium"
                      onClick={() => openEdit(t)}
                    >
                      Edit
                    </button>
                    {confirmDeleteId === t.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="p-1.5 rounded text-status-error hover:bg-status-error/10 transition-colors"
                          title="Confirm delete"
                          onClick={() => handleDelete(t.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          className="p-1.5 rounded text-text-muted hover:bg-surface-elevated transition-colors"
                          title="Cancel"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="p-1.5 rounded text-text-muted hover:text-status-error hover:bg-status-error/10 transition-colors"
                        title="Delete"
                        onClick={() => setConfirmDeleteId(t.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* New target form */}
        {editingId === 'new' && (
          <TargetForm
            form={form}
            error={formError}
            onChange={patchForm}
            onSave={handleSave}
            onCancel={cancelEdit}
          />
        )}

        {canEdit && editingId === null && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={openNew}
          >
            Add Target Set
          </Button>
        )}

        {/* Summary footer */}
        {targets.length > 0 && (
          <div className="text-xs text-text-muted pt-1 border-t border-border-subtle">
            {targets.length} target set{targets.length !== 1 ? 's' : ''}
            {active ? ` · Active: ${active.name}` : ''}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}

interface TargetFormProps {
  form: EditFormState;
  error: string | null;
  onChange: (patch: Partial<EditFormState>) => void;
  onSave: () => void;
  onCancel: () => void;
}

function TargetForm({ form, error, onChange, onSave, onCancel }: TargetFormProps) {
  const showUrlField = form.source !== 'manual';

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4 space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-1">
          {/* design-system-ignore: no Label primitive in design system */}<label className="text-xs font-medium text-text-secondary">Name</label>
          <Input
            value={form.name}
            onChange={(v) => onChange({ name: v })}
            placeholder="e.g. Savage week-1 BiS"
          />
        </div>

        <div className="space-y-1">
          {/* design-system-ignore: no Label primitive in design system */}<label className="text-xs font-medium text-text-secondary">Source</label>
          <Select
            value={form.source}
            onChange={(v) => onChange({ source: v as BisTargetSource })}
            options={SOURCE_OPTIONS}
          />
        </div>

        <div className="space-y-1">
          {/* design-system-ignore: no Label primitive in design system */}<label className="text-xs font-medium text-text-secondary">Purpose</label>
          <Select
            value={form.purpose}
            onChange={(v) => onChange({ purpose: v as BisTargetPurpose })}
            options={PURPOSE_OPTIONS}
          />
        </div>

        {showUrlField && (
          <div className="sm:col-span-2 space-y-1">
            {/* design-system-ignore: no Label primitive in design system */}<label className="text-xs font-medium text-text-secondary">External URL</label>
            <Input
              value={form.externalUrl}
              onChange={(v) => onChange({ externalUrl: v })}
              placeholder="https://etro.gg/gearset/..."
              helperText="Saved as a reference link only — the gear set is not imported."
            />
          </div>
        )}

        <div className="space-y-1">
          {/* design-system-ignore: no Label primitive in design system */}<label className="text-xs font-medium text-text-secondary">Patch</label>
          <Input
            value={form.patch}
            onChange={(v) => onChange({ patch: v })}
            placeholder="e.g. 7.2"
          />
        </div>

        <div className="space-y-1">
          {/* design-system-ignore: no Label primitive in design system */}<label className="text-xs font-medium text-text-secondary">Target iLv</label>
          <Input
            value={form.targetItemLevel}
            onChange={(v) => onChange({ targetItemLevel: v })}
            placeholder="e.g. 730"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-status-error">{error}</p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="button" size="sm" onClick={onSave}>Save</Button>
      </div>
    </div>
  );
}
