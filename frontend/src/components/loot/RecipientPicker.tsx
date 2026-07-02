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
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Package } from 'lucide-react';
import { Modal, Select, Checkbox, NumberInput, RadioGroup, TextArea, Input, SegmentedToggle, Tag, LinkText } from '../ui';
import { Button } from '../primitives';
import { useStaticCharacterStore } from '../../stores/staticCharacterStore';
import { getPrimaryRegistration } from '../../utils/staticCharacterContextService';
import { logLootAndUpdateGear } from '../../utils/lootCoordination';
import { toast } from '../../stores/toastStore';
import { isPriorityDisabled } from '../../utils/priority';
import { buildRecipientEntries, type PickerScope, type NeedTag } from '../../utils/recipientRanking';
import { FLOOR_LOOT_TABLES, type FloorNumber } from '../../gamedata/loot-tables';
import { GEAR_SLOT_NAMES } from '../../types';
import type { SnapshotPlayer, StaticSettings, LootLogEntry, GearSlot } from '../../types';

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
  | { mode: 'assign'; item: DropItemContext }
  | { mode: 'log'; item?: DropItemContext }
);

const SCOPE_OPTIONS: { value: PickerScope; label: string }[] = [
  { value: 'priority', label: 'By priority' },
  { value: 'all', label: 'All members' },
  { value: 'offspec', label: 'Off-spec / free' },
];

const TAG_TONE: Record<NeedTag, 'success' | 'muted'> = {
  bis: 'success',
  minor: 'muted',
  free: 'muted',
};
const TAG_LABEL: Record<NeedTag, string> = { bis: 'BiS', minor: 'minor', free: 'free' };

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
  lootLog,
  currentWeek,
  maxWeek,
  onSuccess,
}: RecipientPickerProps) {
  const [scope, setScope] = useState<PickerScope>('priority');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [week, setWeek] = useState(currentWeek);
  const [method, setMethod] = useState<'drop' | 'book'>('drop');
  const [updateGear, setUpdateGear] = useState(true);
  const [isExtra, setIsExtra] = useState(false);
  const [notes, setNotes] = useState('');
  const [characterRegId, setCharacterRegId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDetails, setShowDetails] = useState(mode === 'log');

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
  // fight/slot selectors in log mode.
  const slot: GearSlot | 'ring' = mode === 'log' ? logSlot : (item?.slot ?? 'weapon');
  const floorName = mode === 'log' ? logFloorName : (item?.floorName ?? '');
  const floorNumber: FloorNumber = mode === 'log'
    ? (Math.max(0, floors.indexOf(logFloorName)) + 1) as FloorNumber
    : (item?.floorNumber ?? 1);
  const label = mode === 'log' ? slotToLabel(slot) : (item?.label ?? slotToLabel(slot));
  const isWeapon = slot === 'weapon';

  const enhancedActive = settings.enableEnhancedScoring === true && !isPriorityDisabled(settings);

  const entries = useMemo(
    () => buildRecipientEntries({ players, slot, scope, settings, lootLog, currentWeek, enhancedActive }),
    [players, slot, scope, settings, lootLog, currentWeek, enhancedActive],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? entries.filter((e) => e.player.name.toLowerCase().includes(q)) : entries;
  }, [entries, search]);

  // Selection: `selectedId` is PINNED into state at open (below) — parity with
  // QuickLogDropModal.tsx:106 materialising the suggested player — so a mid-open
  // store churn (30s roster poll) reordering `entries` can't silently retarget
  // an untouched pick. The derived fallback to `entries[0]` stays as a safety
  // net for scope switches that drop the pinned player from the visible pool.
  const selected = entries.find((e) => e.player.id === selectedId) ?? entries[0] ?? null;
  const recipientId = selected?.player.id;

  // `selected` derives from the UNFILTERED `entries` — when the search text
  // hides the selected row, no row visibly shows selected but submit would
  // otherwise stay enabled, targeting a recipient the user can no longer see.
  // Gate submit on the pick actually being visible in `filtered`.
  const selectionVisible = filtered.some((e) => e.player.id === selected?.player.id);

  // Forced-extra under off-spec: single source of truth used by the payload,
  // the weapon auto-note, AND the (disabled) checkbox state.
  const effectiveExtra = scope === 'offspec' ? true : isExtra;

  // Initialise state ONLY on the open transition (closed → open) — mirrors
  // QuickLogDropModal.tsx:97-115. Keying off a ref (not raw isOpen) means a
  // mid-interaction store churn (e.g. the 30s roster poll) can't re-run this and
  // silently revert the recipient pick.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      setScope('priority');
      // Pin the default recipient: top of the initial priority ranking for the
      // opening drop context (scope always resets to 'priority' on open).
      const initialSlot: GearSlot | 'ring' = mode === 'log' ? firstSlotForFloor(1) : (item?.slot ?? 'weapon');
      const initialEntries = buildRecipientEntries({
        players, slot: initialSlot, scope: 'priority', settings, lootLog, currentWeek, enhancedActive,
      });
      setSelectedId(initialEntries[0]?.player.id ?? null);
      setSearch('');
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
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen, currentWeek, mode, floors, item, players, settings, lootLog, enhancedActive]);

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

  const handleSubmit = async () => {
    if (!selected || !selectionVisible) return;
    const recipientPlayerId = selected.player.id;
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
          notes: mode === 'log'
            ? (notes || undefined)
            : (isWeapon && weaponJob ? `${weaponJob} weapon${effectiveExtra ? ' (extra)' : ''}` : undefined),
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
      {mode === 'assign' ? `Assign · ${label}` : 'Log a drop'}
    </span>
  );

  const buttonLabel = mode === 'log'
    ? 'Log drop'
    : (selected ? `Assign to ${selected.player.name}` : 'Assign');

  const footer = (
    <div className="space-y-3">
      <p className="text-xs text-text-tertiary">
        Logging marks the drop &amp; updates priority + BiS instantly.
      </p>
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

        {/* Log-mode item selectors */}
        {mode === 'log' && (
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
        <div className="text-xs font-bold uppercase tracking-wider text-text-tertiary">{listLabel}</div>
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
                    className="grid h-[30px] w-[30px] flex-none place-items-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: `var(--color-role-${role}, var(--color-text-muted))` }}
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
                    <span className="block truncate text-xs text-text-tertiary">{entry.reason}</span>
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

        {/* Details disclosure */}
        <LinkText onClick={() => setShowDetails((v) => !v)} aria-expanded={showDetails}>
          {showDetails ? 'Hide details' : 'Details'}
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

            {mode === 'log' && (
              <RadioGroup
                name="loot-method"
                label="Method"
                orientation="horizontal"
                value={method}
                onChange={(v) => setMethod(v as 'drop' | 'book')}
                options={[
                  { value: 'drop', label: 'Drop' },
                  { value: 'book', label: 'Book' },
                ]}
              />
            )}

            <Checkbox
              checked={updateGear}
              onChange={setUpdateGear}
              label={`Mark ${label} as acquired`}
            />

            {isWeapon && mode === 'assign' && (
              <Checkbox
                checked={effectiveExtra}
                onChange={setIsExtra}
                disabled={scope === 'offspec'}
                label="Extra loot (not BiS priority)"
              />
            )}

            {recipientRegistrations.length > 0 && (
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

            {mode === 'log' && (
              <div>
                <span className="mb-1 block text-sm text-text-secondary">Notes</span>
                <TextArea value={notes} onChange={setNotes} placeholder="Optional notes…" rows={2} />
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
