/**
 * Loot — v2 Loot screen assembly (F6d, spec §2 / §5.2 / §5.9; Phase-D D4).
 *
 * The ring-0 composition Task 10 passes as GroupViewContent's `gear` slot
 * (mirroring F6b `Home` / F6c `Roster`'s prop contract). It owns the screen's
 * modal state and the URL-backed Priority ⇄ Log ⇄ History view axis, and
 * sources every context value the three views need directly from stores +
 * hooks — the same derivations legacy `GroupViewContent` feeds, re-expressed
 * for the v2 floor grid (Priority), the week's record (Log) and the
 * transparent record (History).
 *
 * Boundary discipline (ring0): composes `loot/` siblings (LootToolbar /
 * WeekScopeControl / FloorCard / LogWeekGrid / RecipientPicker /
 * WeaponPriorityBridge / LootAdjustmentsModal / LogWeekWizard /
 * QuickLogMaterialModal / LootResetMenu / FairnessSummary / BookLedgerCard /
 * LootHistoryTable / HistoryFilters) + shared `ui/` (SegmentedToggle) + the
 * reused legacy confirm modals (DeleteLootConfirmModal, ResetConfirmModal,
 * ConfirmModal — read-only reuse, never edited), and reads STORES/HOOKS
 * directly (useWeekClock, useLogWeek, useUrlTabState, useLootTrackingStore,
 * useTierStore, useAuthStore, useViewAsStore, useSettingsPanelStore).
 *
 * Deliberate decisions (documented to pre-empt review false-positives):
 *   - ── The week belongs to the LOG tab (D4, R-15) ──
 *     There is no screen-level week scope any more; `scopedWeekOverride` is
 *     gone. `useLogWeek` is the whole model: a nullable override over
 *     `clock.currentWeek`, resolved `?week=` → `v2-history-week-{groupId}-
 *     {tierId}` (a week number, or the `'current'` sentinel meaning "follow
 *     the clock") → legacy `history-week-{groupId}-{tierId}` (read-only,
 *     continuity in and nothing out) → follow the clock. ONLY the Log tab
 *     renders a week control (`WeekScopeControl`): Priority is always the
 *     clock's current week (R-13/R-15), and History keeps its own filter row.
 *   - The wizard's week target is SPLIT (R-20): on Log it runs against the
 *     displayed week and its `onSuccess(week)` re-points the Log week to
 *     whatever week was logged; everywhere else it runs against the clock's
 *     current week and success moves nothing (there is nothing to move). The
 *     RecipientPicker's default week follows exactly the same rule.
 *   - ⚠ `?week=` is a SHARED URL param, and each shell both reads AND writes
 *     it: v2's Log persists it via `useLogWeek`, legacy's
 *     `history/HistoryView.tsx:105,132` does the same. The carrier is wider
 *     than a shell toggle — any navigation that leaves `?week=` intact
 *     reaches the other shell's reader: a shell toggle, a v2 primary-tab
 *     switch (not registered with `useUrlTabState`, see below), or a
 *     bookmark/paste. **v2's write side is narrower than "the Log persists
 *     it" implies:** the mirror is gated on the Log being the visible view
 *     (`mirrorToUrl`, the hook's 4th argument), so a tier switch made from
 *     Priority or History *deletes* `?week=` rather than writing one — v2
 *     only ever arms the legacy cohort below from a screen that can also
 *     disarm it (PR #235 review round 2). The read direction runs both ways
 *     too: a legacy-written `?week=` seeds v2's Log on mount the same way
 *     (`useLogWeek.ts`'s `resolveOverride` reads the raw param before ever
 *     touching v2/legacy storage — on the FIRST resolve only; tier/group
 *     re-resolves skip the URL by the hook's mount-only rule).
 *     For a v2-seeded `?week=` reaching legacy History, the outcome forks on
 *     whether that static+tier already has a `history-week-{groupId}-
 *     {tierId}` localStorage entry:
 *       - NO entry (a first-time visitor to that static+tier): self-
 *         correcting. HistoryView's URL-param read (:104-116) seeds
 *         `selectedWeek` from it, but the separate first-mount effect
 *         (:146-156, "only on first load (when no saved value)") finds
 *         nothing saved and calls `setSelectedWeek(currentWeek)` on the next
 *         render — discarding the seeded week and deleting `?week=` (:131-
 *         132) before the user does anything.
 *       - An entry EXISTS (any V1 user who has ever changed History's week):
 *         NOT self-correcting. `:150` skips the correction whenever `saved`
 *         is truthy, so the seeded week stays displayed in legacy History for
 *         the rest of the session — it only stops once the user manually
 *         picks a week, and even then `:122` persists THAT new pick, not the
 *         v2-seeded value that had been showing. This cohort's real risk is
 *         therefore a session-scoped wrong display, not a persisted bad
 *         value.
 *     This is disclosed, not avoided — the design record pins
 *     `lview=log&week=N`, so the name is ruled. `week` is deliberately NOT
 *     registered with `useUrlTabState`: that hook's `SEEDED_TAB_PARAMS` feeds
 *     `clearRegisteredTabParams`, which `setPageMode`
 *     (`useGroupViewState.ts:320`) calls on every primary-tab switch in BOTH
 *     shells — registering `week` would make a V1 tab switch start wiping
 *     legacy History's own `?week=`. `useLogWeek` uses raw `useSearchParams`.
 *   - The mount fetch effect double-fetches loot/material that legacy's own
 *     effect also covers under `pageMode`; v2 must not depend on legacy chrome
 *     ordering, and the fetches are idempotent.
 *   - `onNavigate` is part of the slot contract (Task 10, mirroring Roster/Home)
 *     but no view has a cross-tab affordance yet — reserved.
 *   - Only `lview` (Priority⇄Log⇄History) is URL-backed *through this hook*; the
 *     History filters are session-local `useState` (matches legacy filter
 *     locality). A fresh deep-link therefore always shows everything (filters
 *     default to all/all/all), so an `?entry=` deep-link can never be hidden by
 *     a filter on first mount; only a mid-session filter change can hide a row,
 *     which is acceptable.
 *   - D4/D5/D6a interims, so a reader doesn't mistake a stub for a gap: Log's
 *     body is `LogWeekGrid` (D5) — four floor sections, one cell per
 *     gear/material slot, wired below. D6a shipped the cell's modifier family
 *     (plain click edits, Shift+Click copies a deep link, Alt+Click jumps to
 *     the recipient's roster card, right-click/kebab opens the shared context
 *     menu) and the Log-side `?entry=` deep-link landing (validate → pulse →
 *     scroll → self-clear) below. Still open: the Books card and a
 *     displayed-week-bound reset menu are D7; a count bar/legend below the
 *     grid is D6b; the teaching tooltip and the recipient-badge hover-× are
 *     also D6b; the jump destination is card-level (`?player=`) until D12
 *     retargets it to slot-level anchors (R-28). "Log material" on Log — D4's
 *     other named gap — shipped in D8 (the toolbar's free-form door, below).
 *     `FairnessSummary` / `BookLedgerCard` / `LootResetMenu` therefore stay
 *     mounted on History here, and `LootResetMenu` stays bound to
 *     `clock.currentWeek`. A `week` param on Log positions the displayed
 *     week; a link whose `?entry=` resolves in a DIFFERENT week re-points the
 *     display to that entry's week instead (D6a — the landing entry always
 *     wins over a stale/hand-edited `?week=`, `Loot.tsx:629-704`). The
 *     correction itself does not resolve/fire until the week clock can
 *     honor the entry's week — see the "F1" comment ahead of the highlight
 *     derivation (D6a browser pass; a provisional clock must never clamp
 *     this correction, `useLogWeek.ts`'s own clamp-ceiling rule).
 *   - The Priority sub-view (Queues⇄Who Needs It⇄Weapons) persists per user
 *     under `v2-loot-priority-view` (R-1) — NOT URL-backed. Who Needs It is
 *     the landing view (R-1); an unset/unrecognized stored value (including a
 *     stale 'matrix' — the view's former name, no migration shim per R-P1)
 *     lands there too. The
 *     floor scope (R-2/R-10) is session-only state: per-view default until
 *     the first explicit pill click, global after it (R-10.2/R-10.3).
 *   - The book-row highlight (legacy `highlightedBookPlayerId`) is URL-backed in
 *     v2: the roster kebab's "Edit Books" jump (C7, D-05) writes `?book={playerId}`
 *     and `BookLedgerCard` owns the scroll + pulse + self-clear, exactly as
 *     `LootHistoryTable` owns `?entry=`. Loot itself stays out of it — the two
 *     highlights are mutually exclusive by construction (the roster card clears
 *     the other param on every jump), so no coordination lives here.
 *   - Material delete + the Reset "loot"/"data" paths always revert gear
 *     (`{ revertGear: true }`), matching the legacy reset semantics
 *     (`SectionedLogView.tsx:450-511`); the History reset reproduces exactly the
 *     six configs the LootResetMenu emits (week/all × loot/books/data).
 */

