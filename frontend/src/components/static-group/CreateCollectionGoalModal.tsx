/* eslint-disable design-system/no-raw-button */
import { useState } from 'react';
import { ChevronLeft, Target } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../primitives/Button';
import {
  useCollectionGoalStore,
  type CollectionGoalCreate,
  type CollectionGoalType,
  type CollectionGoalStatus,
  type CollectionContentType,
} from '../../stores/collectionGoalStore';

interface CreateCollectionGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
}

// ── Static data ────────────────────────────────────────────────────────────

const CONTENT_TYPE_OPTIONS: { value: CollectionContentType; label: string; description: string }[] = [
  { value: 'extreme',          label: 'Extreme',           description: 'Extreme trials' },
  { value: 'savage',           label: 'Savage',            description: 'Savage raids' },
  { value: 'ultimate',         label: 'Ultimate',          description: 'Ultimate raids' },
  { value: 'criterion',        label: 'Criterion',         description: 'Criterion dungeons' },
  { value: 'chaotic_alliance', label: 'Chaotic Alliance',  description: 'Chaotic alliance raids' },
  { value: 'field_operation',  label: 'Field Operation',   description: 'Bozja / Eureka / Occult Crescent' },
  { value: 'custom',           label: 'Other / Custom',    description: 'Anything else' },
];

interface UltimateDuty {
  key: string;
  label: string;
  shortName: string;
}

const ULTIMATE_DUTIES: UltimateDuty[] = [
  { key: 'ucob', label: 'The Unending Coil of Bahamut (Ultimate)', shortName: 'UCoB' },
  { key: 'uwu',  label: "The Weapon's Refrain (Ultimate)",          shortName: 'UwU'  },
  { key: 'tea',  label: 'The Epic of Alexander (Ultimate)',         shortName: 'TEA'  },
  { key: 'dsr',  label: "Dragonsong's Reprise (Ultimate)",          shortName: 'DSR'  },
  { key: 'top',  label: 'The Omega Protocol (Ultimate)',            shortName: 'TOP'  },
  { key: 'fru',  label: 'Futures Rewritten (Ultimate)',             shortName: 'FRU'  },
];

const REWARD_TYPE_OPTIONS: { value: CollectionGoalType; label: string; description: string }[] = [
  { value: 'mount',         label: 'Mount',              description: 'Farmable mount from the content' },
  { value: 'weapon',        label: 'Weapon',             description: 'Ultimate weapon / relic weapon' },
  { value: 'weapon_coffer', label: 'Weapon Coffer',      description: 'Weapon token / coffer' },
  { value: 'title',         label: 'Title',              description: 'Completion title' },
  { value: 'clear_count',   label: 'Clear Count',        description: 'Track reclear runs' },
  { value: 'token',         label: 'Token / Totem',      description: 'Currency or totem farming' },
  { value: 'minion',        label: 'Minion',             description: 'Minion drop' },
  { value: 'orchestrion',   label: 'Orchestrion Roll',   description: 'Music roll drop' },
  { value: 'glam',          label: 'Glamour / Other Item', description: 'Gear cosmetic or misc item' },
  { value: 'custom_reward', label: 'Custom / Other',     description: 'Anything not listed above' },
];

const STATUS_OPTIONS: { value: CollectionGoalStatus; label: string }[] = [
  { value: 'wanted',    label: 'Wanted — planning to farm' },
  { value: 'farming',   label: 'Farming — actively running' },
  { value: 'scheduled', label: 'Scheduled — on the calendar' },
  { value: 'complete',  label: 'Complete — obtained' },
];

// Auto-name suffix per reward type
const REWARD_NAME_SUFFIX: Record<CollectionGoalType, string> = {
  mount:         'mount farm',
  weapon:        'weapon farm',
  weapon_coffer: 'weapon coffer',
  title:         'title clear',
  clear_count:   'reclears',
  token:         'token farm',
  minion:        'minion farm',
  orchestrion:   'orchestrion farm',
  glam:          'glamour farm',
  custom_reward: 'farm',
};

