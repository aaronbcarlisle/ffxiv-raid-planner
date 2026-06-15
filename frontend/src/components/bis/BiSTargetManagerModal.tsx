import { useEffect, useState, useCallback } from 'react';
import { Check, ExternalLink, Link2, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../primitives/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Label } from '../ui/Label';
import { Badge } from '../primitives/Badge';
import { Checkbox } from '../ui/Checkbox';
import { toast } from '../../stores/toastStore';
import {
  useSharedBisStore,
  PURPOSE_OPTIONS,
  PURPOSE_LABELS,
  SOURCE_LABELS,
} from '../../stores/sharedBisStore';
import { fetchBiSPresets } from '../../services/api';
import { getJobDisplayName } from '../../gamedata/jobs';
import type {
  SharedBiSTargetSet,
  SharedBiSTargetCreate,
  BiSOwnerType,
  BisTargetPurpose,
  BiSSourceType,
  BiSImportStatus,
  BiSPreset,
} from '../../types';

interface BiSTargetManagerModalProps {
  ownerType: BiSOwnerType;
  ownerId: string;
  /** Required when ownerType = 'roster_member_job' to authorize writes. */
  groupId?: string | null;
  job: string;
  canEdit?: boolean;
  onClose: () => void;
}

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'manual', label: 'Manual (by hand)' },
  { value: 'xivgear', label: 'xivgear.app' },
  { value: 'etro', label: 'etro.gg' },
  { value: 'ariyala', label: 'Ariyala' },
  { value: 'custom_link', label: 'Other URL' },
];

interface AddForm {
  name: string;
  purpose: BisTargetPurpose;
  sourceType: BiSSourceType;
  externalUrl: string;
  patch: string;
  notes: string;
}

const EMPTY_FORM: AddForm = {
  name: '', purpose: 'savage', sourceType: 'manual', externalUrl: '', patch: '', notes: '',
};

type TabId = 'targets' | 'presets' | 'link' | 'manual';