import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { ListChecks, Shield } from 'lucide-react';

import { PageHeader } from '../layout/PageHeader';
import { LootToolbar } from './LootToolbar';
import { WeekScopeControl } from './WeekScopeControl';
import { FloorCard } from './FloorCard';
import { LogWeekGrid } from './LogWeekGrid';
import { logCellDomId } from './logWeekGridData';
import { suggestedMaterialRecipient } from './materialSuggestion';
import { NeedMatrix } from './NeedMatrix';
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
import { Tag } from '../ui/Tag';
import { Button } from '../primitives/Button';
import { newestInProgressFloor, type FloorScope } from './priorityScope';
import { DeleteLootConfirmModal } from '../history/DeleteLootConfirmModal';
import { ResetConfirmModal, type ResetConfig } from '../ui/ResetConfirmModal';
import { ConfirmModal } from '../ui/ConfirmModal';

import { useWeekClock } from '../../hooks/useWeekClock';
import { useLogWeek } from './useLogWeek';
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
import {
  type FloorNumber, UPGRADE_MATERIAL_DISPLAY_NAMES, getFloorForUpgradeMaterial,
} from '../../gamedata/loot-tables';
import type {
  PageMode, SnapshotPlayer, StaticGroup, TierSnapshot, MaterialType, GearSlot, LootLogEntry,
  MaterialLogEntry,
} from '../../types';

const logger = baseLogger.scope('loot');

/** Stable empty fallback so a missing/empty tier doesn't churn memo deps. */
const EMPTY_PLAYERS: SnapshotPlayer[] = [];

/**
 * Builds a Loot deep-link URL from the CURRENT `window.location.href`
 * (`SectionedLogView.tsx:847-855` pattern) so existing params — notably
 * `?tier=` — survive, then sets/deletes only the params this link controls.
 * File-local, module scope (director F-17): shared by BOTH copy paths below
 * (the History `copyLink` this refactors onto it, and the Log grid's
 * `copyLogEntryLink`) so the two ~12-line near-clones the pre-D6a code held
 * don't drift apart.
 *
 * `shell` is always STRIPPED (coverage-plan D4): with the session-sticky
 * `?shell=` tier, a pinned value would lock the recipient's whole tab into
 * the sender's shell — links must respect the recipient's own preference.
 * `week` is set only when the caller passes one (the Log link always does;
 * History omits it — a HISTORY link has no week axis, and an emergent `week`
 * would silently ship the sender's Log week into legacy History's own
 * `?week=` reader too — the shipped ruling `copyLink`'s original comment
 * documented). `entryType` is ALWAYS set for a Log link (R-18 note 1 — the
 * `?entry=` consumption effect below needs it to disambiguate the two
 * independent id sequences) but keeps History's shipped omit-for-loot shape
 * otherwise.
 */
