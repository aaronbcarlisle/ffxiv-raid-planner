/**
 * Quick Log Material Modal
 *
 * Streamlined modal for quickly logging an upgrade material from the priority panel.
 * Pre-filled with material type, floor, and suggested player for one-click confirmation.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { Gem, Pencil } from 'lucide-react';
import { Modal, Select, Label, Checkbox, NumberInput, RadioGroup, Tag, TextArea, type Tone } from '../ui';
import { Button } from '../primitives';
import { JobIcon } from '../ui/JobIcon';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { toast } from '../../stores/toastStore';
import { getPriorityForUpgradeMaterial, getPriorityForUniversalTomestone, type PriorityEntry } from '../../utils/priority';
import {
  isSlotAugmentationMaterial,
  UPGRADE_MATERIAL_DISPLAY_NAMES,
  FLOOR_LOOT_TABLES,
  parseFloorName,
  getFloorForUpgradeMaterial,
  type FloorNumber,
} from '../../gamedata/loot-tables';
import { DEFAULT_SETTINGS } from '../../utils/constants';
import {
  getEligibleSlotsForAugmentation,
  needsTomeWeaponItem,
  needsTomeWeaponAugmentation,
  hasTomeWeaponItem,
  logMaterialAndUpdateGear,
  updateMaterialAndReconcileGear,
  type UpdateMaterialOptions,
} from '../../utils/materialCoordination';
import type { SnapshotPlayer, MaterialType, StaticSettings, GearSlot, LootMethod, MaterialLogEntry } from '../../types';
import { GEAR_SLOT_NAMES } from '../../types';

interface QuickLogMaterialModalBaseProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  tierId: string;
  /** Upper bound for the week input. */
  maxWeek: number;
  allPlayers: SnapshotPlayer[];
  settings?: StaticSettings;
  onSuccess?: () => void;
}

export type QuickLogMaterialModalProps = QuickLogMaterialModalBaseProps & (
  | {
      /** Pinned — V1's exact contract (LootPriorityPanel.tsx:770) and v2's matrix-cell door. */
      floor: string;
      material: MaterialType;
      suggestedPlayer: SnapshotPlayer;
      /** D8, v2-only: show the notes field. V1 never passes it → render unchanged. */
      showNotes?: boolean;
      /** D8, v2-only: initial week (R-20 coherence; D5's Log cells need it on this door).
       *  Absent → maxWeek, exactly the pre-D8 default — V1 never passes it. */
      initialWeek?: number;
      floors?: never; editEntry?: never;
    }
  | {
      /** Free-form — R-26/R-20: floor + material selectors; the Log toolbar's door. */
      floors: string[];
      /** R-20: the write targets the displayed week (Loot's `writeWeek`). Required — explicit. */
      initialWeek: number;
      floor?: never; material?: never; suggestedPlayer?: never; showNotes?: never; editEntry?: never;
    }
  | {
      /** Edit — R-21. Selectors + notes render; submit reconciles old-vs-new. */
      floors: string[];
      editEntry: MaterialLogEntry;
      /** No initialWeek: the week comes from the entry. */
      floor?: never; material?: never; suggestedPlayer?: never; showNotes?: never; initialWeek?: never;
    }
);

type ModalMode = 'pinned' | 'freeform' | 'edit';

/** One place that answers: given this player and material, what does the gear
 *  checkbox pre-select? (Was triplicated pre-D8; edit mode would have made four.) */
function initialGearSelection(
  player: SnapshotPlayer | undefined,
  material: MaterialType,
): { slot: GearSlot | null; augmentTome: boolean } {
  if (!player || material === 'universal_tomestone') return { slot: null, augmentTome: false };
  const slots = getEligibleSlotsForAugmentation(player, material);
  if (slots.length > 0) return { slot: slots[0], augmentTome: false };
  if (material === 'solvent' && needsTomeWeaponAugmentation(player)) return { slot: null, augmentTome: true };
  return { slot: null, augmentTome: false };
}

// R-26 free-form selectors: only the floors that actually drop an upgrade material.
const MATERIAL_FLOORS = ([1, 2, 3, 4] as FloorNumber[])
  .filter((n) => FLOOR_LOOT_TABLES[n].upgradeMaterials.length > 0); // [2, 3] today

function materialsForFloorNumber(n: FloorNumber): MaterialType[] {
  return FLOOR_LOOT_TABLES[n].upgradeMaterials as MaterialType[];
}

const MATERIAL_TONE = {
  twine: 'material-twine', glaze: 'material-glaze',
  solvent: 'material-solvent', universal_tomestone: 'material-tomestone',
} as const satisfies Record<MaterialType, Tone>;

// Free-form's default floor/material — computed once (module scope) so both the mount-time
// lazy initializer and the reset-on-open effect agree without repeating the fallback chain.
const DEFAULT_FREEFORM_FLOOR: FloorNumber = MATERIAL_FLOORS[0] ?? 2;
const DEFAULT_FREEFORM_MATERIAL: MaterialType = materialsForFloorNumber(DEFAULT_FREEFORM_FLOOR)[0] ?? 'twine';