function buildAutoName(
  contentType: CollectionContentType | null,
  contentKey: string | null,
  dutyLabel: string,
  rewardType: CollectionGoalType | null,
): string {
  const suffix = rewardType ? REWARD_NAME_SUFFIX[rewardType] : '';
  if (!suffix) return '';

  if (contentType === 'ultimate') {
    const duty = ULTIMATE_DUTIES.find((d) => d.key === contentKey);
    const prefix = duty ? duty.shortName : (dutyLabel.trim() || 'Ultimate');
    return `${prefix} ${suffix}`;
  }

  if (dutyLabel.trim()) return `${dutyLabel.trim()} ${suffix}`;

  const ctLabel = CONTENT_TYPE_OPTIONS.find((c) => c.value === contentType)?.label ?? '';
  return ctLabel ? `${ctLabel} ${suffix}` : suffix;
}

// ── Form state ─────────────────────────────────────────────────────────────

type Step = 'content_type' | 'duty' | 'reward_type' | 'status' | 'name';

interface FormState {
  contentType: CollectionContentType | null;
  contentKey: string | null;   // slug for ultimate duties; null for free-text
  dutyLabel: string;            // free-text duty name (non-ultimate or custom)
  rewardType: CollectionGoalType | null;
  status: CollectionGoalStatus;
  title: string;
  titleEdited: boolean;         // true once user manually edits name
  note: string;
  targetCount: string;
  currentCount: string;
}

const EMPTY_FORM: FormState = {
  contentType: null, contentKey: null, dutyLabel: '',
  rewardType: null, status: 'wanted',
  title: '', titleEdited: false,
  note: '', targetCount: '', currentCount: '',
};

// ── Component ──────────────────────────────────────────────────────────────

