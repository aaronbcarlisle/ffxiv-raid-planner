/**
 * RecipientPicker — the unified gear-drop assign/log modal (F6d, spec §5.3).
 *
 * Consolidates QuickLogDropModal + AddLootEntryModal (spec §2.2) into ONE surface
 * that submits through the SAME `logLootAndUpdateGear` coordination util with the
 * same payload shape — payload parity with the two legacy modals is the
 * correctness contract. `mode="assign"` fixes the drop context (from `item`);
 * `mode="log"` exposes fight + slot selectors so any drop can be logged. Edit
 * mode is PR2 (additive).
 *
 * Ranking + visibility come from `buildRecipientEntries` (utils/recipientRanking),
 * which uses the configurable enhanced scoring everywhere — see that file for the
 * v1↔v2 note. Row interactivity uses the GearBoardCell radio pattern
 * (role="radio" + aria-checked + keyboard) so it passes check:design-system:strict
 * with no raw <input>/<label> and no suppressions.
 *
 * Phase D (D2, R-24/R-12): the method choice (drop/book/tome/purchase) and notes
 * field are available in every mode, including assign — a NEW capability, not a
 * restore (no legacy modal ever offered tome/purchase). The acquired checkbox is
 * promoted out of the disclosure into the modal body so gear-sync state is always
 * visible; the disclosure itself is relabelled `Options`/`Hide options`. Submit
 * payloads are unchanged except the R-24 notes ternary (user note wins, weapon
 * auto-note fallback) — `lootCoordination.ts` already gates gear/weapon-priority
 * sync on method === 'drop' | 'book', so the checkbox mirrors that gate via
 * `gearSyncEligible` instead of duplicating it at submit time. PR #225 review:
 * in edit mode `gearSyncEligible` reads the ORIGINAL entry's method AND isExtra
 * (lootCoordination.ts:186 gates sync on both) rather than the picker's live
 * method field — the checkbox is uniform across all three modes now, with a
 * caption naming whichever original-entry property actually blocks the sync.
 *
 * D2 (R-12/D-36): the static footer copy is replaced by a live "This will:"
 * consequence list — each line mirrors the exact predicate of the write it
 * names (lootCoordination.ts:78,:93-111,:124,:186-187) so the preview never
 * promises a side effect the coordination util would refuse. Edit mode's
 * diff is hoisted into `computeEditUpdates` — a single derivation shared by
 * the preview and `handleSubmit` so they cannot drift.
 *
 * Tasks 5-6 (R-6/R-4): every visible row renders `explainCandidate`'s reasons
 * + warnings (record cross-checks — already-received, weapon-priority
 * conflicts) via `RankingExplanation`, and the priority-scope list header
 * shows the derived confidence tag. Edit mode cross-checks the record
 * against `explanationLog` — the loot log MINUS the entry under edit — so a
 * row never warns about the very receipt it's editing. Assign mode also
 * accepts `initialRecipientId` (R-4): a matrix-cell click prefills the
 * recipient without bypassing the ranked list or its explanations.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Package } from 'lucide-react';
import { Modal, Select, Checkbox, NumberInput, RadioGroup, TextArea, Input, SegmentedToggle, Tag, LinkText } from '../ui';
import { Button } from '../primitives';
import { useStaticCharacterStore } from '../../stores/staticCharacterStore';
import { getPrimaryRegistration } from '../../utils/staticCharacterContextService';
import { logLootAndUpdateGear, updateLootAndSyncGear } from '../../utils/lootCoordination';
import { toast } from '../../stores/toastStore';
import { isPriorityDisabled } from '../../utils/priority';
import { buildRecipientEntries, type PickerScope, type NeedTag } from '../../utils/recipientRanking';
import { explainCandidate, deriveRankingConfidence, type RankingConfidence } from '../../utils/rankingExplanation';
import { RankingExplanation } from './RankingExplanation';
import { FLOOR_LOOT_TABLES, type FloorNumber } from '../../gamedata/loot-tables';
import { GEAR_SLOT_NAMES } from '../../types';
import type { SnapshotPlayer, StaticSettings, LootLogEntry, LootLogEntryUpdate, LootMethod, GearSlot } from '../../types';

export interface DropItemContext {
  slot: GearSlot | 'ring';
  floorName: string;
  floorNumber: FloorNumber;
  label: string;
}

interface RecipientPickerBaseProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  tierId: string;
  players: SnapshotPlayer[];
  settings: StaticSettings;
  floors: string[];
  lootLog: LootLogEntry[];
  currentWeek: number;
  maxWeek: number;
  onSuccess?: () => void;
}

// Discriminated on `mode` so `mode: 'assign'` REQUIRES `item` at every call
// site (PR review finding: an optional `item` under 'assign' invited
// call sites that fixed a drop context implicitly to nothing/`weapon`).
export type RecipientPickerProps = RecipientPickerBaseProps & (
  | {
      mode: 'assign';
      item: DropItemContext;
      editEntry?: never;
      /**
       * R-4 (D-22): pre-select this player on open — a matrix-cell click is a
       * shortcut into the normal flow, not a second flow. The ranked list
       * still renders and stays switchable. Unknown/unconfigured ids are
       * ignored.
       */
      initialRecipientId?: string;
    }
  | { mode: 'log'; item?: DropItemContext; editEntry?: never; initialRecipientId?: never }
  | { mode: 'edit'; editEntry: LootLogEntry; item?: never; initialRecipientId?: never }
);

