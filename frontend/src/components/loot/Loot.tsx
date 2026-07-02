/**
 * Loot — v2 Loot · Priority screen assembly (F6d, spec §2 / §5.2).
 *
 * The ring-0 composition Task 10 passes as GroupViewContent's `gear` slot
 * (mirroring F6b `Home` / F6c `Roster`'s prop contract). It owns the screen's
 * modal + week-scope state and sources every context value the floor cards need
 * directly from stores + hooks — the same derivations legacy `GroupViewContent`
 * feeds `LootPriorityPanel`, re-expressed for the v2 floor grid.
 *
 * Boundary discipline (ring0): composes `loot/` siblings (LootToolbar /
 * WeekScopeControl / FloorCard / RecipientPicker / WeaponPriorityBridge /
 * LootAdjustmentsModal / LogWeekWizard / QuickLogMaterialModal) + the shell
 * `PageHeader`, and reads STORES/HOOKS directly (useWeekClock, useLootTrackingStore,
 * useTierStore, useSettingsPanelStore). It never imports a legacy body.
 *
 * Deliberate decisions (documented to pre-empt review false-positives):
 *   - `scopedWeek` is a LOCAL view override (null → follow the clock's current
 *     week). FloorCard status uses `scopedWeek`; its enhance context uses the
 *     REAL `clock.currentWeek` (drought is measured against "now", not the
 *     scoped view) — passed as FloorCard's `currentWeek` prop.
 *   - The RecipientPicker's default week (`currentWeek` prop) is the SCOPED week
 *     — logging a drop while viewing an older week should default to that week.
 *     This deliberately differs from FloorCard's enhance-context week; the
 *     picker's own ranking enhance uses this same scoped week (acceptable — the
 *     picker is an explicit, week-targeted action).
 *   - The mount fetch effect double-fetches loot/material that legacy's own
 *     effect also covers under `pageMode`; v2 must not depend on legacy chrome
 *     ordering, and the fetches are idempotent.
 *   - `onNavigate` is part of the slot contract (Task 10, mirroring Roster/Home)
 *     but the Priority view has no cross-tab affordance yet — reserved.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Shield } from 'lucide-react';

import { PageHeader } from '../layout/PageHeader';
import { LootToolbar } from './LootToolbar';
import { WeekScopeControl } from './WeekScopeControl';
import { FloorCard } from './FloorCard';
import { WeaponPriorityBridge } from './WeaponPriorityBridge';
import { RecipientPicker, type DropItemContext } from './RecipientPicker';
import { LootAdjustmentsModal, type AdjustmentUpdate } from './LootAdjustmentsModal';
import { LogWeekWizard } from './LogWeekWizard';
import { QuickLogMaterialModal } from './QuickLogMaterialModal';

import { useWeekClock } from '../../hooks/useWeekClock';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { useTierStore } from '../../stores/tierStore';
import { useSettingsPanelStore } from '../../stores/settingsPanelStore';
import { toast } from '../../stores/toastStore';

import { getTierById } from '../../gamedata/raid-tiers';
import { getEffectivePriorityMode } from '../../utils/priority';
import { DEFAULT_SETTINGS } from '../../utils/constants';
import { type FloorNumber } from '../../gamedata/loot-tables';
import type {
  PageMode, SnapshotPlayer, StaticGroup, TierSnapshot, MaterialType, GearSlot,
} from '../../types';

/** Stable empty fallback so a missing/empty tier doesn't churn memo deps. */
const EMPTY_PLAYERS: SnapshotPlayer[] = [];

/** Fairness-rules label shown in the subtitle, keyed by effective priority mode. */
const MODE_LABELS: Record<ReturnType<typeof getEffectivePriorityMode>, string> = {
  'role-based': 'role priority + need',
  automatic: 'role priority + need',
  manual: 'role priority + need',
  'job-based': 'job priority + need',
  'player-based': 'player priority + need',
  'manual-planning': 'manual planning',
  disabled: 'equal priority',
};

export interface LootProps {
  group: StaticGroup;
  tier: TierSnapshot | null;
  /** owner | lead | adminAccess — gates every log/assign/adjust affordance. */
  canEdit: boolean;
  /** Navigate to a primary tab (slot contract; unused in the Priority view). */
  onNavigate: (tab: PageMode, extra?: Record<string, string>) => void;
}