export function CreateCollectionGoalModal({ isOpen, onClose, groupId }: CreateCollectionGoalModalProps) {
  const { createGoal } = useCollectionGoalStore();
  const [step, setStep] = useState<Step>('content_type');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const patch = (update: Partial<FormState>) =>
    setForm((prev) => {
      const next = { ...prev, ...update };
      if (!next.titleEdited) {
        next.title = buildAutoName(next.contentType, next.contentKey, next.dutyLabel, next.rewardType);
      }
      return next;
    });

  const handleClose = () => {
    setStep('content_type');
    setForm(EMPTY_FORM);
    setError(null);
    onClose();
  };

  const handleSave = async () => {
    const title = form.title.trim();
    if (!title) { setError('Title is required.'); return; }
    if (!form.rewardType) { setError('Reward type is required.'); return; }

    const targetNum = form.targetCount.trim() ? parseInt(form.targetCount.trim(), 10) : null;
    const currentNum = form.currentCount.trim() ? parseInt(form.currentCount.trim(), 10) : null;
    if (form.targetCount.trim() && (isNaN(targetNum!) || targetNum! < 0)) {
      setError('Target count must be a non-negative whole number.'); return;
    }
    if (form.currentCount.trim() && (isNaN(currentNum!) || currentNum! < 0)) {
      setError('Current count must be a non-negative whole number.'); return;
    }

    const data: CollectionGoalCreate = {
      goalType: form.rewardType,
      contentType: form.contentType,
      contentKey: form.contentKey || (form.dutyLabel.trim() || null),
      title,
      status: form.status,
      note: form.note.trim() || null,
      targetCount: targetNum,
      currentCount: currentNum,
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

  // ── Step navigation ──────────────────────────────────────────────────────

  const goNext = () => {
    if (step === 'content_type') {
      // Skip duty step if content is "custom" with no duty needed
      if (form.contentType === 'custom') { setStep('reward_type'); return; }
      setStep('duty');
      return;
    }
    if (step === 'duty')        { setStep('reward_type'); return; }
    if (step === 'reward_type') { setStep('status'); return; }
    if (step === 'status')      { setStep('name'); return; }
  };

  const goBack = () => {
    if (step === 'name')        { setStep('status'); return; }
    if (step === 'status')      { setStep('reward_type'); return; }
    if (step === 'reward_type') {
      if (form.contentType === 'custom') { setStep('content_type'); return; }
      setStep('duty');
      return;
    }
    if (step === 'duty')        { setStep('content_type'); return; }
  };

  // Progress indicator width
  const totalSteps = form.contentType === 'custom' ? 4 : 5;
  const effectiveIdx = step === 'content_type' ? 0
    : step === 'duty' ? 1
    : step === 'reward_type' ? (form.contentType === 'custom' ? 1 : 2)
    : step === 'status' ? (form.contentType === 'custom' ? 2 : 3)
    : (form.contentType === 'custom' ? 3 : 4);
  const progressPct = Math.round((effectiveIdx / Math.max(totalSteps - 1, 1)) * 100);

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
      <div className="space-y-5">
        {/* Progress bar */}
        <div className="h-1 w-full rounded-full bg-surface-elevated overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-300"
            style={{ width: `${step === 'name' ? 100 : progressPct}%` }}
          />
        </div>

        {/* ── Step 1: Content Type ─────────────────────────────────────── */}
        {step === 'content_type' && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-text-secondary">What kind of content is this goal for?</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CONTENT_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => patch({ contentType: opt.value, contentKey: null, dutyLabel: '' })}
                  className={`flex flex-col items-start rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    form.contentType === opt.value
                      ? 'border-accent/50 bg-accent/10 text-accent'
                      : 'border-border-default bg-surface-elevated/50 text-text-secondary hover:border-accent/30 hover:text-text-primary'
                  }`}
                >
                  <span className="text-sm font-semibold">{opt.label}</span>
                  <span className="text-[11px] opacity-70 mt-0.5">{opt.description}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <Button type="button" disabled={!form.contentType} onClick={goNext}>
                Next
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Content / Duty ───────────────────────────────────── */}
        {step === 'duty' && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-text-secondary">
              {form.contentType === 'ultimate'
                ? 'Which Ultimate duty?'
                : 'Which specific duty or trial? (optional)'}
            </p>

            {form.contentType === 'ultimate' ? (
              <div className="space-y-1.5">
                {ULTIMATE_DUTIES.map((duty) => (
                  <button
                    key={duty.key}
                    type="button"
                    onClick={() => patch({ contentKey: duty.key, dutyLabel: '' })}
                    className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      form.contentKey === duty.key
                        ? 'border-accent/50 bg-accent/10 text-accent'
                        : 'border-border-default bg-surface-elevated/50 text-text-secondary hover:border-accent/30 hover:text-text-primary'
                    }`}
                  >
                    <span>{duty.label}</span>
                    <span className="text-xs font-mono opacity-60 ml-2 flex-shrink-0">{duty.shortName}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => patch({ contentKey: 'custom', dutyLabel: '' })}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    form.contentKey === 'custom'
                      ? 'border-accent/50 bg-accent/10 text-accent'
                      : 'border-border-default bg-surface-elevated/50 text-text-secondary hover:border-accent/30 hover:text-text-primary'
                  }`}
                >
                  Other / not listed
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                {/* design-system-ignore: no Label primitive in design system */}
                <label className="text-xs font-medium text-text-secondary">
                  Duty name
                  <span className="ml-1 font-normal text-text-muted">(optional)</span>
                </label>
                <Input
                  value={form.dutyLabel}
                  onChange={(v) => patch({ dutyLabel: v, contentKey: null })}
                  placeholder="e.g. Hephaiston (Extreme), P12S"
                  autoFocus
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <button type="button" onClick={goBack} className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary transition-colors">
                <ChevronLeft className="w-3 h-3" /> Back
              </button>
              <Button type="button" onClick={goNext}>
                {form.contentType === 'ultimate' && !form.contentKey ? 'Skip' : 'Next'}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Reward Type ──────────────────────────────────────── */}
        {step === 'reward_type' && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-text-secondary">What are you tracking?</p>
            <div className="grid grid-cols-2 gap-2">
              {REWARD_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => patch({ rewardType: opt.value })}
                  className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors ${
                    form.rewardType === opt.value
                      ? 'border-accent/50 bg-accent/10 text-accent'
                      : 'border-border-default bg-surface-elevated/50 text-text-secondary hover:border-accent/30 hover:text-text-primary'
                  }`}
                >
                  <span className="text-sm font-semibold">{opt.label}</span>
                  <span className="text-[10px] opacity-70 mt-0.5">{opt.description}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <button type="button" onClick={goBack} className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary transition-colors">
                <ChevronLeft className="w-3 h-3" /> Back
              </button>
              <Button type="button" disabled={!form.rewardType} onClick={goNext}>
                Next
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 4: Status ───────────────────────────────────────────── */}
        {step === 'status' && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-text-secondary">Current status?</p>
            <div className="space-y-1.5">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => patch({ status: opt.value })}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    form.status === opt.value
                      ? 'border-accent/50 bg-accent/10 text-accent'
                      : 'border-border-default bg-surface-elevated/50 text-text-secondary hover:border-accent/30 hover:text-text-primary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <button type="button" onClick={goBack} className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary transition-colors">
                <ChevronLeft className="w-3 h-3" /> Back
              </button>
              <Button type="button" onClick={goNext}>
                Next
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 5: Name + confirm ───────────────────────────────────── */}
        {step === 'name' && (
          <div className="space-y-4">
            <div className="space-y-1">
              {/* design-system-ignore: no Label primitive in design system */}
              <label className="text-xs font-medium text-text-secondary">
                Goal name
                {!form.titleEdited && form.title && (
                  <span className="ml-1.5 font-normal text-text-muted">auto-suggested</span>
                )}
              </label>
              <Input
                value={form.title}
                onChange={(v) => setForm((prev) => ({ ...prev, title: v, titleEdited: v !== buildAutoName(prev.contentType, prev.contentKey, prev.dutyLabel, prev.rewardType) }))}
                placeholder="e.g. FRU weapon farm"
                autoFocus
              />
            </div>

            {/* Token count fields */}
            {form.rewardType === 'token' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  {/* design-system-ignore */}
                  <label className="text-xs font-medium text-text-secondary">
                    Target count <span className="font-normal text-text-muted">(optional)</span>
                  </label>
                  <Input value={form.targetCount} onChange={(v) => patch({ targetCount: v })} placeholder="e.g. 99" />
                </div>
                <div className="space-y-1">
                  {/* design-system-ignore */}
                  <label className="text-xs font-medium text-text-secondary">
                    Current count <span className="font-normal text-text-muted">(optional)</span>
                  </label>
                  <Input value={form.currentCount} onChange={(v) => patch({ currentCount: v })} placeholder="e.g. 40" />
                </div>
              </div>
            )}

            <div className="space-y-1">
              {/* design-system-ignore */}
              <label className="text-xs font-medium text-text-secondary">
                Internal note <span className="font-normal text-text-muted">(optional, lead-only)</span>
              </label>
              <Input value={form.note} onChange={(v) => patch({ note: v })} placeholder="e.g. Prioritise tanks first" />
            </div>

            {/* Summary of selections */}
            <div className="rounded-lg bg-surface-elevated/60 border border-border-subtle px-3 py-2 text-xs text-text-secondary space-y-0.5">
              {form.contentType && (
                <div>
                  <span className="text-text-tertiary">Source: </span>
                  {CONTENT_TYPE_OPTIONS.find((c) => c.value === form.contentType)?.label ?? form.contentType}
                  {form.contentType === 'ultimate' && form.contentKey && form.contentKey !== 'custom' && (
                    <span className="text-text-tertiary"> · {ULTIMATE_DUTIES.find((d) => d.key === form.contentKey)?.label}</span>
                  )}
                  {(form.contentType !== 'ultimate' && form.dutyLabel) && (
                    <span className="text-text-tertiary"> · {form.dutyLabel}</span>
                  )}
                </div>
              )}
              {form.rewardType && (
                <div>
                  <span className="text-text-tertiary">Reward: </span>
                  {REWARD_TYPE_OPTIONS.find((r) => r.value === form.rewardType)?.label ?? form.rewardType}
                </div>
              )}
              <div>
                <span className="text-text-tertiary">Status: </span>
                {STATUS_OPTIONS.find((s) => s.value === form.status)?.label ?? form.status}
              </div>
            </div>

            {error && <p className="text-sm text-status-error">{error}</p>}

            <div className="flex items-center justify-between pt-1">
              <button type="button" onClick={goBack} className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary transition-colors">
                <ChevronLeft className="w-3 h-3" /> Back
              </button>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={handleClose} disabled={isSaving}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleSave} disabled={isSaving || !form.title.trim()}>
                  {isSaving ? 'Saving…' : 'Create Goal'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