const SCOPE_OPTIONS: { value: PickerScope; label: string }[] = [
  { value: 'priority', label: 'By priority' },
  { value: 'all', label: 'All members' },
  { value: 'offspec', label: 'Off-spec / free' },
];

const METHOD_OPTIONS: { value: LootMethod; label: string }[] = [
  { value: 'drop', label: 'Drop' },
  { value: 'book', label: 'Book' },
  { value: 'tome', label: 'Tome' },
  { value: 'purchase', label: 'Purchase' },
];

const TAG_TONE: Record<NeedTag, 'success' | 'muted'> = {
  bis: 'success',
  minor: 'muted',
  free: 'muted',
};
const TAG_LABEL: Record<NeedTag, string> = { bis: 'BiS', minor: 'minor', free: 'free' };

// R-6: the frozen v1 leaf's high/medium/low tone mapping carries over via Tag.
const CONFIDENCE_TONE: Record<RankingConfidence, 'success' | 'accent' | 'warning'> = {
  high: 'success', medium: 'accent', low: 'warning',
};
const CONFIDENCE_LABEL: Record<RankingConfidence, string> = {
  high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence',
};

function slotToLabel(slot: GearSlot | 'ring'): string {
  return slot === 'ring' ? 'Ring' : GEAR_SLOT_NAMES[slot];
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function firstSlotForFloor(floorNumber: FloorNumber): GearSlot | 'ring' {
  const first = FLOOR_LOOT_TABLES[floorNumber].gearDrops[0];
  return first === 'ring1' ? 'ring' : first;
}

// The ONE edit-diff derivation — handleSubmit submits exactly this object and
// the "This will:" preview renders exactly this object, so they cannot drift.
function computeEditUpdates(args: {
  editEntry: LootLogEntry;
  slot: GearSlot | 'ring';
  floorName: string;
  week: number;
  method: LootMethod;
  notes: string;
  recipientPlayerId: string;
  recipientJob: string | undefined;
}): LootLogEntryUpdate {
  const { editEntry, slot, floorName, week, method, notes, recipientPlayerId, recipientJob } = args;
  // Ring round-trip: an untouched ring slot keeps the entry's concrete
  // ring1/ring2 (the picker vocabulary collapses to 'ring' which would
  // otherwise rewrite ring2 → ring1). This does NOT fully round-trip a
  // legacy `itemSlot: 'ring'` entry (LootSlot includes 'ring' alongside
  // ring1/ring2) — the ternary below normalizes it to 'ring1' even when
  // untouched, so `itemSlot !== editEntry.itemSlot` reads as a change and
  // emits `updates.itemSlot`. Known phantom-diff case, disclosed in the D2
  // PR body — not fixed here.
  const itemSlot = slot === 'ring'
    ? (editEntry.itemSlot === 'ring2' ? 'ring2' : 'ring1')
    : slot;
  const updates: LootLogEntryUpdate = {};
  if (week !== editEntry.weekNumber) updates.weekNumber = week;
  if (floorName !== editEntry.floor) updates.floor = floorName;
  if (itemSlot !== editEntry.itemSlot) updates.itemSlot = itemSlot;
  if (recipientPlayerId !== editEntry.recipientPlayerId) updates.recipientPlayerId = recipientPlayerId;
  if (method !== editEntry.method) updates.method = method;
  if (notes !== (editEntry.notes ?? '')) updates.notes = notes || undefined;
  // Backfill weaponJob for weapon entries created without it.
  if (itemSlot === 'weapon' && !editEntry.weaponJob && recipientJob) {
    updates.weaponJob = recipientJob;
  }
  return updates;
}

export function RecipientPicker({
  isOpen,
  onClose,
  mode,
  groupId,
  tierId,
  players,
  settings,
  floors,
  item,
  editEntry,
  initialRecipientId,
  lootLog,
  currentWeek,
  maxWeek,
  onSuccess,
}: RecipientPickerProps) {
  const [scope, setScope] = useState<PickerScope>('priority');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [week, setWeek] = useState(currentWeek);
  // Typed LootMethod (drop/book/tome/purchase) — originally widened from
  // 'drop' | 'book' so edit mode could round-trip a 'purchase'/'tome' entry's
  // method verbatim without diffing it (legacy AddLootEntryModal.tsx:382
  // parity). As of R-24 the RadioGroup offers all four methods everywhere,
  // including assign/log create paths — not just edit round-tripping.
  const [method, setMethod] = useState<LootMethod>('drop');
  const [updateGear, setUpdateGear] = useState(true);
  const [isExtra, setIsExtra] = useState(false);
  const [notes, setNotes] = useState('');
  const [characterRegId, setCharacterRegId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDetails, setShowDetails] = useState(mode !== 'assign');

  // Log-mode item selectors (parity with AddLootEntryModal).
  const [logFloorName, setLogFloorName] = useState(floors[0] ?? '');
  const [logSlot, setLogSlot] = useState<GearSlot | 'ring'>(firstSlotForFloor(1));

  // Subscribe to just this slice — destructuring the whole store churns the
  // reference on unrelated updates, which could reset an in-progress pick.
  const registrationsByGroup = useStaticCharacterStore((s) => s.registrationsByGroup);
  const registrationsByPlayer = useMemo(
    () => registrationsByGroup[groupId] ?? {},
    [registrationsByGroup, groupId],
  );

  // Effective drop context: fixed from `item` in assign mode, driven by the
  // fight/slot selectors in log AND edit mode (the legacy editor diffs
  // floor/slot, so they must be editable — AddLootEntryModal.tsx:379-380).
  const slot: GearSlot | 'ring' = mode !== 'assign' ? logSlot : (item?.slot ?? 'weapon');
  const floorName = mode !== 'assign' ? logFloorName : (item?.floorName ?? '');
  const floorNumber: FloorNumber = mode !== 'assign'
    ? (Math.max(0, floors.indexOf(logFloorName)) + 1) as FloorNumber
    : (item?.floorNumber ?? 1);
  const label = mode !== 'assign' ? slotToLabel(slot) : (item?.label ?? slotToLabel(slot));
  const isWeapon = slot === 'weapon';

  const enhancedActive = settings.enableEnhancedScoring === true && !isPriorityDisabled(settings);

  const entries = useMemo(
    () => buildRecipientEntries({ players, slot, scope, settings, lootLog, currentWeek, enhancedActive }),
    [players, slot, scope, settings, lootLog, currentWeek, enhancedActive],
  );

  // Needers for the CURRENT slot regardless of the scope toggle — D-36's hint
  // reads the priority pool even while the user is browsing All members.
  const needers = useMemo(
    () => buildRecipientEntries({ players, slot, scope: 'priority', settings, lootLog, currentWeek, enhancedActive }),
    [players, slot, settings, lootLog, currentWeek, enhancedActive],
  );

  // D-36 hint gate: `needers` is priority scope, which excludes substitutes
  // (recipientRanking.ts's mainRoster filter) — so when ONLY a substitute
  // needs the slot, `needers` is empty even though the All-members fallback
  // (A11, below) lands the picker on a scope where that sub renders "…is
  // BiS" at rank #1. Require BOTH the priority pool being empty AND no
  // currently-VISIBLE row (`entries`, which follows the active scope)
  // claiming need, so the footer can never contradict a row on screen.
  const noOneNeeds = needers.length === 0 && !entries.some((e) => e.needsItem);

  // In edit mode the log contains the entry being edited — explaining a
  // ranking against it would warn about the very receipt under edit and sink
  // the confidence header on every routine edit. Cross-check the record
  // MINUS the entry being edited.
  const explanationLog = useMemo(
    () => (mode === 'edit' ? lootLog.filter((e) => e.id !== editEntry.id) : lootLog),
    [mode, lootLog, editEntry],
  );

  // R-6: one explanation per visible row (reasons + record-cross-check
  // warnings), plus the priority-ranking confidence read derived from the
  // NEEDERS pool (not `entries`/`filtered` — confidence answers "how sure is
  // the ranking", which is a priority-scope question regardless of which
  // scope the user is currently browsing).
  const explanations = useMemo(
    () => new Map(entries.map((e) => [e.player.id, explainCandidate(e, slot, { lootLog: explanationLog })])),
    [entries, slot, explanationLog],
  );
  const confidence = useMemo(
    () => deriveRankingConfidence(needers.map((e) => explainCandidate(e, slot, { lootLog: explanationLog }))),
    [needers, slot, explanationLog],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? entries.filter((e) => e.player.name.toLowerCase().includes(q)) : entries;
  }, [entries, search]);

  // Selection: `selectedId` is PINNED into state at open (below) — parity with
  // QuickLogDropModal.tsx:106 materialising the suggested player — so a mid-open
  // store churn (30s roster poll) reordering `entries` can't silently retarget
  // an untouched pick. The derived fallback to `entries[0]` is a safety net for
  // scope switches that drop the pinned player from the visible pool — but ONLY
  // in assign/log mode, where `entries[0]` is a freshly-suggested default, not
  // an existing commitment. In EDIT mode the pinned selection is the entry's
  // CURRENT recipient: silently falling back to `entries[0]` on a scope flip
  // that drops them from the recomputed list (e.g. flipping to 'priority' when
  // they already hold the item) would retarget the entry to the top-ranked
  // player with no user action. So edit mode suppresses the fallback — `selected`
  // goes `null`, and `selectionVisible` below (which requires `selected` to be
  // one of the currently-listed entries) then disables submit until the user
  // explicitly re-picks a visible recipient.
  const selected = mode === 'edit'
    ? (entries.find((e) => e.player.id === selectedId) ?? null)
    : (entries.find((e) => e.player.id === selectedId) ?? entries[0] ?? null);
  const recipientId = selected?.player.id;

  // `selected` derives from the UNFILTERED `entries` — when the search text
  // hides the selected row, no row visibly shows selected but submit would
  // otherwise stay enabled, targeting a recipient the user can no longer see.
  // Gate submit on the pick actually being visible in `filtered`.
  const selectionVisible = filtered.some((e) => e.player.id === selected?.player.id);

  // Forced-extra under off-spec: single source of truth used by the payload,
  // the weapon auto-note, AND the (disabled) checkbox state.
  const effectiveExtra = scope === 'offspec' ? true : isExtra;

  // Gear/weapon-priority sync applies only to drop/book — mirrors the
  // coordination gates (lootCoordination.ts:78,:124) so the checkbox can't
  // promise a write the util refuses. In EDIT mode the util gates sync on
  // the ORIGINAL entry's method AND isExtra (lootCoordination.ts:186 —
  // `originalEntry.method === 'drop' || 'book'` AND `!originalEntry.isExtra`),
  // not the picker's live (possibly still-being-changed) method field, so a
  // refused sync must read `editEntry` here rather than `method`/`effectiveExtra`.
  const gearSyncEligible = mode === 'edit'
    ? (editEntry.method === 'drop' || editEntry.method === 'book') && !editEntry.isExtra
    : method === 'drop' || method === 'book';

  // Initialise state ONLY on the open transition (closed → open) — mirrors
  // QuickLogDropModal.tsx:97-115. Keying off a ref (not raw isOpen) means a
  // mid-interaction store churn (e.g. the 30s roster poll) can't re-run this and
  // silently revert the recipient pick.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      setSearch('');
      if (mode === 'edit') {
        // Prefill from the entry. Scope 'all' so the recipient is selectable
        // even when they no longer "need" the slot — mirrors the legacy editor's
        // ensureId visibility guarantee (AddLootEntryModal.tsx:279).
        setScope('all');
        setSelectedId(editEntry.recipientPlayerId);
        setWeek(editEntry.weekNumber);
        setMethod(editEntry.method);
        setUpdateGear(true);
        setIsExtra(false);
        setNotes(editEntry.notes ?? '');
        setCharacterRegId(editEntry.recipientCharacterRegistrationId ?? null);
        setShowDetails(true);
        // Seed the item selectors from the entry; a concrete ring1/ring2
        // collapses to the picker's 'ring' vocabulary (round-trip handled at submit).
        setLogFloorName(editEntry.floor);
        setLogSlot(
          editEntry.itemSlot === 'ring1' || editEntry.itemSlot === 'ring2'
            ? 'ring'
            : (editEntry.itemSlot as GearSlot),
        );
      } else {
        // Pin the default recipient: top of the initial priority ranking for the
        // opening drop context. A11: when NOBODY needs the slot the priority
        // pool is empty — opening on it would render "No players match." with
        // submit permanently disabled until the user discovers the All-members
        // toggle. Fall back to 'all' scope instead (guaranteed non-empty while
        // any player is configured — recipientRanking.ts appends the
        // needers-then-rest list) with its first entry pre-selected. Shared by
        // assign AND log mode; the user can re-toggle scopes freely after open.
        const initialSlot: GearSlot | 'ring' = mode === 'log' ? firstSlotForFloor(1) : (item?.slot ?? 'weapon');
        const priorityEntries = buildRecipientEntries({
          players, slot: initialSlot, scope: 'priority', settings, lootLog, currentWeek, enhancedActive,
        });
        const initialScope: PickerScope = priorityEntries.length > 0 ? 'priority' : 'all';
        const initialEntries = priorityEntries.length > 0
          ? priorityEntries
          : buildRecipientEntries({
              players, slot: initialSlot, scope: 'all', settings, lootLog, currentWeek, enhancedActive,
            });
        const prefill = initialRecipientId
          ? players.find((p) => p.id === initialRecipientId && p.configured)
          : undefined;
        if (prefill) {
          // Visibility guarantee (mirrors the edit branch above): a prefilled
          // player outside the priority pool is only selectable under 'all'.
          const inPriority = priorityEntries.some((e) => e.player.id === prefill.id);
          setScope(inPriority ? 'priority' : 'all');
          setSelectedId(prefill.id);
        } else {
          setScope(initialScope);
          setSelectedId(initialEntries[0]?.player.id ?? null);
        }
        setWeek(currentWeek);
        setMethod('drop');
        setUpdateGear(true);
        setIsExtra(false);
        setNotes('');
        setCharacterRegId(null);
        setShowDetails(mode === 'log');
        if (mode === 'log') {
          const f = floors[0] ?? '';
          setLogFloorName(f);
          setLogSlot(firstSlotForFloor(1));
        }
      }
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen, currentWeek, mode, floors, item, editEntry, initialRecipientId, players, settings, lootLog, enhancedActive]);

  // Auto-select the recipient's primary character registration on recipient
  // change (mirrors QuickLogDropModal.tsx:117-121).
  useEffect(() => {
    if (!recipientId) return;
    const primary = getPrimaryRegistration(registrationsByPlayer[recipientId] ?? []);
    setCharacterRegId(primary?.id ?? null);
  }, [recipientId, registrationsByPlayer]);

  const handleFloorChange = (name: string) => {
    setLogFloorName(name);
    const fn = (Math.max(0, floors.indexOf(name)) + 1) as FloorNumber;
    setLogSlot(firstSlotForFloor(fn));
  };

  const recipientRegistrations = recipientId ? (registrationsByPlayer[recipientId] ?? []) : [];

  // Live consequences — each line mirrors the exact predicate of the write it
  // names (lootCoordination.ts:78,:93-111,:124,:186-187); stating a side effect
  // the util would refuse is the bug R-12 exists to prevent.
  const consequences = useMemo<string[]>(() => {
    if (!selected) return [];
    const name = selected.player.name;
    if (mode === 'edit') {
      const updates = computeEditUpdates({
        editEntry, slot, floorName, week, method, notes,
        recipientPlayerId: selected.player.id, recipientJob: selected.player.job,
      });
      const out: string[] = [];
      if (updates.weekNumber !== undefined) out.push(`Move it to Week ${updates.weekNumber}`);
      if (updates.floor !== undefined || updates.itemSlot !== undefined) out.push(`Change the item to ${floorName} · ${label}`);
      if (updates.recipientPlayerId !== undefined) out.push(`Reassign it to ${name}`);
      if (updates.method !== undefined) out.push(`Set the method to ${method}`);
      // `updates.notes` carries `undefined` as a *cleared* value (see
      // computeEditUpdates: `updates.notes = notes || undefined`) — a
      // cleared-to-empty note still has the `notes` key set but with an
      // undefined value, so check key PRESENCE, not the value, or a clear
      // silently reports "No changes yet." while submit still writes it.
      if ('notes' in updates) out.push('Update the notes');
      if (updates.weaponJob !== undefined) out.push(`Record it as a ${updates.weaponJob} weapon`);
      // Mirrors lootCoordination.ts:186-187,:194-195 — the picker never diffs
      // isExtra, so the extra-transition clause reduces to !editEntry.isExtra.
      // `gearSyncEligible` already encodes exactly that original-entry check
      // (see its definition) — reused here so the two can't drift apart.
      const syncFires = updateGear && gearSyncEligible
        && (updates.recipientPlayerId !== undefined || updates.itemSlot !== undefined);
      if (syncFires) out.push('Sync gear to match');
      return out;
    }
    const out = [`Log ${label} (${method}) for ${name} in Week ${week}`];
    // Mirrors lootCoordination.ts:78,:93-111 — the ring refinement (needs
    // ring1 or ring2) vs. the plain-slot bisSource check.
    const gearWillMark = slot === 'ring'
      ? selected.player.gear.some((g) =>
          (g.slot === 'ring1' || g.slot === 'ring2') && g.bisSource === 'raid' && !g.hasItem)
      : selected.player.gear.find((g) => g.slot === slot)?.bisSource === 'raid';
    if (updateGear && gearSyncEligible && !effectiveExtra && gearWillMark) {
      out.push(`Mark ${label} as acquired on ${name}'s gear`);
    }
    // lootCoordination.ts:123-145: the util fires (and PUTs) whenever the
    // recipient HAS a weaponPriorities array at all, matching row or not —
    // with no matching row for the target job, the call still goes out but
    // .map leaves every row unchanged, so nothing effectively changes. Our
    // `.some(w => w.job === ...)` gate is deliberately STRICTER than the
    // util's own guard: the preview promises effects, not API calls, so it
    // only claims the write when a row for the recipient's job actually
    // exists to be marked (targetJob resolves to recipient.job here since
    // the picker submits weaponJob = recipient?.job).
    if (isWeapon && gearSyncEligible
        && (selected.player.weaponPriorities ?? []).some((w) => w.job === selected.player.job)) {
      out.push(`Update ${name}'s weapon priority`);
    }
    if (effectiveExtra) out.push('Count it as extra loot (outside BiS priority)');
    return out;
  }, [selected, mode, editEntry, slot, week, floorName, label, method, notes, updateGear, gearSyncEligible, isWeapon, effectiveExtra]);

  const handleSubmit = async () => {
    if (!selected || !selectionVisible) return;
    const recipientPlayerId = selected.player.id;

    // Edit mode: diff via the shared `computeEditUpdates` derivation — the
    // SAME function the "This will:" preview renders, so submit can never
    // promise something the preview didn't (or vice versa). updates contains
    // ONLY changed fields among weekNumber/floor/itemSlot/recipientPlayerId/
    // method/notes, plus the weaponJob backfill. isExtra and
    // recipientCharacter* are NEVER diffed (legacy parity —
    // AddLootEntryModal.tsx:375-393).
    if (mode === 'edit') {
      setIsSaving(true);
      try {
        const recipient = players.find((p) => p.id === recipientPlayerId);
        const updates = computeEditUpdates({
          editEntry, slot, floorName, week, method, notes,
          recipientPlayerId, recipientJob: recipient?.job,
        });

        if (Object.keys(updates).length > 0) {
          await updateLootAndSyncGear(groupId, tierId, editEntry.id, editEntry, updates, { syncGear: updateGear });
          toast.success(`Updated ${label} for ${recipient?.name ?? 'player'}`);
          onSuccess?.();
        }
        onClose();
      } catch {
        toast.error('Failed to update drop');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    setIsSaving(true);
    try {
      const recipient = players.find((p) => p.id === recipientPlayerId);
      const weaponJob = isWeapon ? recipient?.job : undefined;
      const itemSlot = slot === 'ring' ? 'ring1' : slot;

      const selectedReg = characterRegId
        ? recipientRegistrations.find((r) => r.id === characterRegId)
        : undefined;
      const charName = selectedReg
        ? (selectedReg.resolvedName ?? selectedReg.manualCharacterName ?? undefined)
        : undefined;

      await logLootAndUpdateGear(
        groupId,
        tierId,
        {
          weekNumber: week,
          floor: floorName,
          itemSlot,
          recipientPlayerId,
          method,
          weaponJob,
          isExtra: effectiveExtra,
          // Log mode: plain user note, no auto-note (unchanged). Assign mode:
          // R-24 exposed the notes field there too, so a typed note must
          // reach the payload — user note wins; the weapon auto-note is only a
          // FALLBACK for an untouched field (preserves the legacy auto-note
          // behavior when nobody typed anything).
          notes: mode === 'log'
            ? (notes || undefined)
            : (notes || (isWeapon && weaponJob ? `${weaponJob} weapon${effectiveExtra ? ' (extra)' : ''}` : undefined)),
          recipientCharacterRegistrationId: characterRegId ?? undefined,
          recipientCharacterName: charName,
        },
        { updateGear, updateWeaponPriority: isWeapon, weaponJob },
      );

      toast.success(`Logged ${label} for ${recipient?.name ?? 'player'}`);
      onSuccess?.();
      onClose();
    } catch {
      toast.error('Failed to log drop');
    } finally {
      setIsSaving(false);
    }
  };

  const listLabel = scope === 'priority'
    ? 'Eligible · ranked by need + council rules'
    : scope === 'all' ? 'All members' : 'Off-spec / free';

  const slotOptions = FLOOR_LOOT_TABLES[floorNumber].gearDrops.map((s) => (
    s === 'ring1' ? { value: 'ring', label: 'Ring' } : { value: s, label: GEAR_SLOT_NAMES[s] }
  ));

  const title = (
    <span className="flex items-center gap-2">
      <Package className="h-5 w-5" />
      {mode === 'assign' ? `Assign · ${label}` : mode === 'edit' ? `Edit · ${label}` : 'Log a drop'}
    </span>
  );

  const buttonLabel = mode === 'edit'
    ? 'Save changes'
    : mode === 'log'
      ? 'Log drop'
      : (selected ? `Assign to ${selected.player.name}` : 'Assign');

  const footer = (
    <div className="space-y-3">
      {/* D-36: nobody in the priority pool needs this slot — reassure the
          user the assignment is still fine, just off the BiS path. Create
          modes only; edit mode is reassigning an existing drop, not rolling
          a fresh one. noOneNeeds also requires no VISIBLE row claiming need
          (see its definition) so the hint can't contradict a sub-needer the
          All-members fallback just surfaced at rank #1. */}
      {mode !== 'edit' && noOneNeeds && (
        <p className="text-xs text-status-success">
          No one needs this item for BiS — assigning it counts as a free roll.
        </p>
      )}
      {selected && (
        <div className="text-xs text-text-tertiary">
          <span className="font-semibold text-text-secondary">This will:</span>
          {mode === 'edit' && consequences.length === 0 ? (
            <span className="ml-1">No changes yet.</span>
          ) : (
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {consequences.map((c) => <li key={c}>{c}</li>)}
            </ul>
          )}
        </div>
      )}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!selected || !selectionVisible || isSaving}
          loading={isSaving}
        >
          {buttonLabel}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg" footer={footer}>
      <div className="space-y-4">
        {/* Context line */}
        <p className="text-xs text-text-tertiary">
          {floorName} Floor {floorNumber} · {label} slot · raid drop
        </p>

        {/* Item selectors — editable in log AND edit mode */}
        {mode !== 'assign' && (
          <div className="grid grid-cols-2 gap-3">
            <Select
              aria-label="Fight"
              value={logFloorName}
              onChange={handleFloorChange}
              options={floors.map((f) => ({ value: f, label: f }))}
            />
            <Select
              aria-label="Slot"
              value={slot}
              onChange={(v) => setLogSlot(v as GearSlot | 'ring')}
              options={slotOptions}
            />
          </div>
        )}

        {/* Scope */}
        <SegmentedToggle
          ariaLabel="Recipient scope"
          size="sm"
          value={scope}
          onChange={setScope}
          options={SCOPE_OPTIONS}
        />

        {/* Search */}
        <Input
          value={search}
          onChange={setSearch}
          placeholder="Search players…"
          fullWidth
          size="sm"
        />

        {/* List */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-text-tertiary">{listLabel}</span>
          {scope === 'priority' && (
            <Tag variant="label" tone={CONFIDENCE_TONE[confidence]}>{CONFIDENCE_LABEL[confidence]}</Tag>
          )}
        </div>
        <div role="radiogroup" aria-label="Recipient" className="space-y-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-text-muted">No players match.</p>
          ) : (
            filtered.map((entry) => {
              const isSel = entry.player.id === selected?.player.id;
              const role = entry.player.role;
              const select = () => setSelectedId(entry.player.id);
              return (
                <div
                  key={entry.player.id}
                  role="radio"
                  aria-checked={isSel}
                  // Every row is tabbable (GearBoardCell-faithful): a roving
                  // tabindex without arrow-key movement would strand keyboard
                  // users on the default pick — and leave ZERO tabbable rows
                  // when search filters out the selected one.
                  tabIndex={0}
                  onClick={select}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      select();
                    }
                  }}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2 transition-colors ${
                    isSel ? 'border-accent bg-accent/10' : 'border-border-subtle hover:border-border-default'
                  }`}
                >
                  {entry.rank !== null && (
                    <span
                      className={`w-6 flex-none text-center font-display text-sm font-extrabold ${
                        entry.rank <= 2 ? 'text-accent' : 'text-text-muted'
                      }`}
                    >
                      #{entry.rank}
                    </span>
                  )}
                  <span
                    aria-hidden
                    /* Role color is a border ring (not a fill) — mirrors ui/PlayerIdentity's fallback-avatar
                       treatment. A filled circle + white text fails AA for several role colors
                       (e.g. healer/ranged/caster); see PriorityRow.tsx's identical fix. */
                    className="grid h-[30px] w-[30px] flex-none place-items-center rounded-full border-2 bg-surface-interactive text-xs font-bold text-text-secondary"
                    style={{ borderColor: `var(--color-role-${role}, var(--color-text-muted))` }}
                  >
                    {initials(entry.player.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-text-primary">{entry.player.name}</span>
                      <span
                        aria-hidden
                        className="h-2 w-2 flex-none rounded-full"
                        style={{ backgroundColor: `var(--color-role-${role}, var(--color-text-muted))` }}
                      />
                    </span>
                    <RankingExplanation
                      showWarnings
                      explanation={explanations.get(entry.player.id) ?? { reasons: [entry.reason], warnings: [], wouldAdvanceBis: entry.needsItem }}
                    />
                  </span>
                  <Tag variant="label" tone={TAG_TONE[entry.needTag]}>{TAG_LABEL[entry.needTag]}</Tag>
                  <span
                    aria-hidden
                    className={`h-4 w-4 flex-none rounded-full border-2 ${
                      isSel ? 'border-accent bg-accent' : 'border-border-default'
                    }`}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Acquired checkbox — promoted out of the disclosure (R-12): gear-sync
            state should be visible without opening Options. Only drop/book
            can actually sync (lootCoordination.ts:78,:124); uniform across
            all three modes via `gearSyncEligible`, which in edit mode reads
            the ORIGINAL entry's method + isExtra (:186) rather than the
            picker's live fields — see its definition. The caption names
            whichever original-entry property is the true blocker: isExtra
            takes precedence when both apply, since it's the more specific
            reason (an extra-loot drop is still method-eligible). */}
        <div>
          <Checkbox
            checked={gearSyncEligible && updateGear}
            onChange={setUpdateGear}
            disabled={!gearSyncEligible}
            label={`Mark ${label} as acquired`}
          />
          {!gearSyncEligible && (
            <p className="mt-1 text-xs text-text-muted">
              {mode === 'edit' && editEntry.isExtra
                ? 'Extra loot never syncs gear.'
                : 'Gear sync applies to drops and books.'}
            </p>
          )}
        </div>

        {/* Options disclosure */}
        <LinkText onClick={() => setShowDetails((v) => !v)} aria-expanded={showDetails}>
          {showDetails ? 'Hide options' : 'Options'}
        </LinkText>

        {showDetails && (
          <div className="space-y-3 rounded-lg border border-border-subtle p-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-text-secondary">Week</span>
              <NumberInput
                value={week}
                onChange={(v) => setWeek(v ?? currentWeek)}
                min={1}
                max={maxWeek}
                size="sm"
              />
            </div>

            <RadioGroup
              name="loot-method"
              label="Method"
              orientation="horizontal"
              value={method}
              onChange={(v) => setMethod(v as LootMethod)}
              options={METHOD_OPTIONS}
            />

            {isWeapon && mode === 'assign' && (
              <Checkbox
                checked={effectiveExtra}
                onChange={setIsExtra}
                disabled={scope === 'offspec'}
                label="Extra loot (not BiS priority)"
              />
            )}

            {/* Create-only: edit-mode submit never diffs recipientCharacter* fields
                (legacy parity — AddLootEntryModal.tsx:570 gates this identically
                with `!isEditMode`). Rendering it in edit mode would let a user
                "change" a value that's silently dropped on save. */}
            {mode !== 'edit' && recipientRegistrations.length > 0 && (
              <div>
                <span className="mb-1 block text-sm text-text-secondary">Character</span>
                <Select
                  aria-label="Character"
                  value={characterRegId ?? ''}
                  onChange={(v) => setCharacterRegId(v || null)}
                  options={recipientRegistrations.map((r) => ({
                    value: r.id,
                    label: r.resolvedName ?? r.manualCharacterName ?? 'Character',
                  }))}
                />
              </div>
            )}

            <div>
              <span className="mb-1 block text-sm text-text-secondary">Notes</span>
              <TextArea value={notes} onChange={setNotes} placeholder="Optional notes…" rows={2} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