type RankedRecipient = { player: SnapshotPlayer; priority: number; needsMaterial: boolean };

/** Ranks eligible players by priority for `material` (needer-first by rank, then
 *  alphabetical). Shared by the mount-time lazy seed for `recipientPlayerId` (fix round 1,
 *  item 4 — computing the initial pick synchronously so the very first render already
 *  carries a real recipient, leaving the auto-recipient effect below nothing to *transition*
 *  into on mount, which is what fed the pinned Radix Select race) and the `sortedRecipients`
 *  memo it mirrors. */
function rankRecipients(
  eligiblePlayers: SnapshotPlayer[],
  material: MaterialType,
  settings: StaticSettings,
  materialLog: MaterialLogEntry[] | undefined,
): RankedRecipient[] {
  const priorityEntries: PriorityEntry[] = isSlotAugmentationMaterial(material)
    ? getPriorityForUpgradeMaterial(eligiblePlayers, material, settings, materialLog)
    : getPriorityForUniversalTomestone(eligiblePlayers, settings, materialLog);
  const priorityMap = new Map(priorityEntries.map((e, i) => [e.player.id, { rank: i + 1, score: e.score }]));
  return eligiblePlayers
    .map((player) => {
      const priority = priorityMap.get(player.id);
      return { player, priority: priority?.rank ?? 999, needsMaterial: !!priority };
    })
    .sort((a, b) => {
      if (a.needsMaterial && !b.needsMaterial) return -1;
      if (!a.needsMaterial && b.needsMaterial) return 1;
      if (a.needsMaterial && b.needsMaterial) return a.priority - b.priority;
      return a.player.name.localeCompare(b.player.name);
    });
}

// ==================== Edit mode (R-21) ====================

/** Edit mode: the entry's own slot stays offered even though it is currently augmented. */
function withOriginalSlot(slots: GearSlot[], original: MaterialLogEntry['slotAugmented']): GearSlot[] {
  if (!original || original === 'tome_weapon' || slots.includes(original)) return slots;
  return [original, ...slots];
}

/** Edit mode's gear-init (open-reset + mount lazy seed): mirrors the legacy edit precedent
 *  (`LogMaterialModal.tsx:220-248`) for which checkbox/slot the entry pre-selects, but falls
 *  back to this file's own `initialGearSelection` (slots-first order) rather than replaying
 *  legacy's differently-ordered heuristic when the entry didn't record a slot. */
function editGearSelection(
  materialType: MaterialType,
  slotAugmented: MaterialLogEntry['slotAugmented'],
  recipient: SnapshotPlayer | undefined,
): { slot: GearSlot | null; augmentTome: boolean; updateGear: boolean } {
  if (slotAugmented === 'tome_weapon') {
    return { slot: null, augmentTome: true, updateGear: true };
  }
  if (slotAugmented) {
    return { slot: slotAugmented, augmentTome: false, updateGear: true };
  }
  if (materialType === 'universal_tomestone') {
    return { slot: null, augmentTome: false, updateGear: recipient ? hasTomeWeaponItem(recipient) : false };
  }
  return { ...initialGearSelection(recipient, materialType), updateGear: false };
}

/** The gear consequence a preview line describes — a display-only mirror of
 *  `materialCoordination.ts`'s (unexported) `GearEffect`; the actual revert/apply semantics
 *  live there (Task 5), this just narrates them before submit. */
type PreviewEffect = { kind: 'tome_item' } | { kind: 'tome_aug' } | { kind: 'slot'; slot: GearSlot } | null;

function previewEffectFromEntry(entry: MaterialLogEntry): PreviewEffect {
  if (entry.materialType === 'universal_tomestone') return { kind: 'tome_item' };
  if (entry.slotAugmented === 'tome_weapon') return { kind: 'tome_aug' };
  if (entry.slotAugmented) return { kind: 'slot', slot: entry.slotAugmented };
  return null;
}

function previewEffectFromForm(
  materialType: MaterialType,
  shouldUpdateGear: boolean,
  augmentTome: boolean,
  slot: GearSlot | null,
): PreviewEffect {
  if (!shouldUpdateGear) return null;
  if (materialType === 'universal_tomestone') return { kind: 'tome_item' };
  if (materialType === 'solvent' && augmentTome) return { kind: 'tome_aug' };
  if (slot) return { kind: 'slot', slot };
  return null;
}

function previewEffectsEqual(a: PreviewEffect, b: PreviewEffect): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'slot' && b.kind === 'slot') return a.slot === b.slot;
  return true;
}

function previewEffectDisplay(effect: PreviewEffect): { noun: string; verb: string } | null {
  if (!effect) return null;
  if (effect.kind === 'tome_item') return { noun: 'tome weapon', verb: 'obtained' };
  if (effect.kind === 'tome_aug') return { noun: 'tome weapon', verb: 'augmented' };
  return { noun: GEAR_SLOT_NAMES[effect.slot], verb: 'augmented' };
}