export function BiSTargetManagerModal({
  ownerType, ownerId, groupId, job, canEdit = true, onClose,
}: BiSTargetManagerModalProps) {
  const store = useSharedBisStore();
  const targets = store.getTargets(ownerType, ownerId);
  const isLoading = store.isLoading(ownerType, ownerId);

  const [activeTab, setActiveTab] = useState<TabId>('targets');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AddForm>(EMPTY_FORM);
  const [manualForm, setManualForm] = useState<AddForm>(EMPTY_FORM);

  // Preset picker state
  const [presets, setPresets] = useState<BiSPreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [presetsError, setPresetsError] = useState<string | null>(null);
  const [selectedPresetIds, setSelectedPresetIds] = useState<Set<string>>(new Set());

  // Link tab state
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');
  const [linkPurpose, setLinkPurpose] = useState<BisTargetPurpose>('savage');

  // Fetch targets on mount and whenever ownerId changes
  useEffect(() => {
    store.fetchTargets(ownerType, ownerId);
  }, [ownerType, ownerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch presets when job or ownerId changes — fixes stale-preset bug
  const loadPresets = useCallback(async () => {
    if (!job) return;
    setPresetsLoading(true);
    setPresetsError(null);
    setSelectedPresetIds(new Set()); // clear stale selections when job changes
    try {
      const resp = await fetchBiSPresets(job);
      setPresets(resp.presets ?? []);
    } catch {
      setPresetsError('Failed to load presets. Try again.');
      setPresets([]);
    } finally {
      setPresetsLoading(false);
    }
  }, [job]);

  useEffect(() => {
    if (activeTab === 'presets') loadPresets();
  }, [activeTab, loadPresets]);

  useEffect(() => {
    if (activeTab !== 'presets') setSelectedPresetIds(new Set());
  }, [activeTab]);

  const togglePreset = (preset: BiSPreset) => {
    const id = preset.uuid ?? preset.name;
    setSelectedPresetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddPresets = async () => {
    if (selectedPresetIds.size === 0) return;
    const selected = presets.filter((p) => selectedPresetIds.has(p.uuid ?? p.name));
    if (selected.length === 0) return;

    setSaving(true);
    try {
      const dataList: SharedBiSTargetCreate[] = selected.map((p) => ({
        ownerType,
        ownerId,
        groupId: groupId ?? undefined,
        name: p.name,
        purpose: (p.category as BisTargetPurpose) ?? 'savage',
        sourceType: 'preset' as BiSSourceType,
        externalUrl: p.uuid ? `https://xivgear.app/?page=sl%7C${p.uuid}` : undefined,
        importStatus: 'linked_only' as BiSImportStatus,
      }));

      const created = await store.createMultipleTargets(dataList);
      setSelectedPresetIds(new Set());
      setActiveTab('targets');

      const importable = created.filter((t) => t.externalUrl);
      if (importable.length > 0) {
        toast.success(
          selected.length === 1
            ? `"${selected[0].name}" added — importing gear data…`
            : `${selected.length} BiS targets added — importing gear data…`,
        );
        await Promise.allSettled(
          importable.map((t) => store.importTarget(t.id, ownerType, ownerId)),
        );
        toast.success('Gear data imported');
      } else {
        toast.success(
          selected.length === 1
            ? `"${selected[0].name}" added`
            : `${selected.length} BiS targets added`,
        );
      }
    } catch {
      toast.error('Failed to add presets');
    } finally {
      setSaving(false);
    }
  };

  const handleAddLink = async () => {
    if (!linkUrl.trim()) return;
    setSaving(true);
    try {
      const url = linkUrl.trim();
      const sourceType: BiSSourceType =
        url.includes('etro.gg') ? 'etro' :
        url.includes('xivgear.app') ? 'xivgear' :
        'custom_link';

      const created = await store.createTarget({
        ownerType, ownerId, groupId: groupId ?? undefined,
        name: linkName.trim() || `${getJobDisplayName(job)} ${PURPOSE_LABELS[linkPurpose] ?? 'Set'}`,
        purpose: linkPurpose,
        sourceType,
        externalUrl: url,
        importStatus: 'linked_only',
      });
      setLinkUrl('');
      setLinkName('');

      if (sourceType === 'xivgear' || sourceType === 'etro') {
        toast.success('BiS target linked — importing gear data…');
        setActiveTab('targets');
        try {
          await store.importTarget(created.id, ownerType, ownerId);
          toast.success('Gear data imported');
        } catch {
          toast.error('Link saved, but gear import failed');
        }
      } else {
        toast.success('BiS target linked');
        setActiveTab('targets');
      }
    } catch {
      toast.error('Failed to add link');
    } finally {
      setSaving(false);
    }
  };

  const handleAddManual = async () => {
    if (!manualForm.name.trim()) return;
    setSaving(true);
    try {
      await store.createTarget({
        ownerType, ownerId, groupId: groupId ?? undefined,
        name: manualForm.name.trim(),
        purpose: manualForm.purpose,
        sourceType: manualForm.sourceType,
        externalUrl: manualForm.externalUrl.trim() || undefined,
        importStatus: 'linked_only',
        patch: manualForm.patch.trim() || undefined,
        notes: manualForm.notes.trim() || undefined,
      });
      setManualForm(EMPTY_FORM);
      toast.success('BiS target added');
      setActiveTab('targets');
    } catch {
      toast.error('Failed to add target');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (targetId: string) => {
    if (!editForm.name.trim()) return;
    setSaving(true);
    try {
      await store.updateTarget(targetId, {
        name: editForm.name.trim(),
        purpose: editForm.purpose,
        sourceType: editForm.sourceType,
        externalUrl: editForm.externalUrl.trim() || undefined,
        patch: editForm.patch.trim() || undefined,
        notes: editForm.notes.trim() || undefined,
      });
      setEditingId(null);
      toast.success('BiS target updated');
    } catch {
      toast.error('Failed to update target');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (targetId: string) => {
    setDeletingId(targetId);
    try {
      await store.deleteTarget(targetId, ownerType, ownerId);
      toast.success('BiS target removed');
    } catch {
      toast.error('Failed to remove target');
    } finally {
      setDeletingId(null);
    }
  };

  const handleImport = async (targetId: string) => {
    setImportingId(targetId);
    try {
      await store.importTarget(targetId, ownerType, ownerId);
      toast.success('Gear data imported');
    } catch {
      toast.error('Import failed — check that the URL is still valid');
    } finally {
      setImportingId(null);
    }
  };

  const handleSetActive = async (target: SharedBiSTargetSet) => {
    try {
      await store.setTargetActive(target.id, ownerType, ownerId);
      toast.success(`"${target.name}" set as active`);
    } catch {
      toast.error('Failed to set active BiS target');
    }
  };

  const startEdit = (target: SharedBiSTargetSet) => {
    setEditingId(target.id);
    setEditForm({
      name: target.name,
      purpose: target.purpose as BisTargetPurpose,
      sourceType: (target.sourceType as string) === 'preset' ? 'xivgear' : (target.sourceType as BiSSourceType),
      externalUrl: target.externalUrl ?? '',
      patch: target.patch ?? '',
      notes: target.notes ?? '',
    });
  };

  const jobDisplay = getJobDisplayName(job);
  const contextLabel =
    ownerType === 'player_job_profile'
      ? 'Saved to your Player Hub profile'
      : 'Saved to roster — visible to group members';

  return (
    <Modal isOpen onClose={onClose} title={`BiS Targets — ${jobDisplay}`} size="lg">
      <div className="space-y-4">
        <p className="text-xs text-text-secondary">{contextLabel}</p>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border-subtle pb-0">
          {(['targets', 'presets', 'link', 'manual'] as TabId[]).map((tab) => (
            // design-system-ignore: Tab toggle requires active-border styling not available in Button
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
                activeTab === tab
                  ? 'text-accent border-b-2 border-accent -mb-px'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab === 'targets' && `Saved${targets.length > 0 ? ` (${targets.length})` : ''}`}
              {tab === 'presets' && 'Add Preset'}
              {tab === 'link' && 'Paste Link'}
              {tab === 'manual' && 'Manual'}
            </button>
          ))}
        </div>

        {/* Saved targets tab */}
        {activeTab === 'targets' && (
          <div className="space-y-3">
            {isLoading && targets.length === 0 && (
              <p className="text-sm text-text-secondary">Loading…</p>
            )}
            {!isLoading && targets.length === 0 && (
              <p className="text-sm text-text-secondary">
                No BiS targets yet. Use the tabs above to add one.
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
                  <TargetForm
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
                        <span className="min-w-0 truncate font-medium text-text-primary">
                          {target.name}
                        </span>
                        <Badge variant="default" size="sm">
                          {PURPOSE_LABELS[target.purpose] ?? target.purpose}
                        </Badge>
                        <span className="text-xs text-text-tertiary">
                          {SOURCE_LABELS[target.sourceType] ?? target.sourceType}
                        </span>
                        {target.patch && (
                          <span className="text-xs text-text-tertiary">Patch {target.patch}</span>
                        )}
                        {target.importStatus === 'imported' && (
                          <span className="text-xs text-status-success">
                            {target.itemLevel ? `iLv ${target.itemLevel}` : 'Imported'}
                          </span>
                        )}
                        {target.importStatus === 'import_failed' && (
                          <span className="text-xs text-status-error">Import failed</span>
                        )}
                        {target.importStatus === 'unsupported' && (
                          <span className="text-xs text-text-tertiary">Unsupported</span>
                        )}
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
                        <p className="mt-1 text-xs italic text-text-secondary">{target.notes}</p>
                      )}
                    </div>
                    {canEdit && (
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
                        {(target.sourceType === 'xivgear' || target.sourceType === 'etro' || target.sourceType === 'preset') &&
                          target.externalUrl && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleImport(target.id)}
                              disabled={importingId === target.id}
                              title={target.importStatus === 'imported' ? 'Re-import gear data' : 'Import gear data'}
                            >
                              <RefreshCw
                                className={`h-3.5 w-3.5 ${importingId === target.id ? 'animate-spin' : ''}`}
                              />
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
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Presets tab */}
        {activeTab === 'presets' && (
          <div className="space-y-3">
            <p className="text-xs text-text-secondary">
              Curated BiS sets from The Balance for {jobDisplay}. Select one or more to add.
            </p>
            {presetsLoading && <p className="text-sm text-text-secondary">Loading presets…</p>}
            {presetsError && <p className="text-sm text-status-error">{presetsError}</p>}
            {!presetsLoading && !presetsError && presets.length === 0 && (
              <p className="text-sm text-text-secondary">No presets available for {jobDisplay}.</p>
            )}
            {presets.map((preset) => {
              const pid = preset.uuid ?? preset.name;
              const checked = selectedPresetIds.has(pid);
              return (
                <div
                  key={pid}
                  role="button"
                  tabIndex={0}
                  aria-pressed={checked}
                  onClick={() => togglePreset(preset)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); togglePreset(preset); }
                  }}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    checked
                      ? 'border-accent/40 bg-accent/5'
                      : 'border-border-default hover:border-accent/20'
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    onChange={() => togglePreset(preset)}
                    aria-label={`Select preset: ${preset.name}`}
                    className="mt-0.5 pointer-events-none"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-text-primary">{preset.name}</p>
                    {preset.description && (
                      <p className="mt-0.5 text-xs text-text-secondary">{preset.description}</p>
                    )}
                    {preset.gcd && (
                      <p className="text-xs text-text-tertiary">GCD {preset.gcd}</p>
                    )}
                  </div>
                </div>
              );
            })}
            {presets.length > 0 && (
              <Button
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
                disabled={selectedPresetIds.size === 0 || saving}
                onClick={handleAddPresets}
                data-testid="add-selected-presets-btn"
              >
                Add selected ({selectedPresetIds.size})
              </Button>
            )}
          </div>
        )}

        {/* Link tab */}
        {activeTab === 'link' && (
          <div className="space-y-3">
            <p className="text-xs text-text-secondary">
              Paste an Etro or XIVGear URL. Saved as a reference link.
            </p>
            <div>
              <Label size="sm" htmlFor="bis-link-url">URL</Label>
              <Input
                id="bis-link-url"
                value={linkUrl}
                onChange={setLinkUrl}
                placeholder="https://xivgear.app/share/… or https://etro.gg/gearset/…"
                data-testid="bis-link-url-input"
              />
            </div>
            <div>
              <Label size="sm" htmlFor="bis-link-name">Name (optional)</Label>
              <Input
                id="bis-link-name"
                value={linkName}
                onChange={setLinkName}
                placeholder="e.g. Week-1 BiS"
                data-testid="bis-link-name-input"
              />
            </div>
            <div>
              <Label size="sm" htmlFor="bis-link-purpose">Purpose</Label>
              <Select
                id="bis-link-purpose"
                value={linkPurpose}
                onChange={(v) => setLinkPurpose(v as BisTargetPurpose)}
                options={PURPOSE_OPTIONS}
              />
            </div>
            <p className="text-xs text-text-tertiary flex items-center gap-1">
              <Link2 className="h-3 w-3" />
              Gear data will be fetched automatically for XIVGear and Etro links.
            </p>
            <Button
              size="sm"
              disabled={!linkUrl.trim() || saving}
              onClick={handleAddLink}
              data-testid="add-link-btn"
            >
              Add linked target
            </Button>
          </div>
        )}

        {/* Manual tab */}
        {activeTab === 'manual' && (
          <TargetForm
            form={manualForm}
            onChange={setManualForm}
            onSubmit={handleAddManual}
            onCancel={() => setManualForm(EMPTY_FORM)}
            saving={saving}
            submitLabel="Add"
          />
        )}
      </div>
    </Modal>
  );
}

interface TargetFormProps {
  form: AddForm;
  onChange: (f: AddForm) => void;
  onSubmit: () => void;
  onCancel: () => void;
  saving: boolean;
  submitLabel: string;
}

function TargetForm({ form, onChange, onSubmit, onCancel, saving, submitLabel }: TargetFormProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label size="sm" htmlFor="bis-form-name">Name</Label>
        <Input
          id="bis-form-name"
          value={form.name}
          onChange={(v) => onChange({ ...form, name: v })}
          placeholder="e.g. Prog Set, Farm Set"
          data-testid="bis-name-input"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label size="sm" htmlFor="bis-form-purpose">Purpose</Label>
          <Select
            id="bis-form-purpose"
            value={form.purpose}
            onChange={(v) => onChange({ ...form, purpose: v as BisTargetPurpose })}
            options={PURPOSE_OPTIONS}
            data-testid="bis-purpose-select"
          />
        </div>
        <div>
          <Label size="sm" htmlFor="bis-form-source">Source</Label>
          <Select
            id="bis-form-source"
            value={form.sourceType}
            onChange={(v) => onChange({ ...form, sourceType: v as BiSSourceType })}
            options={SOURCE_OPTIONS}
            data-testid="bis-source-select"
          />
        </div>
      </div>
      {form.sourceType !== 'manual' && (
        <div>
          <Label size="sm" htmlFor="bis-form-url">URL (optional)</Label>
          <Input
            id="bis-form-url"
            value={form.externalUrl}
            onChange={(v) => onChange({ ...form, externalUrl: v })}
            placeholder="https://…"
            data-testid="bis-url-input"
          />
        </div>
      )}
      <div>
        <Label size="sm" htmlFor="bis-form-patch">Patch (optional)</Label>
        <Input
          id="bis-form-patch"
          value={form.patch}
          onChange={(v) => onChange({ ...form, patch: v })}
          placeholder="e.g. 7.2"
          data-testid="bis-patch-input"
        />
      </div>
      <div>
        <Label size="sm" htmlFor="bis-form-notes">Notes (optional)</Label>
        <Input
          id="bis-form-notes"
          value={form.notes}
          onChange={(v) => onChange({ ...form, notes: v })}
          placeholder="e.g. missing ring 2"
          data-testid="bis-notes-input"
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onSubmit} disabled={!form.name.trim() || saving}>
          {submitLabel}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} aria-label="Cancel">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
