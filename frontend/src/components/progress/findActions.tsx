/**
 * findActions — Find's row actions (S2a-4a·A3 Task TA3; R-F-6, D-6, D-7, D-8, design §3.2–§3.3).
 *
 * `LeadFindAction`: **Track** on a trackable, untracked item seeds a goal (`createGoalFromSuggestion`,
 * status `farming`), refreshes the lists, hands the new id to `onTracked` (the page's one URL write)
 * and toasts "Tracking {name}". A fallback (offline) item reads "Offline list: retry to track".
 *
 * `MemberFindAction`: **I want this** writes the member's own Hub want (`upsertIntent`, a full
 * replace): a new row gets the defaults, an existing row keeps its priority and notes, and a
 * private one asks first, inline ("Your want is private. Share it with your statics?" Share ·
 * Cancel, Cancel last so it holds the trigger's place, S-6) so a private want is never shared
 * blind. Nothing is written before this mount's intents
 * have loaded, and the page never renders it under View As (the intents route ignores
 * `X-View-As`). A shared want reads **Wanted ✓**.
 *
 * `CustomTrackRow`: the search text as a custom farm (`createGoal`, `custom_reward`), then
 * `onCreated` (the page opens the row with Edit on, Title focused).
 *
 * Every control is `aria-disabled` with `BUSY_CLASS` while its write runs (focus stays, clicks
 * are ignored), one write at a time per row; a failure toasts unless `api.ts` already did.
 */