const buildEntryLink = (opts: { lview: 'log' | 'history'; week?: number; ref: HistoryItem }): string => {
  const url = new URL(window.location.href);
  url.searchParams.delete('shell');
  url.searchParams.set('tab', 'gear');
  url.searchParams.set('lview', opts.lview);
  if (opts.week != null) url.searchParams.set('week', String(opts.week));
  else url.searchParams.delete('week');
  url.searchParams.set('entry', String(opts.ref.entry.id));
  if (opts.lview === 'log' || opts.ref.kind === 'material') url.searchParams.set('entryType', opts.ref.kind);
  else url.searchParams.delete('entryType');
  return url.toString();
};

// ── Priority sub-view (R-1/R-3) ──
// Who Needs It (renamed from "Matrix") is the landing view (R-1) — the
// whole-tier read is its purpose. Queues/Weapons persist only once the user
// states an explicit choice.
type PriorityView = 'queues' | 'who-needs-it' | 'weapons';

// R-1: the choice "persists per user" → localStorage. Fresh v2 key, no legacy
// fallback read (plan §2.3 — legacy's `loot-priority-subtab` values don't map).
const PRIORITY_VIEW_KEY = 'v2-loot-priority-view';
// R-10: the explicit floor pick lives for "this session" → sessionStorage
// (plan §2.3 assigns it a fresh v2 key). Global, not per-tier: R-10.3 makes the
// user's pick global, and F1–F4 mean the same thing in every tier.
const FLOOR_SCOPE_KEY = 'v2-loot-floor-scope';

// Storage access is guarded: Safari private mode and blocked-storage embeds
// throw from the accessor itself, and a useState initializer that throws takes
// the whole screen down (review finding). Degrade to the default instead.
// R-1: Who Needs It is the landing view — unset/unknown lands there. All three
// view values are recognized as themselves ('who-needs-it' too, even though it
// coincides with the fallback today — an explicit choice must survive any
// future change of the landing default; PR #242 review).
// R-P1: no migration shim — a stale 'matrix' value (the view's former name)
// is just another unrecognized string, and self-heals to the default here.
function readStoredPriorityView(): PriorityView {
  try {
    const v = localStorage.getItem(PRIORITY_VIEW_KEY);
    return v === 'weapons' || v === 'queues' || v === 'who-needs-it' ? v : 'who-needs-it';
  } catch {
    return 'who-needs-it';
  }
}

function readStoredFloorScope(): FloorScope | null {
  try {
    const v = sessionStorage.getItem(FLOOR_SCOPE_KEY);
    if (v === 'all') return 'all';
    const n = Number(v);
    return n === 1 || n === 2 || n === 3 || n === 4 ? (n as FloorNumber) : null;
  } catch {
    return null;
  }
}

function writeStored(storage: 'local' | 'session', key: string, value: string): void {
  try {
    (storage === 'local' ? localStorage : sessionStorage).setItem(key, value);
  } catch {
    // Best-effort: an unwritable store just means the choice doesn't persist.
  }
}

const FLOOR_NUMBERS: FloorNumber[] = [1, 2, 3, 4];

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
  | { mode: 'assign'; item: DropItemContext; initialRecipientId?: string }
  | { mode: 'log' }
  | { mode: 'edit'; editEntry: LootLogEntry }
  | null;
// D8 Task 7: the free-form door joins the pinned cell door — both discriminated on `mode` so a
// cell-derived open always carries its `material`/`floorName`/`suggested` and a free-form open
// carries none of them (mirrors PickerState's discriminated-union precedent above). D5 adds the
// `edit` arm (R-21) alongside `allowSubs?: boolean` on the cell arm (R-D5a) — ONLY the Log grid's
// door sets it; the matrix/FloorCard cell doors below keep R-a's mainRosterPlayers inheritance by
// simply never setting it (undefined, not false — the modal's own type treats it as an opt-in).
type MaterialState =
  | { mode: 'cell'; material: MaterialType; floorName: string; suggested: SnapshotPlayer; allowSubs?: boolean }
  | { mode: 'freeform' }
  | { mode: 'edit'; editEntry: MaterialLogEntry }
  | null;

