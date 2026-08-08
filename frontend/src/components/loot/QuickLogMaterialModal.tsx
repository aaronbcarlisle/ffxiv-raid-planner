/**
 * Quick Log Material Modal
 *
 * Streamlined modal for quickly logging an upgrade material from the priority panel.
 * Pre-filled with material type, floor, and suggested player for one-click confirmation.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { Gem } from 'lucide-react';
import { Modal, Select, Label, Checkbox, NumberInput, RadioGroup, Tag, type Tone } from '../ui';
import { Button } from '../primitives';
import { JobIcon } from '../ui/JobIcon';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { toast } from '../../stores/toastStore';
import { getPriorityForUpgradeMaterial, getPriorityForUniversalTomestone, type PriorityEntry } from '../../utils/priority';
import {
  isSlotAugmentationMaterial,
  UPGRADE_MATERIAL_DISPLAY_NAMES,
  FLOOR_LOOT_TABLES,
  type FloorNumber,
} from '../../gamedata/loot-tables';
import { DEFAULT_SETTINGS } from '../../utils/constants';
import {
  getEligibleSlotsForAugmentation,
  needsTomeWeaponItem,
  needsTomeWeaponAugmentation,
  logMaterialAndUpdateGear,
} from '../../utils/materialCoordination';
import type { SnapshotPlayer, MaterialType, StaticSettings, GearSlot, LootMethod } from '../../types';
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
  // Task 6 appends the `edit` branch (no initialWeek — the week comes from the entry).
);

type ModalMode = 'pinned' | 'freeform'; // Task 6 widens with 'edit'

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
  // initial recipient instead comes from the auto-recipient effect (D8 3B step 3).
  const suggestedPlayer = props.suggestedPlayer;

  const mode: ModalMode = props.floor != null ? 'pinned' : 'freeform';
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
  const [recipientPlayerId, setRecipientPlayerId] = useState(suggestedPlayer?.id ?? '');
  const [selectedWeek, setSelectedWeek] = useState(props.initialWeek ?? maxWeek);
  const [method, setMethod] = useState<LootMethod>('drop');
  const [isSaving, setIsSaving] = useState(false);
  const [updateGear, setUpdateGear] = useState(true);
  // R-a/D-37 subs widening: off by default, reset whenever the modal opens (below).
  const [includeSubs, setIncludeSubs] = useState(false);
  // Never clobbers a manual recipient pick; only a material change resets it (D8 3B).
  const userPickedRecipient = useRef(false);
  // Compute initial slot selection BEFORE first render using lazy initializer
  // Note: 'tome_weapon' selection is tracked via augmentTomeWeapon state, not selectedSlot
  const [selectedSlot, setSelectedSlot] = useState<GearSlot | null>(() => {
    const player = allPlayers.find((p) => p.id === recipientPlayerId) || suggestedPlayer;
    return initialGearSelection(player, material).slot;
  });
  // Compute initial augmentTomeWeapon BEFORE first render
  const [augmentTomeWeapon, setAugmentTomeWeapon] = useState(() => {
    const player = allPlayers.find((p) => p.id === recipientPlayerId) || suggestedPlayer;
    return initialGearSelection(player, material).augmentTome;
  });
  const { materialLog } = useLootTrackingStore();

  // Compute eligible options for gear update based on selected player and material
  const eligibleOptions = useMemo(() => {
    const player = allPlayers.find((p) => p.id === recipientPlayerId);
    if (!player) return { slots: [] as GearSlot[], canMarkTomeWeaponHave: false, canAugmentTomeWeapon: false };

    if (material === 'universal_tomestone') {
      // Universal tomestone grants the base tome weapon
      return {
        slots: [] as GearSlot[],
        canMarkTomeWeaponHave: needsTomeWeaponItem(player),
        canAugmentTomeWeapon: false,
      };
    }

    if (material === 'solvent') {
      // Solvent can augment tome weapon OR weapon gear slot
      const slots = getEligibleSlotsForAugmentation(player, material);
      return {
        slots,
        canMarkTomeWeaponHave: false,
        canAugmentTomeWeapon: needsTomeWeaponAugmentation(player),
      };
    }

    // Twine/Glaze: only gear slots
    return {
      slots: getEligibleSlotsForAugmentation(player, material),
      canMarkTomeWeaponHave: false,
      canAugmentTomeWeapon: false,
    };
  }, [recipientPlayerId, material, allPlayers]);

  // Determine if there are any eligible options
  const hasEligibleOptions = eligibleOptions.canMarkTomeWeaponHave ||
    eligibleOptions.canAugmentTomeWeapon ||
    eligibleOptions.slots.length > 0;

  // Reset state when modal opens (pinned) — gated so free-form (below) has its own block.
  // Non-null assertions: this body only runs where `mode === 'pinned'` guarantees
  // `suggestedPlayer` is set; body + original 5 deps otherwise untouched from pre-D8.
  useEffect(() => {
    if (mode !== 'pinned' || !isOpen) return;
    setRecipientPlayerId(suggestedPlayer!.id);
    setSelectedWeek(maxWeek);
    setMethod('drop');
    setUpdateGear(true);

    // Use player from allPlayers for consistency with eligibleOptions memo
    const player = allPlayers.find((p) => p.id === suggestedPlayer!.id) || suggestedPlayer;

    // Compute initial slot selection based on player and material
    const { slot, augmentTome } = initialGearSelection(player, material);
    setSelectedSlot(slot);
    setAugmentTomeWeapon(augmentTome);
  }, [mode, isOpen, suggestedPlayer, maxWeek, material, allPlayers]);

  // Reset state when modal opens (free-form) — its own floor/material/week/recipient-ranking
  // defaults; pinned's block above is untouched.
  useEffect(() => {
    if (mode !== 'freeform' || !isOpen) return;
    setPickedFloorNumber(DEFAULT_FREEFORM_FLOOR);
    setPickedMaterial(DEFAULT_FREEFORM_MATERIAL);
    setSelectedWeek(props.initialWeek ?? maxWeek);
    userPickedRecipient.current = false;
  }, [mode, isOpen, maxWeek, props.initialWeek]);

  // Subs widening (R-a/D-37) resets regardless of mode — harmless where the checkbox doesn't
  // render (pinned).
  useEffect(() => {
    if (isOpen) setIncludeSubs(false);
  }, [isOpen]);

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

      await logMaterialAndUpdateGear(
        groupId,
        tierId,
        {
          weekNumber: selectedWeek,
          floor: floorName,
          materialType: material,
          recipientPlayerId,
          method,
        },
        {
          updateGear: shouldUpdateGear,
          slotToAugment: shouldUpdateGear && selectedSlot ? selectedSlot as GearSlot : undefined,
          augmentTomeWeapon: shouldUpdateGear && augmentTomeWeapon,
        }
      );

      const recipient = allPlayers.find((p) => p.id === recipientPlayerId);
      toast.success(`Logged ${UPGRADE_MATERIAL_DISPLAY_NAMES[material]} for ${recipient?.name || 'player'}`);

      onSuccess?.();
      onClose();
    } catch {
      toast.error('Failed to log material');
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

  // Sort players by priority and add labels
  const sortedRecipients = useMemo(() => {
    // Get priority entries for this material (pass materialLog to account for received materials)
    // Use different priority calculation for Universal Tomestone vs slot-based materials
    const priorityEntries: PriorityEntry[] = isSlotAugmentationMaterial(material)
      ? getPriorityForUpgradeMaterial(eligiblePlayers, material, settings, materialLog)
      : getPriorityForUniversalTomestone(eligiblePlayers, settings, materialLog);

    // Create a map of player ID to priority rank
    const priorityMap = new Map(priorityEntries.map((e, i) => [e.player.id, { rank: i + 1, score: e.score }]));

    // Sort all players: those with priority first (by rank), then others alphabetically
    return eligiblePlayers
      .map(player => {
        const priority = priorityMap.get(player.id);
        return {
          player,
          priority: priority?.rank ?? 999,
          needsMaterial: !!priority,
        };
      })
      .sort((a, b) => {
        if (a.needsMaterial && !b.needsMaterial) return -1;
        if (!a.needsMaterial && b.needsMaterial) return 1;
        if (a.needsMaterial && b.needsMaterial) return a.priority - b.priority;
        return a.player.name.localeCompare(b.player.name);
      });
  }, [eligiblePlayers, material, settings, materialLog]);

  // Auto-recipient (free-form only): picks the top-priority needer, but never clobbers a
  // user's manual pick — re-ranks whenever `sortedRecipients` changes (e.g. a material
  // change) as long as the user hasn't picked one themselves this time the modal is open.
  useEffect(() => {
    if (mode !== 'freeform' || !isOpen || userPickedRecipient.current) return;
    setRecipientPlayerId(sortedRecipients[0]?.player.id ?? '');
  }, [mode, isOpen, sortedRecipients]);

  // Get priority label for a player
  const getPriorityLabel = (priority: number, needsMaterial: boolean): string => {
    if (!needsMaterial) return '';
    if (priority === 1) return ' - Top Priority';
    if (priority === 2) return ' - 2nd Priority';
    if (priority === 3) return ' - 3rd Priority';
    return '';
  };

  // Build recipient options with job icons. Non-pinned modes gain a leading placeholder
  // while nothing is picked yet (pinned always starts from `suggestedPlayer`).
  const recipientOptions = [
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
          <Gem className="w-5 h-5" />
          {mode === 'pinned' ? <>Log {UPGRADE_MATERIAL_DISPLAY_NAMES[material]}</> : 'Log Material'}
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
              <NumberInput value={selectedWeek} onChange={(v) => setSelectedWeek(v ?? selectedWeek)}
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

        {/* Preview */}
        <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-sm">
          <div className="text-accent font-medium mb-1">This will:</div>
          <ul className="text-text-secondary space-y-1">
            <li>+ Add {UPGRADE_MATERIAL_DISPLAY_NAMES[material]} to Week {selectedWeek} log for {selectedPlayer?.name}</li>
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
            Log Material
          </Button>
        </div>
      </form>
    </Modal>
  );
}
