/**
 * FarmEditBlock — a farm's inline Edit (S2a-3a·G5 Task TG8; design §12.2, D-12, R-S3-10, R-S3-4).
 * It sits on top of the open row's panel while the lead is editing: Title, Type, Status, Content
 * and its key, Priority mode (with a help line that follows the choice) and Notes, which writes
 * `summary`. Title takes the focus when it opens.
 *
 * Save is disabled while Title is blank or nothing changed. It sends only the changed fields of
 * those seven (never `note`), through the store's `updateGoal` as it stands: a Notes or Content
 * Key that is blank after trimming sends `null`, and so do Content "None" and Priority mode "Not
 * set". `Select` drops an empty-valued option into its placeholder, so those two choices carry the
 * `NONE` value here and map to `null` on the way out. A saved edit toasts "Saved", refreshes the
 * goal's read model and closes the block; a failed one keeps it, with an error toast (unless
 * `api.ts` already toasted a true 403).
 *
 * Escape and Cancel discard, at once. Escape is this block's only when no layer took it first: an
 * open `Select` is Radix's own dismissable layer, which handles the key in the capture phase and
 * prevents it, so `defaultPrevented` is set here and the block (and the panel, whose filter reads
 * the same flag) is left alone. Whether the block has unsaved changes goes to the page
 * (`onDirtyChange`), which asks "Discard changes?" before anything else would drop it.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { wasToastedByApi } from '../../services/api';
import {
  useCollectionGoalStore,
  type CollectionContentType,
  type CollectionGoal,
  type CollectionGoalType,
  type CollectionGoalUpdate,
  type CollectionPriorityMode,
} from '../../stores/collectionGoalStore';
import { toast } from '../../stores/toastStore';
import { CONTENT_TYPE_LABELS, GOAL_STATUS_OPTIONS, GOAL_TYPE_LABELS, PRIORITY_MODE_OPTIONS } from '../../utils/goalTypeMeta';
import { Button } from '../primitives';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { BUSY_CLASS } from './useDrops';
import { messageOf } from './undoToasts';

/** The schema's limits (`CollectionGoalUpdate`). */
const TITLE_MAX = 200;
const KEY_MAX = 50;

/** Content "None" and priority mode "Not set" in a `Select`, which cannot hold an empty value. */
const NONE = '__none';

const TYPE_OPTIONS = (Object.keys(GOAL_TYPE_LABELS) as CollectionGoalType[]).map((value) => ({ value, label: GOAL_TYPE_LABELS[value] }));
const CONTENT_OPTIONS = [
  { value: NONE, label: 'None' },
  ...(Object.keys(CONTENT_TYPE_LABELS) as CollectionContentType[]).map((value) => ({ value, label: CONTENT_TYPE_LABELS[value] })),
];
const MODE_OPTIONS = PRIORITY_MODE_OPTIONS.map((option) => ({ value: option.value ?? NONE, label: option.label }));

interface Draft {
  title: string;
  goalType: CollectionGoalType;
  status: CollectionGoal['status'];
  contentType: string;
  contentKey: string;
  priorityMode: string;
  notes: string;
}

const draftOf = (goal: CollectionGoal): Draft => ({
  title: goal.title,
  goalType: goal.goalType,
  status: goal.status,
  contentType: goal.contentType ?? NONE,
  contentKey: goal.contentKey ?? '',
  priorityMode: goal.priorityMode ?? NONE,
  notes: goal.summary ?? '',
});

/** Blank after trimming reads as nothing (`null`). */
const textOrNull = (value: string | null): string | null => value?.trim() || null;

/** The fields of `draft` that differ from `goal`, as the update the store sends. Empty when nothing changed. */
function changesOf(goal: CollectionGoal, draft: Draft): CollectionGoalUpdate {
  const update: CollectionGoalUpdate = {};
  const title = draft.title.trim();
  if (title !== goal.title) update.title = title;
  if (draft.goalType !== goal.goalType) update.goalType = draft.goalType;
  if (draft.status !== goal.status) update.status = draft.status;
  const contentType = draft.contentType === NONE ? null : (draft.contentType as CollectionContentType);
  if (contentType !== goal.contentType) update.contentType = contentType;
  const contentKey = textOrNull(draft.contentKey);
  if (contentKey !== textOrNull(goal.contentKey)) update.contentKey = contentKey;
  const priorityMode = draft.priorityMode === NONE ? null : (draft.priorityMode as CollectionPriorityMode);
  if (priorityMode !== goal.priorityMode) update.priorityMode = priorityMode;
  const summary = textOrNull(draft.notes);
  if (summary !== textOrNull(goal.summary)) update.summary = summary;
  return update;
}

export interface FarmEditBlockProps {
  groupId: string;
  goal: CollectionGoal;
  /** The block is finished (saved, or discarded): the caller removes it and returns focus. */
  onDone: () => void;
  /** Whether the draft differs from the goal, reported on every change and `false` as the block goes. */
  onDirtyChange: (dirty: boolean) => void;
}