const HISTORY_SUBTITLE = 'Every drop, who received it, and why — the transparent record';
const LOG_SUBTITLE = "The week's record — every drop, book and material, floor by floor";

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

  // ── Priority ⇄ Log ⇄ History view (URL-backed) + session-local History filters ──
  // Declared before `useLogWeek` because the hook's `?week=` mirror is gated on
  // the Log being visible (below). `useUrlTabState` is pure URL derivation with
  // no effects of its own, so the ordering is free.
  const [lview, setLview] = useUrlTabState('lview', ['priority', 'log', 'history'] as const, 'priority');
  const [filters, setFilters] = useState(DEFAULT_HISTORY_FILTERS);

  // ── Shared week clock + the LOG TAB's displayed week (R-15) ──
  // The clock is screen-wide (Priority ranks against it, History reports it);
  // `logWeek` is the Log tab's own override over it, and nothing else on this
  // screen holds week state. The 4th argument is the URL-mirror gate: this hook
  // is mounted for the whole screen, but only the Log renders a week control, so
  // only the Log may leave `?week=` in the URL (see the ⚠ note in this file's
  // header and `useLogWeek.ts`'s "gated on the Log being VISIBLE"). Resolution
  // itself stays unconditional — the Log is correct the moment it is opened.
  const clock = useWeekClock(group.id, tier?.tierId);
  const logWeek = useLogWeek(group.id, tier?.tierId, clock, lview === 'log');

  // ── Own `useSearchParams()` (D6a Task 6) — the Log grid's jump/highlight
  // wiring, same independent-subscription pattern `useLogWeek`/`useUrlTabState`/
  // `RosterCard.tsx:280` already use rather than threading params down. ──
  const [searchParams, setSearchParams] = useSearchParams();
  // react-router's `setSearchParams` functional-form updater is bound to the
  // `searchParams` closed over by THIS specific `setSearchParams` reference
  // (react-router-dom's own `useCallback` deps are `[navigate, searchParams]`)
  // — it is not a live re-read at call time the way React's own `setState`
  // updater is. The `?entry=` effect's 2.5s-delayed clear (below) schedules
  // its `setSearchParams` call well after mount, so a closure captured back
  // when the effect first ran would strip against a STALE snapshot even
  // though it uses the functional syntax, clobbering any param written by an
  // intervening navigation (e.g. the user stepping the Log week while the
  // highlight is still pending). Updated on every render (not gated by any
  // effect's deps), so `.current` is always the freshest reference by the
  // time a delayed timer actually calls it. Synced via `useLayoutEffect`
  // (not a plain render-phase assignment) so the write only lands once React
  // has actually committed — a render-phase write would leave `.current`
  // pointing at an INTERRUPTED render's `setSearchParams` if React starts but
  // never commits one (react-router v7's `startTransition`-based navigation
  // makes this a real window, not just a defensive nicety).
  const setSearchParamsRef = useRef(setSearchParams);
  useLayoutEffect(() => {
    setSearchParamsRef.current = setSearchParams;
  });

  // ── Priority sub-view (persisted, R-1) + floor scope (session, R-2/R-10) ──
  const [priorityView, setPriorityView] = useState<PriorityView>(readStoredPriorityView);
  const changePriorityView = useCallback((v: PriorityView) => {
    setPriorityView(v);
    writeStored('local', PRIORITY_VIEW_KEY, v);
  }, []);
  // R-10: null = the user hasn't stated a scope this session (sessionStorage,
  // so the pick survives tab-hopping within the tab — "this session", R-10.3).
  // Until they do, Queues opens at the newest in-progress floor (one card, no
  // scroll). The first pill click ends that — the pick is global and switching
  // segments never moves it.
  const [pickedScope, setPickedScope] = useState<FloorScope | null>(readStoredFloorScope);
  const pickScope = useCallback((v: FloorScope) => {
    setPickedScope(v);
    writeStored('session', FLOOR_SCOPE_KEY, String(v));
  }, []);
  // The R-10 default is a LANDING default, not a live derivation (director
  // change-review F1): it is latched once per tier visit, when the mount fetch
  // settles. Deriving it live would let the user's first log on a floor move
  // the scope under them — logging the newest floor's drop re-derives "newest
  // in-progress" one floor up.
  const [landingScope, setLandingScope] = useState<FloorNumber | null>(null);
  // Pre-settle fallback only: renders the same value the latch will compute
  // whenever the store already holds this tier's data (the common warm path).
  const preSettleScope = useMemo(
    () => newestInProgressFloor({ lootLog, materialLog, pageLedger, floors }),
    [lootLog, materialLog, pageLedger, floors],
  );
  const queuesLanding = landingScope ?? preSettleScope;
  // R-10.2: until the user states a scope, each view opens at its own default —
  // Who Needs It → All (the whole-tier read is its purpose), Queues → the
  // newest in-progress floor. The first pill click (pickedScope) is global — R-10.3.
  const floorScope: FloorScope = pickedScope ?? (priorityView === 'who-needs-it' ? 'all' : queuesLanding);
  // R-7: the floor the "Log floor" button acts on. Weapons is pinned to the
  // final floor (R-5 states it); on All the button steps aside for the
  // toolbar's whole-week wizard.
  const logFloorTarget: FloorNumber | null =
    priorityView === 'weapons' ? 4 : floorScope !== 'all' ? floorScope : null;

  // ── Modal state (each surface owns an independent slot) ──
  const [pickerState, setPickerState] = useState<PickerState>(null);
  // `floor: null` = the whole-week wizard; a FloorNumber = R-7's single-floor run.
  const [wizardState, setWizardState] = useState<{ floor: FloorNumber | null } | null>(null);
  const [materialState, setMaterialState] = useState<MaterialState>(null);
  const [adjustmentsOpen, setAdjustmentsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HistoryItem | null>(null);
  const [resetConfig, setResetConfig] = useState<ResetConfig | null>(null);

  // Mount fetch — v2 must not depend on legacy chrome's own loot effect ordering.
  const groupId = group.id;
  const tierId = tier?.tierId;
  useEffect(() => {
    if (!groupId || !tierId) return;
    // A10: these four re-throw after recording store error state, but this
    // screen never renders lootTrackingStore.error — surface ONE toast for the
    // batch instead of letting a failure become an unhandled rejection.
    // fetchWeekDataTypes never re-throws (store catches internally) — left bare.
    setLandingScope(null); // a new tier derives its own landing default
    // Stale-response guard (PR #224 review): Loot mounts un-keyed
    // (NewShell.tsx:93), so a tier switch re-runs this effect on a live
    // component while the previous tier's chain may still be in flight. If the
    // old chain resolved last, its .then would read the NEW tier's store data
    // through the OLD tier's `floors` closure — no floor name matches, and it
    // would overwrite the correct latch with a lower floor.
    let cancelled = false;
    void Promise.all([
      fetchLootLog(groupId, tierId),
      fetchMaterialLog(groupId, tierId),
      fetchPageLedger(groupId, tierId),
      fetchCurrentWeek(groupId, tierId),
    ])
      .catch(() => toast.error('Failed to load loot data'))
      // R-10 landing latch — runs on success AND failure (a failed fetch still
      // latches from whatever the store holds, so the scope never moves later).
      .then(() => {
        if (cancelled) return;
        const s = useLootTrackingStore.getState();
        setLandingScope(
          newestInProgressFloor({
            lootLog: s.lootLog, materialLog: s.materialLog, pageLedger: s.pageLedger, floors,
          }),
        );
      });
    void fetchWeekDataTypes(groupId, tierId);
    return () => { cancelled = true; };
  }, [groupId, tierId, floors, fetchLootLog, fetchMaterialLog, fetchPageLedger, fetchCurrentWeek, fetchWeekDataTypes]);

  // Also refetches the week clock — the FIRST-ever loot entry for a tier can
  // set its `week_start_date` anchor server-side, which would otherwise leave
  // `weekStartDate`/`currentWeek` stale (wrong/missing week ranges) until a
  // remount. Every onSuccess (picker/material modal/wizard/weapon bridge)
  // routes through this one callback, so the fix covers all of them.
  const refresh = useCallback(() => {
    if (groupId && tierId) {
      void fetchTier(groupId, tierId);
      // A10: fetchCurrentWeek re-throws (fetchTier does not) — catch so a
      // failed week-clock refresh can't become an unhandled rejection.
      void fetchCurrentWeek(groupId, tierId).catch(() => toast.error('Failed to refresh the week clock'));
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

  // History-shaped link: no week (History has no week axis), entryType
  // omitted for loot (the shipped shape LootHistoryTable's highlight effect
  // already reads) — `buildEntryLink`'s doc comment carries the full rationale.
  const copyLink = useCallback((item: HistoryItem) => {
    navigator.clipboard.writeText(buildEntryLink({ lview: 'history', ref: item })).then(
      () => toast.success('Link copied'),
      () => toast.error("Couldn't copy the link"),
    );
  }, []);

  // D6a Task 6: the Log grid's copy-link door — same builder, `lview: 'log'`
  // + the DISPLAYED week (never `clock.currentWeek` — a Log link that always
  // pointed at "now" would dead-scroll the instant the sender is looking at
  // any other week, R-15's whole point). `entryType` is ALWAYS set for a Log
  // link (buildEntryLink's `opts.lview === 'log'` branch) — the `?entry=`
  // consumption effect below needs it to disambiguate the two independent id
  // sequences (F-10a).
  const copyLogEntryLink = useCallback((ref: HistoryItem) => {
    navigator.clipboard.writeText(buildEntryLink({ lview: 'log', week: logWeek.week, ref })).then(
      () => toast.success('Link copied'),
      () => toast.error("Couldn't copy the link"),
    );
  }, [logWeek.week]);

  // D6a Task 6: Alt+Click / context-menu "Jump to {name}" from the Log grid —
  // the same same-route URL-param jump `RosterCard.tsx:280-297` uses, landing
  // on the roster tab at that player. One navigation, one highlight: deletes
  // any leftover `entry`/`entryType`/`book` so a stale highlight from THIS
  // screen can't pulse a second target on the roster (director F-18).
  const jumpToRecipient = useCallback((playerId: string) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('tab', 'roster');
      params.set('player', playerId);
      params.delete('entry');
      params.delete('entryType');
      params.delete('book');
      return params;
    });
  }, [setSearchParams]);

  const requestDelete = useCallback((item: HistoryItem) => {
    setDeleteTarget(item);
  }, []);

  // D6a Task 6: literal wiring — `LogGridEntryRef` IS `HistoryItem` (director
  // F-12, `LootEntryRow.tsx`'s type alias), so the Log grid's delete door
  // reaches the SAME `deleteTarget` confirm-modal state History's delete door
  // does. No adapter, no cast.
  const deleteFromGrid = requestDelete;

  const playerNameFor = useCallback(
    (playerId: string, fallback: string) => players.find((p) => p.id === playerId)?.name ?? fallback,
    [players],
  );

  // ── Log `?entry=` deep-link (D6a Task 6) ──
  // Re-expresses `LootHistoryTable.tsx:60-103`'s contract for the Log view:
  // derived (not stored) so the highlight tracks the URL param directly, and
  // gated on `lview === 'log'` so History's own `?entry=` reader (same params,
  // different view) never sees a Log-originated id. `entryType` defaults to
  // 'loot'; validation runs against the UNFILTERED log MATCHING THE TYPE — a
  // loot id arriving as `entryType=material` resolves to nothing, and vice
  // versa, because the two id sequences are independent (F-10a).
  const entryParam = searchParams.get('entry');
  const entryType: 'loot' | 'material' = searchParams.get('entryType') === 'material' ? 'material' : 'loot';
  const parsedEntryId = entryParam ? parseInt(entryParam, 10) : null;
  const foundLootEntry =
    lview === 'log' && entryType === 'loot' && parsedEntryId != null && !Number.isNaN(parsedEntryId)
      ? lootLog.find((e) => e.id === parsedEntryId)
      : undefined;
  const foundMaterialEntry =
    lview === 'log' && entryType === 'material' && parsedEntryId != null && !Number.isNaN(parsedEntryId)
      ? materialLog.find((e) => e.id === parsedEntryId)
      : undefined;
  // F1 (D6a browser pass, live-reproduced): a cold `?week=`+`?entry=` landing
  // RACES the week clock. `lootTrackingStore` starts `currentWeek: 1, maxWeek:
  // 1` and only corrects once the async `fetchCurrentWeek` (mount effect,
  // above) resolves, so on the render(s) right after a fast log fetch beats a
  // slower clock fetch, `clock` is still provisional. Resolving the highlight
  // here regardless would let the OUT-OF-WEEK correction below (F-10b) fire
  // against that provisional clock: `useLogWeek.setWeek` clamps to `1 …
  // max(provisional maxWeek, provisional currentWeek)` (its own documented,
  // deliberate rule — see `useLogWeek.ts`'s doc header), lands exactly on the
  // provisional `currentWeek`, and treats that as "already current" —
  // clearing the override and writing the `'current'` sentinel into
  // `v2-history-week-*`. That DESTROYS the user's actual target week: once the
  // real clock arrives the display follows wherever "current" then resolves,
  // never the entry's own week, and the stored preference is gone. So: stay
  // unresolved (`null`) while the found entry's week exceeds what the clock
  // can currently vouch for (`Math.max(clock.maxWeek, clock.currentWeek)`,
  // the same ceiling `useLogWeek.setWeek` itself clamps against). This is a
  // RENDER-TIME guard, not a stored flag — `clock` is a hook dependency
  // (`useWeekClock` above), so its later arrival re-renders this derivation,
  // flipping `highlightId` from null to the real id with FRESH closures, and
  // the effect below then fires `setWeek` unclamped. A genuinely out-of-range
  // entry (corrupt link, week beyond the clock's real max) simply never
  // resolves — the same fate as any other invalid `?entry=` ("pointing at no
  // known entry" below): the params linger until the user navigates away.
  const foundEntryWeek = foundLootEntry?.weekNumber ?? foundMaterialEntry?.weekNumber;
  const clockCeiling = Math.max(clock.maxWeek, clock.currentWeek);
  const unresolvedByClock = foundEntryWeek != null && foundEntryWeek > clockCeiling;
  const highlightId: number | null =
    unresolvedByClock ? null : foundLootEntry?.id ?? foundMaterialEntry?.id ?? null;
  const highlightKind: 'loot' | 'material' | null =
    unresolvedByClock ? null : foundLootEntry ? 'loot' : foundMaterialEntry ? 'material' : null;
  const highlightEntry: { kind: 'loot' | 'material'; id: number } | null =
    highlightId != null && highlightKind != null ? { kind: highlightKind, id: highlightId } : null;

  useEffect(() => {
    if (highlightId == null || highlightKind == null) return;
    const found = highlightKind === 'material'
      ? materialLog.find((e) => e.id === highlightId)
      : lootLog.find((e) => e.id === highlightId);
    if (!found) return;

    // OUT-OF-WEEK (F-10b): the entry lives on a week the Log isn't currently
    // displaying — re-point the Log to it FIRST, so the scroll never targets
    // a cell that hasn't rendered (the link would otherwise dead-scroll).
    // This is a ONE-TIME correction on arrival, not a continuous sync — see
    // the deps note below for why `logWeek`/`setSearchParams` are read via
    // closure rather than listed reactively.
    if (found.weekNumber !== logWeek.week) {
      logWeek.setWeek(found.weekNumber);
    }

    const ref: HistoryItem = highlightKind === 'material'
      ? { kind: 'material', entry: found as MaterialLogEntry }
      : { kind: 'loot', entry: found as LootLogEntry };

    const scrollTimer = setTimeout(() => {
      document.getElementById(logCellDomId(ref))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);

    // Functional form + `{ replace: true }` (LootHistoryTable.tsx:91-96
    // precedent) THROUGH `setSearchParamsRef` (not the `setSearchParams`
    // closed over above) — an intervening write to OTHER params, notably
    // `useLogWeek`'s own `?week=` mirror or a manual week change via
    // WeekScopeControl while this highlight is still pending its self-clear,
    // survives. A non-functional strip built from a stale snapshot — or the
    // functional form called through a stale `setSearchParams` reference,
    // whose OWN closure over `prev` react-router fixed at THAT reference's
    // creation time (see `setSearchParamsRef`'s doc comment) — would silently
    // stomp whatever changed in between.
    const clearTimer = setTimeout(() => {
      setSearchParamsRef.current((prev) => {
        const params = new URLSearchParams(prev);
        params.delete('entry');
        params.delete('entryType');
        return params;
      }, { replace: true });
    }, 2500);

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
    // Deps are the id/kind PAIR only — this must fire exactly once per
    // highlighted-entry arrival, not every time `logWeek` happens to get a
    // new identity from an UNRELATED navigation (`logWeek` is a fresh object
    // every render — see useLogWeek.ts's own header; the `setSearchParams`
    // instability the ref above works around is the SAME class of issue).
    // Including `logWeek` here would re-fire this effect on every subsequent
    // navigation while a highlight is pending, re-applying the OUT-OF-WEEK
    // correction above and fighting a user's own later week change (a real
    // tug-of-war observed while developing this effect, not a hypothetical).
    // `lootLog`/
    // `materialLog` are read via closure too: `highlightId` is ITSELF derived
    // from them above, so by construction they're already fresh at the exact
    // render where `highlightId` transitions to a new value — the only
    // moment this effect body actually runs its lookup. `logWeek.setWeek` is
    // ALSO called from that same closure — this is correct ONLY because both
    // that call and the lookup above run SYNCHRONOUSLY in the effect body, at
    // the fresh render where `highlightId` just changed; the closures are
    // same-render fresh, not because a stale reference is safe to call later.
    // react-router's `setSearchParams` functional-form `prev` is a
    // closure-frozen snapshot bound at that specific reference's creation
    // time (confirmed empirically — see `setSearchParamsRef`'s doc comment
    // above), NOT a live re-read the way React's own `setState` updater is.
    // `logWeek.setWeek` has the same closure-capture shape internally. Do NOT
    // move either call into a `setTimeout` here without routing it through a
    // ref updated every render, the way the 2.5s clear below already does —
    // that is exactly the bug `setSearchParamsRef` was added to fix.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId, highlightKind]);

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

  // R-15/R-20's week-target split, shared by the picker and the wizard: a write
  // started from the LOG tab targets the week the user is looking at (the only
  // place a week is displayed and settable); anywhere else it targets the
  // clock's real current week, because that is the only week those views speak
  // for. `logWeek.week` already equals `clock.currentWeek` whenever the Log
  // isn't overridden, so this only diverges when the user has actually said so.
  const writeWeek = lview === 'log' ? logWeek.week : clock.currentWeek;

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
    currentWeek: writeWeek,
    maxWeek: clock.maxWeek,
    onSuccess: refresh,
  };

  return (
    <div data-testid="loot-screen">
      <PageHeader
        icon={<Shield size={14} className="text-accent" />}
        title="Loot"
        subtitle={lview === 'history' ? HISTORY_SUBTITLE : lview === 'log' ? LOG_SUBTITLE : subtitle}
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
                { value: 'log', label: 'Log' },
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
            ) : lview === 'log' ? (
              // R-13/R-15: the week control belongs to Log and ONLY to Log.
              // ⚠ `lootLog`/`materialLog`/`pageLedger` must stay the RAW store
              // slices: WeekScopeControl decides whether to show the revert
              // summary from freshly-fetched store state, while the summary
              // modal itemises from these props. A week-filtered or derived
              // list here would let the modal open on a positive pre-check and
              // then render "Nothing logged for Week N".
              <WeekScopeControl
                clock={clock}
                displayedWeek={logWeek.week}
                onWeekChange={logWeek.setWeek}
                onFollowClock={logWeek.followClock}
                canEdit={canEdit}
                canPrev={logWeek.canPrev}
                canNext={logWeek.canNext}
                groupId={group.id}
                tierId={tier.tierId}
                lootLog={lootLog}
                materialLog={materialLog}
                pageLedger={pageLedger}
                players={players}
              />
            ) : null
          }
          resetMenu={
            lview === 'history' && canEdit ? (
              <LootResetMenu week={clock.currentWeek} onSelect={setResetConfig} />
            ) : undefined
          }
          canEdit={canEdit}
          onLogDrop={() => setPickerState({ mode: 'log' })}
          // R-20/D8's carried "Log material": the free-form door targets `writeWeek` — the same
          // displayed-week split the picker/wizard already honor (R-20). R-b (2026-08-08, ruled
          // with R-a): both quick-log actions render on all three Loot views (this toolbar mounts
          // once, unconditioned on `lview`, matching "Log a drop"'s D4 precedent) — they move
          // together or not at all.
          onLogMaterial={() => setMaterialState({ mode: 'freeform' })}
          onLogWeek={() => setWizardState({ floor: null })}
          // The action names its week whenever it isn't "this week" — the same
          // honesty R-22 requires of the clock's mutations. Only Log can
          // diverge; everywhere else `writeWeek` IS the clock's current week.
          logWeekLabel={writeWeek === clock.currentWeek ? undefined : `Log Week ${writeWeek} loot`}
          onOpenAdjustments={() => setAdjustmentsOpen(true)}
          onOpenRules={openRules}
        />
      </div>

      {lview === 'priority' && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <SegmentedToggle
            size="sm"
            ariaLabel="Priority view"
            value={priorityView}
            onChange={changePriorityView}
            options={[
              { value: 'queues', label: 'Queues' },
              { value: 'who-needs-it', label: 'Who Needs It' },
              { value: 'weapons', label: 'Weapons' },
            ]}
          />
          {priorityView !== 'weapons' && (
            // R-2: one pill row scopes the whole Priority view.
            <div role="group" aria-label="Floor scope" className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs uppercase tracking-wide text-text-tertiary">Floor</span>
              <Tag variant="filter" tone="accent" pressed={floorScope === 'all'} onClick={() => pickScope('all')}>
                All
              </Tag>
              {FLOOR_NUMBERS.map((n) => (
                <Tag
                  key={n}
                  variant="filter"
                  tone={`floor-${n}`}
                  pressed={floorScope === n}
                  onClick={() => pickScope(n)}
                >
                  {floors[n - 1] ?? `Floor ${n}`}
                </Tag>
              ))}
            </div>
          )}
          {/* R-5: in Weapons the pill row is replaced in place by a static
              floor label — the scope is STATED, not implied by a control that
              could do nothing. The region itself is ALWAYS mounted (role=status
              ⇒ polite live region): a live region inserted pre-populated is not
              reliably announced, so the swap must be an insertion INTO an
              existing tracked region (a11y change-review finding). */}
          <div role="status" className="flex items-center gap-2">
            {priorityView === 'weapons' && (
              <>
                {/* No duty name (missing tier gamedata) → just "Floor 4", not
                    the redundant "Floor 4 · Floor 4" (PR #224 review). */}
                <Tag variant="label" tone="floor-4">{floors[3] ? `${floors[3]} · Floor 4` : 'Floor 4'}</Tag>
                <span className="text-xs text-text-tertiary">weapons drop here</span>
              </>
            )}
          </div>
          <div className="flex-1" />
          {canEdit && logFloorTarget !== null && (
            // The visible label names the target floor (mockup parity — the
            // aria-label-only floor left sighted users guessing).
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ListChecks className="h-3.5 w-3.5" aria-hidden />}
              onClick={() => setWizardState({ floor: logFloorTarget })}
            >
              {`Log floor — ${floors[logFloorTarget - 1] ?? `Floor ${logFloorTarget}`}`}
            </Button>
          )}
        </div>
      )}

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
      ) : lview === 'log' ? (
        <LogWeekGrid
          floors={floors}
          week={logWeek.week}
          lootLog={lootLog}
          materialLog={materialLog}
          players={players}
          canEdit={canEdit}
          canAssignMaterial={mainRosterPlayers.length > 0}
          onAssignGear={(item) =>
            setPickerState({
              mode: 'assign',
              item: { ...item, floorName: floors[item.floorNumber - 1] ?? `Floor ${item.floorNumber}` },
            })}
          onEditGear={(entry) => setPickerState({ mode: 'edit', editEntry: entry })}
          onAssignMaterial={(material, floorNumber) => {
            // R-D5c (user-ruled): the suggestion is CLOCK-week priority — "who is
            // up next now" — even when back-logging; the write itself targets the
            // displayed week (initialWeek).
            const suggested = suggestedMaterialRecipient({
              material, players: mainRosterPlayers, settings, lootLog, materialLog,
              currentWeek: clock.currentWeek,
            }) ?? mainRosterPlayers[0];
            if (!suggested) return; // unreachable behind canAssignMaterial — TS narrowing only
            setMaterialState({
              mode: 'cell', material,
              floorName: floors[floorNumber - 1] ?? `Floor ${floorNumber}`, suggested,
              allowSubs: true /* R-D5a: the grid door reaches subs */,
            });
          }}
          onEditMaterial={(entry) => setMaterialState({ mode: 'edit', editEntry: entry })}
          onCopyEntryLink={copyLogEntryLink}
          onJumpToPlayer={jumpToRecipient}
          onDeleteEntry={deleteFromGrid}
          highlightEntry={highlightEntry}
        />
      ) : priorityView === 'who-needs-it' ? (
        <NeedMatrix
          players={mainRosterPlayers}
          floorScope={floorScope}
          materialLog={materialLog}
          settings={settings}
          canEdit={canEdit}
          onLogGear={(item, playerId) =>
            setPickerState({
              mode: 'assign',
              item: { ...item, floorName: floors[item.floorNumber - 1] ?? `Floor ${item.floorNumber}` },
              initialRecipientId: playerId,
            })
          }
          onLogMaterial={(material, player) => {
            // The matrix has no per-floor card context — derive the material's home floor.
            const f = getFloorForUpgradeMaterial(material)[0];
            setMaterialState({ mode: 'cell', material, floorName: floors[f - 1] ?? `Floor ${f}`, suggested: player });
          }}
        />
      ) : priorityView === 'weapons' ? (
        // R-3: Weapons is a peer switcher segment — the bridge IS the view body
        // now, not a Floor-4 card footer.
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
      ) : (
        <div className="grid gap-3.5">
          {([4, 3, 2, 1] as FloorNumber[])
            .filter((n) => floorScope === 'all' || n === floorScope)
            .map((n) => (
            <FloorCard
              key={n}
              floorNumber={n}
              floorName={floors[n - 1] ?? `Floor ${n}`}
              players={mainRosterPlayers}
              settings={settings}
              lootLog={lootLog}
              materialLog={materialLog}
              pageLedger={pageLedger}
              // R-15: Priority is always the clock's current week — one week
              // prop, driving both the status chip and the enhance context.
              currentWeek={clock.currentWeek}
              canEdit={canEdit}
              // R-49: a solo-scoped card never auto-collapses — with one card
              // there is nothing for a cleared floor to get out of the way of,
              // and collapsing it lands the user on a nearly-empty screen.
              autoCollapse={floorScope === 'all'}
              onAssignGear={(item: { slot: GearSlot | 'ring'; label: string }) =>
                setPickerState({
                  mode: 'assign',
                  item: { ...item, floorName: floors[n - 1] ?? `Floor ${n}`, floorNumber: n },
                })
              }
              onAssignMaterial={(material, suggested) =>
                setMaterialState({ mode: 'cell', material, floorName: floors[n - 1] ?? `Floor ${n}`, suggested })
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
          initialRecipientId={pickerState.initialRecipientId}
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

      {/* One wizard, two doors (R-7): the toolbar's whole-week run, and the
          controls row's "Log floor" single-floor run. The wizard re-reads
          singleFloorMode/initialFloor on its open transition, so the always-
          mounted pattern is safe. R-20: it targets `writeWeek` — the Log tab's
          displayed week, or the clock elsewhere — and only a Log run re-points
          the displayed week on success (elsewhere there is no week shown to
          move, and moving one silently would be worse than moving none). */}
      <LogWeekWizard
        isOpen={wizardState !== null}
        onClose={() => setWizardState(null)}
        groupId={group.id}
        tierId={tier.tierId}
        players={mainRosterPlayers}
        settings={settings}
        floors={floors}
        currentWeek={writeWeek}
        maxWeek={clock.maxWeek}
        lootLog={lootLog}
        materialLog={materialLog}
        singleFloorMode={wizardState?.floor != null}
        initialFloor={wizardState?.floor ?? 1}
        onSuccess={(w) => { refresh(); if (lview === 'log') logWeek.setWeek(w); }}
      />

      {materialState?.mode === 'cell' && (
        <QuickLogMaterialModal
          isOpen
          onClose={() => setMaterialState(null)}
          groupId={group.id}
          tierId={tier.tierId}
          floor={materialState.floorName}
          material={materialState.material}
          maxWeek={clock.maxWeek}
          initialWeek={writeWeek}
          /* M4: every v2 write targets writeWeek */
          suggestedPlayer={materialState.suggested}
          // R-D5a: the rider only ever reaches this door via the Log grid's
          // `onAssignMaterial` above (allowSubs: true) — the matrix/FloorCard
          // cell doors below never set it, so `allPlayers` stays on
          // `mainRosterPlayers` for them (R-a preserved).
          allowSubs={materialState.allowSubs}
          allPlayers={materialState.allowSubs ? players : mainRosterPlayers}
          settings={settings}
          showNotes
          /* R-26: v2's cell door gains notes; V1's door passes neither prop */
          onSuccess={refresh}
        />
      )}
      {materialState?.mode === 'edit' && (
        <QuickLogMaterialModal
          isOpen
          onClose={() => setMaterialState(null)}
          groupId={group.id}
          tierId={tier.tierId}
          floors={floors}
          editEntry={materialState.editEntry}
          maxWeek={clock.maxWeek}
          allPlayers={players}
          /* §5(a): FULL roster — the entry's recipient may be a substitute, and
             the "Include substitutes" checkbox widens from here. §5(b)'s
             mid-edit identity churn is neutralized modal-side (Task 1). */
          settings={settings}
          onSuccess={refresh}
        />
      )}
      {materialState?.mode === 'freeform' && (
        <QuickLogMaterialModal
          isOpen
          onClose={() => setMaterialState(null)}
          groupId={group.id}
          tierId={tier.tierId}
          floors={floors}
          initialWeek={writeWeek}
          maxWeek={clock.maxWeek}
          allPlayers={players}
          /* R-a: full roster — the modal's includeSubs gate does the widening */
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
