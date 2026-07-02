/**
 * Loot — v2 Loot screen assembly (F6d, spec §2 / §5.2 / §5.9).
 *
 * The ring-0 composition Task 10 passes as GroupViewContent's `gear` slot
 * (mirroring F6b `Home` / F6c `Roster`'s prop contract). It owns the screen's
 * modal + week-scope state and the URL-backed Priority⇄History view axis, and
 * sources every context value both views need directly from stores + hooks —
 * the same derivations legacy `GroupViewContent` feeds, re-expressed for the v2
 * floor grid (Priority) and the transparent record (History).
 *
 * Boundary discipline (ring0): composes `loot/` siblings (LootToolbar /
 * WeekScopeControl / FloorCard / RecipientPicker / WeaponPriorityBridge /
 * LootAdjustmentsModal / LogWeekWizard / QuickLogMaterialModal / LootResetMenu /
 * FairnessSummary / BookLedgerCard / LootHistoryTable / HistoryFilters) + shared
 * `ui/` (SegmentedToggle) + the reused legacy confirm modals (DeleteLootConfirmModal,
 * ResetConfirmModal, ConfirmModal — read-only reuse, never edited), and reads
 * STORES/HOOKS directly (useWeekClock, useUrlTabState, useLootTrackingStore,
 * useTierStore, useAuthStore, useViewAsStore, useSettingsPanelStore).
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
 *     but neither view has a cross-tab affordance yet — reserved.
 *   - Only `lview` (Priority⇄History) is URL-backed; the History filters are
 *     session-local `useState` (matches legacy filter locality). A fresh
 *     deep-link therefore always shows everything (filters default to all/all/all),
 *     so an `?entry=` deep-link can never be hidden by a filter on first mount;
 *     only a mid-session filter change can hide a row, which is acceptable.
 *   - The book-row highlight FLASH (legacy `highlightedBookPlayerId`) is dropped
 *     in v2 — BookLedgerCard anchors rows (`id="book-row-…"`) but no v2 navigation
 *     produces a book highlight yet.
 *   - Material delete + the Reset "loot"/"data" paths always revert gear
 *     (`{ revertGear: true }`), matching the legacy reset semantics
 *     (`SectionedLogView.tsx:450-511`); the History reset reproduces exactly the
 *     six configs the LootResetMenu emits (week/all × loot/books/data).
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
import { LootResetMenu } from './LootResetMenu';
import { FairnessSummary } from './FairnessSummary';
import { BookLedgerCard } from './BookLedgerCard';
import { LootHistoryTable } from './LootHistoryTable';
import { HistoryFilters } from './HistoryFilters';
import type { HistoryItem } from './LootEntryRow';

import { SegmentedToggle } from '../ui/SegmentedToggle';
import { DeleteLootConfirmModal } from '../history/DeleteLootConfirmModal';
import { ResetConfirmModal, type ResetConfig } from '../ui/ResetConfirmModal';
import { ConfirmModal } from '../ui/ConfirmModal';

import { useWeekClock } from '../../hooks/useWeekClock';
import { useUrlTabState } from '../../hooks/useUrlTabState';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { useTierStore } from '../../stores/tierStore';
import { useAuthStore } from '../../stores/authStore';
import { useViewAsStore } from '../../stores/viewAsStore';
import { useSettingsPanelStore } from '../../stores/settingsPanelStore';
import { toast } from '../../stores/toastStore';

import { deleteLootAndRevertGear } from '../../utils/lootCoordination';
import { deleteMaterialAndRevertGear } from '../../utils/materialCoordination';
import { logger as baseLogger } from '../../lib/logger';
import { getTierById } from '../../gamedata/raid-tiers';
import { getEffectivePriorityMode } from '../../utils/priority';
import { DEFAULT_HISTORY_FILTERS, historyWeeks, buildHistoryItems } from '../../utils/historyItems';
import { DEFAULT_SETTINGS } from '../../utils/constants';
import { type FloorNumber, UPGRADE_MATERIAL_DISPLAY_NAMES } from '../../gamedata/loot-tables';
import type {
  PageMode, SnapshotPlayer, StaticGroup, TierSnapshot, MaterialType, GearSlot, LootLogEntry,
} from '../../types';

const logger = baseLogger.scope('loot');

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

// Discriminated so `mode: 'assign'` always carries its `item` and `mode: 'edit'`
// its `editEntry` — mirrors the RecipientPickerProps union (PR review finding:
// assign-mode item required; edit-mode editEntry required).
type PickerState =
  | { mode: 'assign'; item: DropItemContext }
  | { mode: 'log' }
  | { mode: 'edit'; editEntry: LootLogEntry }
  | null;
type MaterialState = { material: MaterialType; floorName: string; suggested: SnapshotPlayer } | null;

const HISTORY_SUBTITLE = 'Every drop, who received it, and why — the transparent record';

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

  // ── Effective viewer identity (BookLedgerCard's member-own-row exception) —
  // sourced exactly as Roster.tsx does. ──
  const user = useAuthStore((s) => s.user);
  const viewAsUser = useViewAsStore((s) => s.viewAsUser);
  const effectiveUserId = viewAsUser ? viewAsUser.userId : user?.id;

  // ── Shared week clock + local scope override ──
  const clock = useWeekClock(group.id, tier?.tierId);
  const [scopedWeekOverride, setScopedWeekOverride] = useState<number | null>(null);
  const scopedWeek = scopedWeekOverride ?? clock.currentWeek;

  // ── Priority ⇄ History view (URL-backed) + session-local History filters ──
  const [lview, setLview] = useUrlTabState('lview', ['priority', 'history'] as const, 'priority');
  const [filters, setFilters] = useState(DEFAULT_HISTORY_FILTERS);

  // ── Modal state (each surface owns an independent slot) ──
  const [pickerState, setPickerState] = useState<PickerState>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [materialState, setMaterialState] = useState<MaterialState>(null);
  const [adjustmentsOpen, setAdjustmentsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HistoryItem | null>(null);
  const [resetConfig, setResetConfig] = useState<ResetConfig | null>(null);

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

  // ── History handlers (edit / copy-link / delete / reset) ──
  const openEdit = useCallback((entry: LootLogEntry) => {
    setPickerState({ mode: 'edit', editEntry: entry });
  }, []);

  const copyLink = useCallback((item: HistoryItem) => {
    // v2 deep-link: build from the CURRENT URL (SectionedLogView.tsx:847-855
    // pattern) so existing params — notably `?tier=` — survive, then set/delete
    // only the params this link controls. Keeps legacy's `entry`/`entryType`
    // names (LootHistoryTable's highlight effect reads them) alongside v2's own
    // routing params.
    const url = new URL(window.location.href);
    url.searchParams.set('shell', 'v2');
    url.searchParams.set('tab', 'gear');
    url.searchParams.set('lview', 'history');
    url.searchParams.set('entry', String(item.entry.id));
    if (item.kind === 'material') url.searchParams.set('entryType', 'material');
    else url.searchParams.delete('entryType');
    void navigator.clipboard.writeText(url.toString());
    toast.success('Link copied');
  }, []);

  const requestDelete = useCallback((item: HistoryItem) => {
    setDeleteTarget(item);
  }, []);

  const playerNameFor = useCallback(
    (playerId: string, fallback: string) => players.find((p) => p.id === playerId)?.name ?? fallback,
    [players],
  );

  // Reproduces the legacy reset semantics (SectionedLogView.tsx:450-511) for the
  // six configs LootResetMenu emits (week/all × loot/books/data). Loot/data →
  // filter the logs by week (or all) and loop the coordination deletes with
  // `{ revertGear: true }`; books/data → clearWeekPageLedger / clearAllPageLedger.
  const handleResetConfirm = useCallback(async () => {
    if (!resetConfig || !tierId) return;
    const { scope, target, week } = resetConfig;
    const { clearAllPageLedger, clearWeekPageLedger } = useLootTrackingStore.getState();
    try {
      const shouldResetLoot = target === 'loot' || target === 'data';
      const shouldResetBooks = target === 'books' || target === 'data';

      if (shouldResetLoot) {
        // Read fresh from the store at confirm-time (legacy parity).
        const allLoot = useLootTrackingStore.getState().lootLog;
        const allMaterial = useLootTrackingStore.getState().materialLog;
        const lootEntries =
          scope === 'week' && week != null ? allLoot.filter((e) => e.weekNumber === week) : allLoot;
        const materialEntries =
          scope === 'week' && week != null ? allMaterial.filter((e) => e.weekNumber === week) : allMaterial;
        for (const entry of lootEntries) {
          await deleteLootAndRevertGear(groupId, tierId, entry.id, entry, { revertGear: true });
        }
        for (const entry of materialEntries) {
          await deleteMaterialAndRevertGear(groupId, tierId, entry.id, entry, { revertGear: true });
        }
      }

      if (shouldResetBooks) {
        if (scope === 'week' && week != null) await clearWeekPageLedger(groupId, tierId, week);
        else await clearAllPageLedger(groupId, tierId);
      }

      refresh();
      await fetchPageLedger(groupId, tierId);
      toast.success(`Reset ${scope === 'week' ? `Week ${week}` : 'all'} ${target} complete`);
    } catch (error) {
      logger.error('Reset failed:', error);
      toast.error('Reset failed');
    } finally {
      setResetConfig(null);
    }
  }, [resetConfig, groupId, tierId, refresh, fetchPageLedger]);

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
        subtitle={lview === 'history' ? HISTORY_SUBTITLE : subtitle}
      />

      <div className="mb-5">
        <LootToolbar
          viewToggle={
            <SegmentedToggle
              size="sm"
              ariaLabel="Loot view"
              value={lview}
              onChange={setLview}
              options={[
                { value: 'priority', label: 'Priority' },
                { value: 'history', label: 'History' },
              ]}
            />
          }
          weekControl={
            lview === 'history' ? (
              <HistoryFilters
                filters={filters}
                onChange={setFilters}
                weeks={historyWeeks(buildHistoryItems(lootLog, materialLog))}
                players={players.filter((p) => p.configured)}
              />
            ) : (
              <WeekScopeControl
                clock={clock}
                scopedWeek={scopedWeek}
                onScopedWeekChange={setScopedWeekOverride}
                canEdit={canEdit}
              />
            )
          }
          resetMenu={
            lview === 'history' && canEdit ? (
              <LootResetMenu week={clock.currentWeek} onSelect={setResetConfig} />
            ) : undefined
          }
          canEdit={canEdit}
          onLogDrop={() => setPickerState({ mode: 'log' })}
          onLogWeek={() => setWizardOpen(true)}
          onOpenAdjustments={() => setAdjustmentsOpen(true)}
          onOpenRules={openRules}
        />
      </div>

      {lview === 'history' ? (
        <div className="grid gap-3.5">
          <FairnessSummary
            players={mainRosterPlayers}
            settings={settings}
            lootLog={lootLog}
            materialLog={materialLog}
            pageLedger={pageLedger}
            currentWeek={clock.currentWeek}
            floors={floors}
          />
          <BookLedgerCard
            groupId={group.id}
            tierId={tier.tierId}
            players={players}
            floors={floors}
            currentWeek={clock.currentWeek}
            canEdit={canEdit}
            effectiveUserId={effectiveUserId}
          />
          <LootHistoryTable
            lootLog={lootLog}
            materialLog={materialLog}
            players={players}
            floors={floors}
            filters={filters}
            currentWeek={clock.currentWeek}
            rangeOfWeek={clock.rangeOfWeek}
            canEdit={canEdit}
            onEdit={openEdit}
            onCopyLink={copyLink}
            onDelete={requestDelete}
          />
        </div>
      ) : (
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
      )}

      {pickerState?.mode === 'assign' ? (
        <RecipientPicker
          isOpen
          onClose={() => setPickerState(null)}
          mode="assign"
          item={pickerState.item}
          {...pickerCommonProps}
        />
      ) : pickerState?.mode === 'edit' ? (
        <RecipientPicker
          isOpen
          onClose={() => setPickerState(null)}
          mode="edit"
          editEntry={pickerState.editEntry}
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

      {/* Delete — loot rows reuse the legacy DeleteLootConfirmModal (gear-revert
          checkbox); material rows use the lightweight ConfirmModal (legacy
          reset-path always reverts materials, so revertGear is fixed true). */}
      {deleteTarget?.kind === 'loot' && (
        <DeleteLootConfirmModal
          isOpen
          onClose={() => setDeleteTarget(null)}
          entry={deleteTarget.entry}
          playerName={playerNameFor(deleteTarget.entry.recipientPlayerId, deleteTarget.entry.recipientPlayerName)}
          onConfirm={async (revertGear) => {
            try {
              await deleteLootAndRevertGear(group.id, tier.tierId, deleteTarget.entry.id, deleteTarget.entry, { revertGear });
              toast.success('Loot entry deleted');
              refresh();
              setDeleteTarget(null);
            } catch {
              toast.error('Failed to delete entry');
            }
          }}
        />
      )}
      {deleteTarget?.kind === 'material' && (
        <ConfirmModal
          isOpen
          variant="danger"
          title="Delete material entry?"
          message={`Delete ${UPGRADE_MATERIAL_DISPLAY_NAMES[deleteTarget.entry.materialType]} for ${playerNameFor(deleteTarget.entry.recipientPlayerId, deleteTarget.entry.recipientPlayerName)}? This cannot be undone.`}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            try {
              await deleteMaterialAndRevertGear(group.id, tier.tierId, deleteTarget.entry.id, deleteTarget.entry, { revertGear: true });
              toast.success('Material entry deleted');
              refresh();
              setDeleteTarget(null);
            } catch {
              toast.error('Failed to delete entry');
            }
          }}
        />
      )}

      {resetConfig && (
        <ResetConfirmModal
          isOpen
          config={resetConfig}
          onConfirm={handleResetConfirm}
          onCancel={() => setResetConfig(null)}
        />
      )}
    </div>
  );
}