export function FarmEditBlock({ groupId, goal, onDone, onDirtyChange }: FarmEditBlockProps) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(goal));
  const [saving, setSaving] = useState(false);
  // The state alone would let a second Enter in before the re-render that marks Save busy.
  const lock = useRef(false);
  const mounted = useRef(true);
  const titleRef = useRef<HTMLInputElement>(null);
  const ids = useId();
  const id = (field: string) => `${ids}-${field}`;

  const update = changesOf(goal, draft);
  const dirty = Object.keys(update).length > 0;
  const canSave = dirty && draft.title.trim() !== '';
  const set = <K extends keyof Draft>(field: K, value: Draft[K]) => setDraft((prev) => ({ ...prev, [field]: value }));

  useEffect(() => {
    mounted.current = true;
    titleRef.current?.focus();
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const save = async () => {
    if (lock.current || !canSave) return;
    lock.current = true;
    setSaving(true);
    try {
      try {
        await useCollectionGoalStore.getState().updateGoal(groupId, goal.id, update);
      } catch (err) {
        if (!wasToastedByApi(err)) toast.error(`Couldn't save the farm: ${messageOf(err)}`);
        return;
      }
      toast.success('Saved');
      if (mounted.current) onDone();
      await useCollectionGoalStore.getState().refreshGoalProgress(groupId, goal.id);
    } finally {
      lock.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const cancel = () => {
    if (!lock.current) onDone();
  };
  // A native listener on the form (a form is not an interactive element to hang a React key handler
  // on): it runs before React's root dispatch, so the panel's own Escape filter sees the key prevented.
  const cancelRef = useRef(cancel);
  useEffect(() => {
    cancelRef.current = cancel;
  });
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const form = formRef.current;
    if (form === null) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      cancelRef.current();
    };
    form.addEventListener('keydown', onKeyDown);
    return () => form.removeEventListener('keydown', onKeyDown);
  }, []);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void save();
  };

  const modeHelp = PRIORITY_MODE_OPTIONS.find((option) => (option.value ?? NONE) === draft.priorityMode)?.help;

  return (
    <form
      ref={formRef}
      aria-label={`Edit ${goal.title}`}
      data-testid="progress-edit-block"
      noValidate
      className="mb-4 rounded-lg border border-border-default bg-surface-card p-3"
      onSubmit={onSubmit}
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-x-4 gap-y-1">
        <div>
          <Label htmlFor={id('title')} size="sm">
            Title
          </Label>
          <Input
            ref={titleRef}
            id={id('title')}
            size="sm"
            fullWidth
            required
            maxLength={TITLE_MAX}
            value={draft.title}
            onChange={(value) => set('title', value)}
          />
        </div>
        <div>
          <Label htmlFor={id('type')} size="sm">
            Type
          </Label>
          <Select id={id('type')} value={draft.goalType} options={TYPE_OPTIONS} onChange={(value) => set('goalType', value as CollectionGoalType)} />
        </div>
        <div>
          <Label htmlFor={id('status')} size="sm">
            Status
          </Label>
          <Select
            id={id('status')}
            value={draft.status}
            options={GOAL_STATUS_OPTIONS.map((option) => ({ ...option }))}
            onChange={(value) => set('status', value as Draft['status'])}
          />
        </div>
        <div>
          <Label htmlFor={id('content')} size="sm">
            Content
          </Label>
          <Select id={id('content')} value={draft.contentType} options={CONTENT_OPTIONS} onChange={(value) => set('contentType', value)} />
        </div>
        <div>
          <Label htmlFor={id('key')} size="sm">
            Duty or key (optional)
          </Label>
          <Input id={id('key')} size="sm" fullWidth maxLength={KEY_MAX} value={draft.contentKey} onChange={(value) => set('contentKey', value)} />
        </div>
        <div>
          <Label htmlFor={id('mode')} size="sm">
            Priority mode
          </Label>
          <Select id={id('mode')} value={draft.priorityMode} options={MODE_OPTIONS} onChange={(value) => set('priorityMode', value)} />
          {modeHelp !== undefined && (
            <p data-testid="progress-edit-mode-help" className="mt-1 text-xs text-text-muted">
              {modeHelp}
            </p>
          )}
        </div>
        <div className="col-span-full">
          <Label htmlFor={id('notes')} size="sm">
            Notes
          </Label>
          <Input id={id('notes')} size="sm" fullWidth value={draft.notes} onChange={(value) => set('notes', value)} />
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" aria-disabled={saving || undefined} className={BUSY_CLASS} onClick={cancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={!canSave} aria-disabled={saving || undefined} className={BUSY_CLASS}>
          Save
        </Button>
      </div>
    </form>
  );
}