import { useCallback, useLayoutEffect, useRef, useState, type ComponentProps, type KeyboardEvent, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { wasToastedByApi } from '../../services/api';
import { Button } from '../primitives/Button';
import { Tag } from '../ui/Tag';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import { useCollectionIntentStore, type CollectionIntent, type CollectionIntentUpsert } from '../../stores/collectionIntentStore';
import { toast } from '../../stores/toastStore';
import { normalizeQuery, type FindItem } from '../../utils/findModel';
import { messageOf } from './undoToasts';
import { BUSY_CLASS } from './useDrops';

const SHARE_PROMPT = 'Your want is private. Share it with your statics?';
const TITLE_MAX = 200;

/** The row's disclosure toggle (`FindRow`'s first control): where focus lands when a control under it is gone. */
function rowToggleOf(from: HTMLElement): HTMLElement | null {
  return from.closest('li')?.querySelector<HTMLElement>('button[aria-expanded]') ?? null;
}

interface ActionButtonProps extends Omit<ComponentProps<typeof Button>, 'onClick' | 'variant' | 'size' | 'className'> {
  busy: boolean;
  onPress: () => void;
  /** Where focus lands when this control is removed while it holds focus (never <body>). Keep it stable. */
  leaveTo?: (el: HTMLButtonElement) => HTMLElement | null;
  children: ReactNode;
}

/** A Find action: `secondary` (the row is `bg-surface-card`), `aria-disabled` with `BUSY_CLASS` while busy. */
function ActionButton({ busy, onPress, leaveTo, children, ref: outerRef, ...rest }: ActionButtonProps) {
  const inner = useRef<HTMLButtonElement>(null);
  const setRefs = useCallback(
    (el: HTMLButtonElement | null) => {
      inner.current = el;
      if (typeof outerRef === 'function') outerRef(el);
      else if (outerRef != null) outerRef.current = el;
    },
    [outerRef],
  );
  // A layout cleanup runs before React removes the button, while it still sits in its row (so the
  // landing can be found), but it also runs for StrictMode's simulated unmount, which removes
  // nothing. So the move is decided once the commit is over: only when the button is really gone
  // and nothing else (the prompt's Cancel, a row's name) has taken the focus meanwhile.
  useLayoutEffect(() => {
    const el = inner.current;
    return () => {
      if (leaveTo === undefined || el === null || document.activeElement !== el) return;
      const landing = leaveTo(el);
      queueMicrotask(() => {
        if (el.isConnected || landing === null) return;
        const active = document.activeElement;
        if (active !== null && active !== document.body) return;
        landing.focus();
      });
    };
  }, [leaveTo]);
  return (
    <Button
      ref={setRefs}
      variant="secondary"
      size="sm"
      className={BUSY_CLASS}
      aria-disabled={busy || undefined}
      onClick={() => {
        if (!busy) onPress();
      }}
      {...rest}
    >
      {children}
    </Button>
  );
}

// ── Lead: Track ─────────────────────────────────────────────────────────────

/** Track writes in flight, by static and item: the Wanted and All twins of a row share one. */
const tracking = new Set<string>();

interface LeadFindActionProps {
  item: FindItem;
  groupId: string;
  /** The goal exists and its cells are fetched: open it (one URL write). */
  onTracked: (goalId: string) => void;
}

export function LeadFindAction({ item, groupId, onTracked }: LeadFindActionProps) {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  if (item.tracking !== null) return null;
  if (!item.trackable) return <span className="text-xs text-text-muted">Offline list: retry to track</span>;

  const track = async () => {
    const key = `${groupId}:${item.id}`;
    if (lock.current || tracking.has(key)) return;
    lock.current = true;
    tracking.add(key);
    setBusy(true);
    try {
      const store = useCollectionGoalStore.getState();
      let goalId: string;
      try {
        goalId = (await store.createGoalFromSuggestion(groupId, { catalogItemId: item.id, status: 'farming' })).id;
      } catch (err) {
        if (!wasToastedByApi(err)) toast.error(`Couldn't track ${item.name}: ${messageOf(err)}`);
        return;
      }
      // The goal exists either way: a failed refresh still opens it (the row fetches what it lacks).
      await store.refreshGoalProgress(groupId, goalId, { lists: true }).catch(() => undefined);
      onTracked(goalId);
      toast.success(`Tracking ${item.name}`);
    } finally {
      tracking.delete(key);
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <ActionButton busy={busy} onPress={() => void track()}>
      Track
    </ActionButton>
  );
}

// ── Member: I want this ─────────────────────────────────────────────────────

export type MemberIntentsStatus = 'loading' | 'ready' | 'failed';

interface MemberFindActionProps {
  item: FindItem;
  groupId: string;
  /** The member's own row for the item, once the intents have loaded. */
  existing: CollectionIntent | undefined;
  /** This mount's `fetchMyIntents`: nothing is written until it has settled (D-6). */
  intents: MemberIntentsStatus;
  onRetry: () => void;
}

const isShared = (row: CollectionIntent) => (row.intent === 'hunting' || row.intent === 'interested') && row.visibility !== 'private';

export function MemberFindAction({ item, groupId, existing, intents, onRetry }: MemberFindActionProps) {
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState(false);
  const lock = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Cancel (or Escape) hands focus back to I want this once it is mounted again.
  const returnToTrigger = useRef(false);

  useLayoutEffect(() => {
    if (prompt) {
      cancelRef.current?.focus();
    } else if (returnToTrigger.current) {
      returnToTrigger.current = false;
      triggerRef.current?.focus();
    }
  }, [prompt]);

  const write = async () => {
    if (lock.current) return;
    // Never before the member's rows are known: a blind write would replace one (D-6, M-5a).
    if (intents !== 'ready' || !useCollectionIntentStore.getState().myIntentsLoaded) return;
    const body: CollectionIntentUpsert =
      existing === undefined
        ? { intent: 'hunting', priority: 'medium', visibility: 'static_only', notes: null }
        : {
            intent: 'hunting',
            priority: existing.priority,
            // A private row is shared only through the prompt; a shared one keeps its reach (never downgraded).
            visibility: existing.visibility === 'private' ? 'static_only' : existing.visibility,
            notes: existing.notes,
          };
    lock.current = true;
    setBusy(true);
    try {
      const store = useCollectionIntentStore.getState();
      try {
        await store.upsertIntent(item.id, body);
      } catch (err) {
        if (!wasToastedByApi(err)) toast.error(`Couldn't save your want: ${messageOf(err)}`);
        return;
      }
      setPrompt(false);
      await store.fetchSuggestions(groupId);
      toast.success(`Your statics can see you want ${item.name}`);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const press = () => {
    if (intents !== 'ready') return;
    if (existing !== undefined && existing.visibility === 'private') setPrompt(true);
    else void write();
  };

  const cancel = () => {
    if (busy) return;
    returnToTrigger.current = true;
    setPrompt(false);
  };

  // Escape answers the prompt and is prevented, so no outer layer (the row, the view) acts on it.
  const onPromptKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    cancel();
  };

  if (intents === 'failed') {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-xs text-status-error">Couldn't load your wants</span>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </span>
    );
  }

  if (intents === 'ready' && existing !== undefined && isShared(existing)) {
    return (
      <Tag variant="label" tone="success">
        Wanted ✓
      </Tag>
    );
  }

  if (prompt) {
    // Cancel is the LAST control, so it sits where I want this was (the slot's right edge, S-6): a
    // second press on the same spot cancels, never shares. The order is the DOM's, with no CSS
    // reordering, so Tab runs the same way the eye does.
    return (
      <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
        <span className="text-xs text-text-secondary">{SHARE_PROMPT}</span>
        <ActionButton busy={busy} onPress={() => void write()} leaveTo={rowToggleOf} onKeyDown={onPromptKeyDown}>
          Share
        </ActionButton>
        <ActionButton ref={cancelRef} busy={busy} onPress={cancel} onKeyDown={onPromptKeyDown}>
          Cancel
        </ActionButton>
      </span>
    );
  }

  // Until the intents have loaded the control is the busy placeholder: in place, never pressable.
  return (
    <ActionButton ref={triggerRef} busy={busy || intents !== 'ready'} onPress={press} leaveTo={rowToggleOf}>
      I want this
    </ActionButton>
  );
}

// ── Lead: the custom row ────────────────────────────────────────────────────

interface CustomTrackRowProps {
  query: string;
  groupId: string;
  /** The goal exists: open its row with Edit on (one URL write). */
  onCreated: (goalId: string) => void;
}

export function CustomTrackRow({ query, groupId, onCreated }: CustomTrackRowProps) {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  if (normalizeQuery(query) === '') return <p className="text-xs text-text-muted">Type a name to track a custom farm</p>;
  const title = query.trim().slice(0, TITLE_MAX);

  const create = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      let goalId: string;
      try {
        goalId = (await useCollectionGoalStore.getState().createGoal(groupId, { goalType: 'custom_reward', title, status: 'farming' })).id;
      } catch (err) {
        if (!wasToastedByApi(err)) toast.error(`Couldn't track ${title}: ${messageOf(err)}`);
        return;
      }
      onCreated(goalId);
      toast.success(`Tracking ${title}`);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center">
      <ActionButton busy={busy} onPress={() => void create()} leftIcon={<Plus className="h-3.5 w-3.5" aria-hidden />}>
        {`Track "${title}" as a custom farm`}
      </ActionButton>
    </div>
  );
}