/** Edit-mode preview lines: states the old-vs-new reconciliation `updateMaterialAndReconcileGear`
 *  (Task 5) will perform on submit, including the non-move consequence of a recipient change
 *  (the old recipient's gear is deliberately left untouched — legacy ruling
 *  `LogMaterialModal.tsx:366-368` — so the preview says they keep it). */
function editReconciliationLines(
  oldEntry: MaterialLogEntry,
  newMaterial: MaterialType,
  newRecipientId: string,
  shouldUpdateGear: boolean,
  augmentTome: boolean,
  slot: GearSlot | null,
): string[] {
  const oldEffect = previewEffectFromEntry(oldEntry);
  const newEffect = previewEffectFromForm(newMaterial, shouldUpdateGear, augmentTome, slot);
  const oldDisplay = previewEffectDisplay(oldEffect);
  const newDisplay = previewEffectDisplay(newEffect);
  const recipientChanged = newRecipientId !== oldEntry.recipientPlayerId;
  const lines: string[] = [];

  if (!recipientChanged) {
    if (!previewEffectsEqual(oldEffect, newEffect)) {
      if (oldDisplay) lines.push(`− Un-mark ${oldDisplay.noun} as ${oldDisplay.verb}`);
      if (newDisplay) lines.push(`+ Mark ${newDisplay.noun} as ${newDisplay.verb}`);
    }
  } else {
    if (newDisplay) lines.push(`+ Mark ${newDisplay.noun} as ${newDisplay.verb}`);
    // "marked as {verb}" reads correctly for both effect families — "Head marked as
    // augmented" and "tome weapon marked as obtained" (PR #236 review; closes §5's F-5(c)).
    if (oldDisplay) lines.push(`· ${oldEntry.recipientPlayerName} keeps their ${oldDisplay.noun} marked as ${oldDisplay.verb}`);
  }

  return lines;
}