// Discriminated so `mode: 'assign'` always carries its `item` — mirrors the
// RecipientPickerProps union (PR review finding: assign-mode item required).
type PickerState = { mode: 'assign'; item: DropItemContext } | { mode: 'log' } | null;
type MaterialState = { material: MaterialType; floorName: string; suggested: SnapshotPlayer } | null;

export function Loot({ group, tier, canEdit }: LootProps) {
  // ── Derivations (mirror GroupViewContent; safe with a null tier) ──
  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...group.settings }), [group.settings]);
  const players = tier?.players ?? EMPTY_PLAYERS;
  const mainRosterPlayers = useMemo(
    () => players.filter((p) => p.configured && !p.isSubstitute),
    [players],
  );
  const tierInfo = tier ? getTierById(tier.tierId) : null;
  const floors = useMemo(() => tierInfo?.floors ?? [], [tierInfo]);

  // ── Stores (slice selectors — avoid churning the whole store reference) ──
  const lootLog = useLootTrackingStore((s) => s.lootLog);
  const materialLog = useLootTrackingStore((s) => s.materialLog);
  const pageLedger = useLootTrackingStore((s) => s.pageLedger);
  const fetchLootLog = useLootTrackingStore((s) => s.fetchLootLog);
  const fetchMaterialLog = useLootTrackingStore((s) => s.fetchMaterialLog);
  const fetchPageLedger = useLootTrackingStore((s) => s.fetchPageLedger);
  const fetchCurrentWeek = useLootTrackingStore((s) => s.fetchCurrentWeek);
  const fetchWeekDataTypes = useLootTrackingStore((s) => s.fetchWeekDataTypes);

  const fetchTier = useTierStore((s) => s.fetchTier);
  const updatePlayer = useTierStore((s) => s.updatePlayer);

  // ── Shared week clock + local scope override ──
  const clock = useWeekClock(group.id, tier?.tierId);
  const [scopedWeekOverride, setScopedWeekOverride] = useState<number | null>(null);
  const scopedWeek = scopedWeekOverride ?? clock.currentWeek;

  // ── Modal state (each surface owns an independent slot) ──
  const [pickerState, setPickerState] = useState<PickerState>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [materialState, setMaterialState] = useState<MaterialState>(null);
  const [adjustmentsOpen, setAdjustmentsOpen] = useState(false);

  // Mount fetch — v2 must not depend on legacy chrome's own loot effect ordering.
  const groupId = group.id;
  const tierId = tier?.tierId;
  useEffect(() => {
    if (!groupId || !tierId) return;
    void fetchLootLog(groupId, tierId);
    void fetchMaterialLog(groupId, tierId);
    void fetchPageLedger(groupId, tierId);
    void fetchCurrentWeek(groupId, tierId);
    void fetchWeekDataTypes(groupId, tierId);
  }, [groupId, tierId, fetchLootLog, fetchMaterialLog, fetchPageLedger, fetchCurrentWeek, fetchWeekDataTypes]);

  // Also refetches the week clock — the FIRST-ever loot entry for a tier can
  // set its `week_start_date` anchor server-side, which would otherwise leave
  // `weekStartDate`/`currentWeek` stale (wrong/missing week ranges) until a
  // remount. Every onSuccess (picker/material modal/wizard/weapon bridge)
  // routes through this one callback, so the fix covers all of them.
  const refresh = useCallback(() => {
    if (groupId && tierId) {
      void fetchTier(groupId, tierId);
      void fetchCurrentWeek(groupId, tierId);
    }
  }, [groupId, tierId, fetchTier, fetchCurrentWeek]);

  // Save adjustments through the SAME allSettled + per-failure toast semantics as
  // the legacy PlayerAdjustmentsModal (each update is an independent PUT).
  const handleSaveAdjustments = useCallback(async (updates: AdjustmentUpdate[]) => {
    if (!tierId) return;
    const results = await Promise.allSettled(
      updates.map((u) =>
        updatePlayer(groupId, tierId, u.playerId, {
          lootAdjustment: u.lootAdjustment,
          priorityModifier: u.priorityModifier,
        }),
      ),
    );
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) toast.error(`Failed to update ${failed.length} player(s)`);
  }, [groupId, tierId, updatePlayer]);

  const openRules = useCallback(() => {
    useSettingsPanelStore.getState().open({ tab: 'priority' });
  }, []);

  const subtitle = `Who's up next, and the record of what's dropped · fairness rules: ${MODE_LABELS[getEffectivePriorityMode(settings)]}`;

  // Empty-tier shell parity — legacy gates the loot region on a current tier.
  if (!tier) return <div data-testid="loot-screen" />;

  // Shared across both RecipientPicker render branches below (mode-specific
  // `item`/`isOpen` are supplied per-branch to satisfy the discriminated
  // RecipientPickerProps union).
  const pickerCommonProps = {
    groupId: group.id,
    tierId: tier.tierId,
    players,
    settings,
    floors,
    lootLog,
    currentWeek: scopedWeek,
    maxWeek: clock.maxWeek,
    onSuccess: refresh,
  };

  return (
    <div data-testid="loot-screen">
      <PageHeader
        icon={<Shield size={14} className="text-accent" />}
        title="Loot"
        subtitle={subtitle}
      />

      <div className="mb-5">
        <LootToolbar
          weekControl={
            <WeekScopeControl
              clock={clock}
              scopedWeek={scopedWeek}
              onScopedWeekChange={setScopedWeekOverride}
              canEdit={canEdit}
            />
          }
          canEdit={canEdit}
          onLogDrop={() => setPickerState({ mode: 'log' })}
          onLogWeek={() => setWizardOpen(true)}
          onOpenAdjustments={() => setAdjustmentsOpen(true)}
          onOpenRules={openRules}
        />
      </div>

      <div className="grid gap-3.5">
        {([4, 3, 2, 1] as FloorNumber[]).map((n) => (
          <FloorCard
            key={n}
            floorNumber={n}
            floorName={floors[n - 1] ?? `Floor ${n}`}
            players={mainRosterPlayers}
            settings={settings}
            lootLog={lootLog}
            materialLog={materialLog}
            pageLedger={pageLedger}
            scopedWeek={scopedWeek}
            currentWeek={clock.currentWeek}
            canEdit={canEdit}
            onAssignGear={(item: { slot: GearSlot | 'ring'; label: string }) =>
              setPickerState({
                mode: 'assign',
                item: { ...item, floorName: floors[n - 1] ?? `Floor ${n}`, floorNumber: n },
              })
            }
            onAssignMaterial={(material, suggested) =>
              setMaterialState({ material, floorName: floors[n - 1] ?? `Floor ${n}`, suggested })
            }
            footer={
              n === 4 ? (
                <WeaponPriorityBridge
                  players={mainRosterPlayers}
                  settings={settings}
                  groupId={group.id}
                  tierId={tier.tierId}
                  floors={floors}
                  maxWeek={clock.maxWeek}
                  canEdit={canEdit}
                  onLogSuccess={refresh}
                />
              ) : undefined
            }
          />
        ))}
      </div>

      {pickerState?.mode === 'assign' ? (
        <RecipientPicker
          isOpen
          onClose={() => setPickerState(null)}
          mode="assign"
          item={pickerState.item}
          {...pickerCommonProps}
        />
      ) : (
        <RecipientPicker
          isOpen={pickerState?.mode === 'log'}
          onClose={() => setPickerState(null)}
          mode="log"
          {...pickerCommonProps}
        />
      )}

      <LogWeekWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        groupId={group.id}
        tierId={tier.tierId}
        players={mainRosterPlayers}
        settings={settings}
        floors={floors}
        currentWeek={scopedWeek}
        maxWeek={clock.maxWeek}
        lootLog={lootLog}
        materialLog={materialLog}
        onSuccess={(w) => { refresh(); setScopedWeekOverride(w); }}
      />

      {materialState && (
        <QuickLogMaterialModal
          isOpen
          onClose={() => setMaterialState(null)}
          groupId={group.id}
          tierId={tier.tierId}
          floor={materialState.floorName}
          material={materialState.material}
          maxWeek={clock.maxWeek}
          suggestedPlayer={materialState.suggested}
          allPlayers={mainRosterPlayers}
          settings={settings}
          onSuccess={refresh}
        />
      )}

      <LootAdjustmentsModal
        isOpen={adjustmentsOpen}
        onClose={() => setAdjustmentsOpen(false)}
        players={mainRosterPlayers}
        onSave={handleSaveAdjustments}
      />
    </div>
  );
}