export function QuickLogMaterialModal(props: QuickLogMaterialModalProps) {
  const {
    isOpen,
    onClose,
    groupId,
    tierId,
    maxWeek,
    allPlayers,
    settings = DEFAULT_SETTINGS,
    onSuccess,
  } = props;
  // Pinned-only per the union (`suggestedPlayer` is `never` on the free-form branch) — every
  // dereference below only happens where `mode === 'pinned'` guarantees it's set. Free-form's
  // initial recipient instead comes from `recipientPlayerId`'s own lazy seed below, with the
  // auto-recipient effect (further down) handling subsequent re-ranks.
  const suggestedPlayer = props.suggestedPlayer;
  // Edit-only per the union (`never` on the pinned/free-form branches) — every dereference
  // below only happens where `mode === 'edit'` guarantees it's set.
  const editEntry = props.editEntry;

  const mode: ModalMode = props.editEntry ? 'edit' : props.floor != null ? 'pinned' : 'freeform';
  const [pickedFloorNumber, setPickedFloorNumber] = useState<FloorNumber>(DEFAULT_FREEFORM_FLOOR);
  const [pickedMaterial, setPickedMaterial] = useState<MaterialType>(DEFAULT_FREEFORM_MATERIAL);
  // `props.floors` is `string[] | undefined` in general (unnarrowed) union access; `?? []`
  // resolves it to `string[]` without needing a cast (only meaningful when mode !== 'pinned').
  const freeformFloors = props.floors ?? [];
  // `mode` classifies `props.floor`, but TS can't replay that discriminant check through the
  // `mode` alias (it's a computed classification, not a direct alias of the discriminant), so
  // `props.material`/`props.floor` stay widened to `T | undefined` here even though the union
  // guarantees exactly one side is set per `mode` — the casts assert what that invariant
  // already guarantees.
  const material = mode === 'pinned' ? (props.material as MaterialType) : pickedMaterial;
  const floorName = mode === 'pinned'
    ? (props.floor as string)
    : (freeformFloors[pickedFloorNumber - 1] ?? `Floor ${pickedFloorNumber}`);
  // Moved up (was declared after the gear-init lazy initializers) so the recipient seed below
  // can use it synchronously at mount.
  const { materialLog } = useLootTrackingStore();
  const [recipientPlayerId, setRecipientPlayerId] = useState(() => {
    if (mode === 'pinned') return suggestedPlayer?.id ?? '';
    if (mode === 'edit') return editEntry!.recipientPlayerId;
    // Fix round 1, item 4: seed free-form's recipient synchronously with the default
    // material's top-priority needer, computed with the SAME ranking the auto-recipient
    // effect below uses (`rankRecipients`) — subs widening always starts unchecked
    // (`includeSubs`'s own default), so its filter is inlined rather than read from state
    // that hasn't been declared yet. This makes the very first render already carry a real
    // recipient id, so there's no post-mount `'' -> id` transition left for the pinned Radix
    // Select race (see the auto-recipient effect's comment) to clobber.
    const initialEligible = allPlayers.filter((p) => p.configured && !p.isSubstitute);
    const ranked = rankRecipients(initialEligible, DEFAULT_FREEFORM_MATERIAL, settings, materialLog);
    return ranked[0]?.player.id ?? '';
  });
  const [selectedWeek, setSelectedWeek] = useState(props.initialWeek ?? maxWeek);
  const [method, setMethod] = useState<LootMethod>('drop');
  const [isSaving, setIsSaving] = useState(false);
  const [updateGear, setUpdateGear] = useState(true);
  // R-a/D-37 subs widening: off by default, reset whenever the modal opens (below).
  const [includeSubs, setIncludeSubs] = useState(false);
  // D8 Task 4, R-26: notes field — v2-only render (pinned's `showNotes` door + free-form,
  // always). Reset on open in BOTH mode-specific effects below for state hygiene, even though
  // pinned's reset is V1-invisible (V1 never renders the field).
  const [notes, setNotes] = useState('');
  // Never clobbers a manual recipient pick; only a material change resets it (D8 3B).
  const userPickedRecipient = useRef(false);
  // Compute initial slot selection BEFORE first render using lazy initializer
  // Note: 'tome_weapon' selection is tracked via augmentTomeWeapon state, not selectedSlot
  const [selectedSlot, setSelectedSlot] = useState<GearSlot | null>(() => {
    if (mode === 'edit') {
      const recipient = allPlayers.find((p) => p.id === recipientPlayerId);
      return editGearSelection(editEntry!.materialType, editEntry!.slotAugmented, recipient).slot;
    }
    const player = allPlayers.find((p) => p.id === recipientPlayerId) || suggestedPlayer;
    return initialGearSelection(player, material).slot;
  });
  // Compute initial augmentTomeWeapon BEFORE first render
  const [augmentTomeWeapon, setAugmentTomeWeapon] = useState(() => {
    if (mode === 'edit') {
      const recipient = allPlayers.find((p) => p.id === recipientPlayerId);
      return editGearSelection(editEntry!.materialType, editEntry!.slotAugmented, recipient).augmentTome;
    }
    const player = allPlayers.find((p) => p.id === recipientPlayerId) || suggestedPlayer;
    return initialGearSelection(player, material).augmentTome;
  });

  // Compute eligible options for gear update based on selected player and material. Edit mode
  // (R-21): the entry's own effect stays offered even though current player state suggests it's
  // already applied — `originalSlot` only applies when the recipient hasn't changed since the
  // entry (`withOriginalSlot`/the UT+solvent-tome_weapon special cases below).
  const eligibleOptions = useMemo(() => {
    const player = allPlayers.find((p) => p.id === recipientPlayerId);
    const isOriginalRecipient = mode === 'edit' && editEntry!.recipientPlayerId === recipientPlayerId;
    // The entry's slot is only offerable in its OWN material's domain — edit mode renders the
    // material pills, and a twine slot must not leak into glaze's slot list (PR #236 review).
    const originalSlot =
      isOriginalRecipient && editEntry!.materialType === material ? editEntry!.slotAugmented : undefined;
    if (!player) return { slots: [] as GearSlot[], canMarkTomeWeaponHave: false, canAugmentTomeWeapon: false };

    if (material === 'universal_tomestone') {
      // Universal tomestone grants the base tome weapon. Edit mode: the recipient already
      // having the item (via this very entry) must not hide the checkbox — otherwise even a
      // notes-only edit would silently revert it (no way to leave `updateGear` meaningfully
      // true without a visible control) — legacy precedent `LogMaterialModal.tsx:134`.
      const editOriginalUt = isOriginalRecipient && editEntry!.materialType === 'universal_tomestone';
      return {
        slots: [] as GearSlot[],
        canMarkTomeWeaponHave: needsTomeWeaponItem(player) || editOriginalUt,
        canAugmentTomeWeapon: false,
      };
    }

    if (material === 'solvent') {
      // Solvent can augment tome weapon OR weapon gear slot
      const slots = withOriginalSlot(getEligibleSlotsForAugmentation(player, material), originalSlot);
      return {
        slots,
        canMarkTomeWeaponHave: false,
        canAugmentTomeWeapon: needsTomeWeaponAugmentation(player) || originalSlot === 'tome_weapon',
      };
    }

    // Twine/Glaze: only gear slots
    return {
      slots: withOriginalSlot(getEligibleSlotsForAugmentation(player, material), originalSlot),
      canMarkTomeWeaponHave: false,
      canAugmentTomeWeapon: false,
    };
  }, [recipientPlayerId, material, allPlayers, mode, editEntry]);

  // Determine if there are any eligible options. Edit mode gains a clause for a recorded slot
  // (or `'tome_weapon'`) even when the memo above found no player to derive `slots`/flags from.
  const hasEligibleOptions = eligibleOptions.canMarkTomeWeaponHave ||
    eligibleOptions.canAugmentTomeWeapon ||
    eligibleOptions.slots.length > 0 ||
    (mode === 'edit' && editEntry?.materialType === material && !!editEntry?.slotAugmented);

  // Reset state when modal opens (pinned) — gated so free-form (below) has its own block.
  // Non-null assertions: this body only runs where `mode === 'pinned'` guarantees
  // `suggestedPlayer` is set. Fix round 1, item 2: `setSelectedWeek` now honors
  // `props.initialWeek` (D5's Log-cell door) instead of clobbering it back to `maxWeek` on
  // every open — value-identical for V1 (never passes `initialWeek`, so `?? maxWeek` still
  // resolves to `maxWeek`); `props.initialWeek` added to the dep array to match.
  useEffect(() => {
    if (mode !== 'pinned' || !isOpen) return;
    setRecipientPlayerId(suggestedPlayer!.id);
    setSelectedWeek(props.initialWeek ?? maxWeek);
    setMethod('drop');
    setUpdateGear(true);
    setNotes('');

    // Use player from allPlayers for consistency with eligibleOptions memo
    const player = allPlayers.find((p) => p.id === suggestedPlayer!.id) || suggestedPlayer;

    // Compute initial slot selection based on player and material
    const { slot, augmentTome } = initialGearSelection(player, material);
    setSelectedSlot(slot);
    setAugmentTomeWeapon(augmentTome);
  }, [mode, isOpen, suggestedPlayer, maxWeek, material, allPlayers, props.initialWeek]);

  // Reset state when modal opens (free-form) — its own floor/material/week/recipient-ranking
  // defaults; pinned's block above is untouched.
  useEffect(() => {
    if (mode !== 'freeform' || !isOpen) return;
    setPickedFloorNumber(DEFAULT_FREEFORM_FLOOR);
    setPickedMaterial(DEFAULT_FREEFORM_MATERIAL);
    setSelectedWeek(props.initialWeek ?? maxWeek);
    setNotes('');
    userPickedRecipient.current = false;
  }, [mode, isOpen, maxWeek, props.initialWeek]);

  // Subs widening (R-a/D-37) resets regardless of mode — harmless where the checkbox doesn't
  // render (pinned).
  useEffect(() => {
    if (isOpen) setIncludeSubs(false);
  }, [isOpen]);

  // Reset state when modal opens (edit, R-21) — declared AFTER the subs-widening reset above so
  // its own `setIncludeSubs` call (sub recipient -> checked, legacy `:218`) wins the same commit.
  useEffect(() => {
    if (mode !== 'edit' || !isOpen) return;
    const entry = editEntry!;

    // Floor (director m4): parse the entry's floor name, but fall back to the material's own
    // home floor when the parsed floor's table doesn't carry that material (parse fallback = 1;
    // floors 1/4 never carry materials) — never leaves an empty pill row with nothing pressed.
    const parsedFloorNum = parseFloorName(entry.floor);
    const floorNum = FLOOR_LOOT_TABLES[parsedFloorNum].upgradeMaterials.includes(entry.materialType)
      ? parsedFloorNum
      : getFloorForUpgradeMaterial(entry.materialType)[0];
    setPickedFloorNumber(floorNum);
    setPickedMaterial(entry.materialType);
    setRecipientPlayerId(entry.recipientPlayerId);
    setSelectedWeek(entry.weekNumber);
    setMethod(entry.method || 'drop');
    setNotes(entry.notes ?? '');

    const recipient = allPlayers.find((p) => p.id === entry.recipientPlayerId);
    // A sub's entry still shows its (sub) recipient — legacy precedent `LogMaterialModal.tsx:218`.
    setIncludeSubs(recipient?.isSubstitute ?? false);

    const { slot, augmentTome, updateGear: shouldCheckUpdateGear } = editGearSelection(
      entry.materialType, entry.slotAugmented, recipient
    );
    setSelectedSlot(slot);
    setAugmentTomeWeapon(augmentTome);
    setUpdateGear(shouldCheckUpdateGear);
  }, [mode, isOpen, editEntry, allPlayers]);

  // Handle recipient change - update slot selection when user changes recipient
  const handleRecipientChange = (newPlayerId: string) => {
    userPickedRecipient.current = true;
    setRecipientPlayerId(newPlayerId);

    // Compute and set slot for new recipient
    const player = allPlayers.find((p) => p.id === newPlayerId);
    const { slot, augmentTome } = initialGearSelection(player, material);
    setSelectedSlot(slot);
    setAugmentTomeWeapon(augmentTome);
  };

  // R-26/D-37: a material change (direct pick, or a floor pick whose new floor doesn't carry
  // the current material) re-derives gear selection and lets the auto-recipient effect
  // re-rank (userPickedRecipient reset). A floor-only change (today's two floors never share
  // a material, so in practice: re-clicking the already-active floor pill) resets neither.
  function applyMaterialChange(m: MaterialType, forPlayerId: string) {
    userPickedRecipient.current = false;
    const player = allPlayers.find((p) => p.id === forPlayerId);
    const { slot, augmentTome } = initialGearSelection(player, m);
    setSelectedSlot(slot);
    setAugmentTomeWeapon(augmentTome);
  }

  function pickMaterial(m: MaterialType) {
    setPickedMaterial(m);
    applyMaterialChange(m, recipientPlayerId);
  }

  function pickFloor(n: FloorNumber) {
    setPickedFloorNumber(n);
    const materialsForNewFloor = materialsForFloorNumber(n);
    if (materialsForNewFloor.includes(pickedMaterial)) return; // keeps the material — resets neither
    const next = materialsForNewFloor[0];
    setPickedMaterial(next);
    applyMaterialChange(next, recipientPlayerId);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientPlayerId) return;

    setIsSaving(true);
    try {
      const shouldUpdateGear = updateGear && hasEligibleOptions;

      if (mode === 'edit' && editEntry) {
        const options: UpdateMaterialOptions = {
          updateGear: shouldUpdateGear,
          slotToAugment: shouldUpdateGear && selectedSlot ? selectedSlot as GearSlot : undefined,
          augmentTomeWeapon: shouldUpdateGear && augmentTomeWeapon,
        };
        await updateMaterialAndReconcileGear(
          groupId,
          tierId,
          editEntry,
          {
            weekNumber: selectedWeek,
            floor: floorName,
            materialType: material,
            recipientPlayerId,
            method,
            notes: notes.trim(),
          },
          options
        );
        toast.success('Material entry updated');
      } else {
        await logMaterialAndUpdateGear(
          groupId,
          tierId,
          {
            weekNumber: selectedWeek,
            floor: floorName,
            materialType: material,
            recipientPlayerId,
            method,
            ...(notes.trim() ? { notes: notes.trim() } : {}),
          },
          {
            updateGear: shouldUpdateGear,
            slotToAugment: shouldUpdateGear && selectedSlot ? selectedSlot as GearSlot : undefined,
            augmentTomeWeapon: shouldUpdateGear && augmentTomeWeapon,
          }
        );

        const recipient = allPlayers.find((p) => p.id === recipientPlayerId);
        toast.success(`Logged ${UPGRADE_MATERIAL_DISPLAY_NAMES[material]} for ${recipient?.name || 'player'}`);
      }

      onSuccess?.();
      onClose();
    } catch {
      toast.error(mode === 'edit' ? 'Failed to update material entry' : 'Failed to log material');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter to configured players. Pinned keeps the original main-roster-only filter verbatim
  // (subs can only be logged via Loot Log tab); non-pinned modes widen it (R-a/D-37) via the
  // "Include substitutes" checkbox.
  const eligiblePlayers = useMemo(() =>
    allPlayers.filter((p) => mode === 'pinned'
      ? (p.configured && !p.isSubstitute)
      : (p.configured && (includeSubs || !p.isSubstitute))
    ),
    [allPlayers, mode, includeSubs]
  );
  const selectedPlayer = allPlayers.find((p) => p.id === recipientPlayerId);

  // Sort players by priority and add labels (pass materialLog to account for received
  // materials; different priority calc for Universal Tomestone vs slot-based materials —
  // both handled inside the shared `rankRecipients` helper, module scope).
  const sortedRecipients = useMemo(
    () => rankRecipients(eligiblePlayers, material, settings, materialLog),
    [eligiblePlayers, material, settings, materialLog]
  );

  // Auto-recipient (free-form only): picks the top-priority needer, but never clobbers a
  // user's manual pick — re-ranks whenever `sortedRecipients` changes (e.g. a material
  // change) as long as the user hasn't picked one themselves this time the modal is open.
  // Fix round 1, item 1: a re-rank must re-derive gear selection for the NEWLY picked
  // recipient, not leave whatever `applyMaterialChange` derived for the recipient who was
  // current before this effect ran (that recipient may not even be the one who ends up
  // picked — e.g. a rapid material-to-material pick where the old and new top-priority
  // needers differ). Without this, the gear checkbox/preview can show a promise the submit
  // payload doesn't keep (`slotToAugment: undefined` silently, or worse, a stale slot from a
  // DIFFERENT player if only the id changed and eligibility wasn't re-checked downstream).
  useEffect(() => {
    if (mode !== 'freeform' || !isOpen || userPickedRecipient.current) return;
    const nextId = sortedRecipients[0]?.player.id ?? '';
    // Fix round 7: only re-derive when the auto-pick actually MOVES. A re-rank that lands on
    // the same recipient (e.g. the "Include substitutes" toggle re-creating `eligiblePlayers`,
    // and with it `sortedRecipients`' identity) must not clobber a manual slot / tome-weapon
    // pick — `setRecipientPlayerId(nextId)` bails out on an unchanged id, but the gear setters
    // below wouldn't. Material changes are safe to skip when the pick holds: they re-derive
    // synchronously via `applyMaterialChange` before this effect runs, and a re-rank that DOES
    // move the recipient (fix round 1, item 1) still takes the derivation below.
    if (nextId === recipientPlayerId) return;
    setRecipientPlayerId(nextId);
    const player = allPlayers.find((p) => p.id === nextId);
    const { slot, augmentTome } = initialGearSelection(player, material);
    setSelectedSlot(slot);
    setAugmentTomeWeapon(augmentTome);
  }, [mode, isOpen, sortedRecipients, allPlayers, material, recipientPlayerId]);

  // Get priority label for a player
  const getPriorityLabel = (priority: number, needsMaterial: boolean): string => {
    if (!needsMaterial) return '';
    if (priority === 1) return ' - Top Priority';
    if (priority === 2) return ' - 2nd Priority';
    if (priority === 3) return ' - 3rd Priority';
    return '';
  };

  // Build recipient options with job icons. Non-pinned modes gain a leading placeholder
  // while nothing is picked yet (pinned always starts from `suggestedPlayer`). Edit mode
  // (R-21): the entry's recipient may no longer be in the pool (removed from the roster since
  // logged) — inject them by name so the Select never shows a blank value for a real id.
  const recipientOptions = [
    ...(mode === 'edit' && editEntry && !sortedRecipients.some((r) => r.player.id === editEntry.recipientPlayerId)
      ? [{ value: editEntry.recipientPlayerId, label: editEntry.recipientPlayerName }]
      : []),
    ...(mode !== 'pinned' && recipientPlayerId === '' ? [{ value: '', label: 'Select player…' }] : []),
    ...sortedRecipients.map(({ player, priority, needsMaterial }) => ({
      value: player.id,
      label: `${player.name}${getPriorityLabel(priority, needsMaterial)}`,
      icon: <JobIcon job={player.job} size="sm" />,
    })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          {mode === 'edit' ? <Pencil className="w-5 h-5" /> : <Gem className="w-5 h-5" />}
          {mode === 'pinned'
            ? <>Log {UPGRADE_MATERIAL_DISPLAY_NAMES[material]}</>
            : mode === 'edit'
              ? 'Edit Material Entry'
              : 'Log Material'}
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'pinned' ? (
          /* Pre-filled info */
          <div className="bg-surface-base rounded-lg p-3 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-secondary">Floor:</span>
              <span className="text-text-primary font-medium">{floorName}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-secondary">Material:</span>
              <span className="text-text-primary font-medium">{UPGRADE_MATERIAL_DISPLAY_NAMES[material]}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-text-secondary">Week:</span>
              <NumberInput
                value={selectedWeek}
                onChange={(val) => setSelectedWeek(val ?? maxWeek)}
                min={1}
                max={maxWeek}
                size="sm"
              />
            </div>
          </div>
        ) : (
          <>
            <div role="group" aria-label="Floor" className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs uppercase tracking-wide text-text-tertiary">Floor</span>
              {MATERIAL_FLOORS.map((n) => (
                <Tag key={n} variant="filter" tone={`floor-${n}` as Tone}
                     pressed={pickedFloorNumber === n} onClick={() => pickFloor(n)}>
                  {freeformFloors[n - 1] ?? `Floor ${n}`}
                </Tag>
              ))}
            </div>
            <div role="group" aria-label="Material" className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs uppercase tracking-wide text-text-tertiary">Material</span>
              {materialsForFloorNumber(pickedFloorNumber).map((m) => (
                <Tag key={m} variant="filter" tone={MATERIAL_TONE[m]}
                     pressed={pickedMaterial === m} onClick={() => pickMaterial(m)}>
                  {UPGRADE_MATERIAL_DISPLAY_NAMES[m]}
                </Tag>
              ))}
            </div>
            <div className="flex items-center justify-between text-sm">
              <Label htmlFor="material-week" className="mb-0">Week</Label>
              {/* `v ?? selectedWeek`: the row is shared with edit mode (no initialWeek there). */}
              <NumberInput id="material-week" value={selectedWeek} onChange={(v) => setSelectedWeek((prev) => v ?? prev)}
                           min={1} max={maxWeek} size="sm" />
            </div>
          </>
        )}

        {/* Recipient selection */}
        <div>
          {mode === 'pinned' ? (
            <Label htmlFor="recipient">Recipient</Label>
          ) : (
            <div className="flex items-center justify-between">
              <Label htmlFor="recipient">Recipient</Label>
              <Checkbox checked={includeSubs} onChange={setIncludeSubs} label="Include substitutes" className="text-xs" />
            </div>
          )}
          <Select
            id="recipient"
            value={recipientPlayerId}
            onChange={handleRecipientChange}
            options={recipientOptions}
          />
        </div>

        {/* Method */}
        <div>
          <Label>Method</Label>
          <RadioGroup
            name="material-method"
            value={method}
            onChange={(value) => setMethod(value as LootMethod)}
            options={[
              { value: 'drop', label: 'Drop' },
              { value: 'book', label: 'Book' },
            ]}
            orientation="horizontal"
          />
        </div>

        {/* Gear update option */}
        {hasEligibleOptions && (
          <div className="space-y-2">
            {/* Universal Tomestone: mark tome weapon as have */}
            {material === 'universal_tomestone' && eligibleOptions.canMarkTomeWeaponHave && (
              <Checkbox
                checked={updateGear}
                onChange={setUpdateGear}
                label={`Also mark tome weapon as obtained for ${selectedPlayer?.name}`}
              />
            )}

            {/* Solvent: choose between tome weapon or gear slot */}
            {material === 'solvent' && (eligibleOptions.canAugmentTomeWeapon || eligibleOptions.slots.length > 0) && (
              <>
                <Checkbox
                  checked={updateGear}
                  onChange={setUpdateGear}
                  label={`Also mark gear as augmented for ${selectedPlayer?.name}`}
                />
                {updateGear && (eligibleOptions.canAugmentTomeWeapon && eligibleOptions.slots.length > 0) && (
                  <div>
                    <Select
                      value={augmentTomeWeapon ? 'tome_weapon' : (selectedSlot || '')}
                      onChange={(val) => {
                        if (val === 'tome_weapon') {
                          setAugmentTomeWeapon(true);
                          setSelectedSlot(null);
                        } else {
                          setAugmentTomeWeapon(false);
                          setSelectedSlot(val as GearSlot);
                        }
                      }}
                      options={[
                        { value: 'tome_weapon', label: 'Tome Weapon' },
                        ...eligibleOptions.slots.map((slot) => ({
                          value: slot,
                          label: GEAR_SLOT_NAMES[slot],
                        })),
                      ]}
                    />
                  </div>
                )}
                {updateGear && eligibleOptions.canAugmentTomeWeapon && eligibleOptions.slots.length === 0 && (
                  <div className="text-sm text-text-muted ml-6">Tome Weapon</div>
                )}
                {updateGear && !eligibleOptions.canAugmentTomeWeapon && eligibleOptions.slots.length > 0 && (
                  <div>
                    <Select
                      value={selectedSlot || ''}
                      onChange={(val) => setSelectedSlot(val as GearSlot)}
                      options={eligibleOptions.slots.map((slot) => ({
                        value: slot,
                        label: GEAR_SLOT_NAMES[slot],
                      }))}
                    />
                  </div>
                )}
              </>
            )}

            {/* Twine/Glaze: gear slot dropdown */}
            {material !== 'universal_tomestone' && material !== 'solvent' && eligibleOptions.slots.length > 0 && (
              <>
                <Checkbox
                  checked={updateGear}
                  onChange={setUpdateGear}
                  label={`Also mark gear as augmented for ${selectedPlayer?.name}`}
                />
                {updateGear && (
                  <div>
                    <Select
                      value={selectedSlot || ''}
                      onChange={(val) => setSelectedSlot(val as GearSlot)}
                      options={eligibleOptions.slots.map((slot) => ({
                        value: slot,
                        label: GEAR_SLOT_NAMES[slot],
                      }))}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Notes — D8 Task 4, R-26: v2-only (pinned's `showNotes` cell door + free-form,
            always). V1 (pinned without showNotes) never renders this. */}
        {(mode !== 'pinned' || props.showNotes) && (
          <div>
            <Label htmlFor="material-notes">Notes (optional)</Label>
            <TextArea id="material-notes" value={notes} onChange={setNotes} rows={2} placeholder="Add a note…" />
          </div>
        )}

        {/* Preview */}
        <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-sm">
          <div className="text-accent font-medium mb-1">This will:</div>
          <ul className="text-text-secondary space-y-1">
            {mode === 'edit' && editEntry ? (
              <>
                <li>
                  {/* The recipient may be injected by name only (out of the live pool) —
                      fall back to the entry's recorded name, never an empty gap. */}
                  ~ Update {UPGRADE_MATERIAL_DISPLAY_NAMES[material]} entry for{' '}
                  {selectedPlayer?.name ??
                    (recipientPlayerId === editEntry.recipientPlayerId ? editEntry.recipientPlayerName : 'player')}{' '}
                  (Week {selectedWeek})
                </li>
                {editReconciliationLines(
                  editEntry,
                  material,
                  recipientPlayerId,
                  updateGear && hasEligibleOptions,
                  augmentTomeWeapon,
                  selectedSlot
                ).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </>
            ) : (
              <>
                <li>+ Add {UPGRADE_MATERIAL_DISPLAY_NAMES[material]} to Week {selectedWeek} log for {selectedPlayer?.name ?? 'player'}</li>
                {updateGear && hasEligibleOptions && (
                  <li>
                    {material === 'universal_tomestone'
                      ? '+ Mark tome weapon as obtained'
                      : augmentTomeWeapon
                        ? '+ Mark tome weapon as augmented'
                        : `+ Mark ${selectedSlot ? GEAR_SLOT_NAMES[selectedSlot as GearSlot] : 'slot'} as augmented`
                    }
                  </li>
                )}
              </>
            )}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border-default">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!recipientPlayerId}
            loading={isSaving}
          >
            {mode === 'edit' ? 'Save Changes' : 'Log Material'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
