/**
 * TeamSummaryCard (ring0 `home/`) — D13 / D-42
 *
 * v2's Team Summary: per-player gear %, book balances (I–IV) and material
 * balances (T/G/S) as current/needed, four aggregate tiles, a Team Total
 * footer and a "Mains only" filter. The behaviour reference is V1's frozen
 * `team/TeamSummaryEnhanced.tsx` (R-D13-A/B); every number comes from the
 * pure helpers in `./teamSummaryRows`, and `TeamSummaryCard.parity.test.tsx`
 * renders both against one seeded store and asserts they agree.
 *
 * Boundary discipline (ring0): reads the tier / loot-tracking / static-
 * character stores through selectors, composes shared `ui/` primitives, and
 * fetches nothing — Home owns the fetches (R-D13-G).
 */

import { useMemo, useState, type ReactNode } from 'react';
import { BookOpen, Target, Users, Wrench } from 'lucide-react';
import { CardShell } from '../ui/CardShell';
import { EmptyStateInvite } from '../ui/EmptyStateInvite';
import { JobIcon } from '../ui/JobIcon';
import { ProgressBar, type ProgressBarColor } from '../ui/ProgressBar';
import { Tag, type Tone } from '../ui/Tag';
import { Toggle } from '../ui/Toggle';
import { useTierPlayers } from '../../stores/tierStore';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { useStaticCharacterStore } from '../../stores/staticCharacterStore';
import { getTierById, type RaidTier } from '../../gamedata';
import type { StaticCharacterRegistration } from '../../types';
import {
  buildTeamSummaryRows,
  filterMainsOnly,
  roleLabelsByPlayer,
  teamSummaryTotals,
  type BookKey,
  type MaterialKey,
  type SummaryRoleLabel,
  type TeamSummaryRow,
} from './teamSummaryRows';

export interface TeamSummaryCardProps {
  groupId: string;
  tierId: string | undefined;
}

/**
 * Module-level empty registrations map. A `?? {}` inside the selector would
 * hand React a fresh object on every read and loop the first mount under
 * Zustand 5 + React 19 (precedent: `tierStore.ts` `EMPTY_PLAYERS`).
 */
const EMPTY_REGISTRATIONS: Record<string, StaticCharacterRegistration[]> = {};

/** One value column: the four book floors, then the three materials. */
type Column =
  | { kind: 'book'; key: BookKey; label: string; floorIndex: number; textClass: string }
  | { kind: 'material'; key: MaterialKey; label: string; textClass: string };

const COLUMNS: Column[] = [
  { kind: 'book', key: 'I', label: 'I', floorIndex: 0, textClass: 'text-floor-1' },
  { kind: 'book', key: 'II', label: 'II', floorIndex: 1, textClass: 'text-floor-2' },
  { kind: 'book', key: 'III', label: 'III', floorIndex: 2, textClass: 'text-floor-3' },
  { kind: 'book', key: 'IV', label: 'IV', floorIndex: 3, textClass: 'text-floor-4' },
  { kind: 'material', key: 'twine', label: 'T', textClass: 'text-material-twine' },
  { kind: 'material', key: 'glaze', label: 'G', textClass: 'text-material-glaze' },
  { kind: 'material', key: 'solvent', label: 'S', textClass: 'text-material-solvent' },
];

/** The full name a column header announces — the floor or the material. */
function columnName(column: Column, tier: RaidTier): string {
  return column.kind === 'book'
    ? tier.floors[column.floorIndex] ?? column.label
    : tier.upgradeMaterials[column.key];
}

/** Rows and totals share these four records, so one reader serves both. */
type ValueSource = Pick<TeamSummaryRow, 'booksBalance' | 'booksNeeded' | 'matsReceived' | 'matsNeeded'>;

function columnValues(source: ValueSource, column: Column): { current: number; needed: number } {
  return column.kind === 'book'
    ? { current: source.booksBalance[column.key], needed: source.booksNeeded[column.key] }
    : { current: source.matsReceived[column.key], needed: source.matsNeeded[column.key] };
}

const ROLE_CHIP: Record<SummaryRoleLabel, { text: string; tone: Tone }> = {
  main: { text: 'Main', tone: 'accent' },
  alt: { text: 'Alt', tone: 'info' },
  substitute: { text: 'Sub', tone: 'muted' },
};

type GearColor = Extract<ProgressBarColor, 'success' | 'warning' | 'accent' | 'muted'>;

/**
 * V1's per-row completion thresholds (`TeamSummaryEnhanced` `SummaryRow`),
 * expressed as token keys. Used for each player row only — the aggregate
 * tile and Team Total footer use their own, different V1 thresholds below.
 */
function gearColor(percent: number): GearColor {
  if (percent === 100) return 'success';
  if (percent >= 75) return 'warning';
  if (percent >= 50) return 'accent';
  return 'muted';
}

/**
 * V1's aggregate-tile thresholds ("BiS Progress" stat card): only 100% is
 * success, everything from 50% up is accent, no warning tier exists here.
 */
function tileGearColor(percent: number): GearColor {
  if (percent === 100) return 'success';
  if (percent >= 50) return 'accent';
  return 'muted';
}

/**
 * V1's Team Total footer thresholds: success at 100%, warning from 75%, and
 * no accent tier at all below that (unlike the row and tile helpers).
 */
function footerGearColor(percent: number): GearColor {
  if (percent === 100) return 'success';
  if (percent >= 75) return 'warning';
  return 'muted';
}

/** Text token paired with each bar colour; a low % stays readable (primary). */
const GEAR_TEXT_CLASS: Record<GearColor, string> = {
  success: 'text-status-success',
  warning: 'text-status-warning',
  accent: 'text-accent',
  muted: 'text-text-primary',
};

const VALUE_CELL_CLASS = 'px-2 py-2 text-center text-sm tabular-nums';

/** `current/needed` for a player row: `-` when nothing is needed, green once met. */
function ValueCell({ current, needed, textClass }: { current: number; needed: number; textClass: string }) {
  if (needed === 0) {
    return (
      <td className={VALUE_CELL_CLASS}>
        <span className="text-text-muted">-</span>
      </td>
    );
  }
  return (
    <td className={VALUE_CELL_CLASS}>
      <span className={current >= needed ? 'text-status-success font-medium' : textClass}>{current}</span>
      <span className="text-text-muted">/{needed}</span>
    </td>
  );
}

/** `balance/needed` sum for the Team Total footer: always both numbers, column-coloured. */
function TotalCell({ current, needed, textClass }: { current: number; needed: number; textClass: string }) {
  return (
    <td className={`${VALUE_CELL_CLASS} font-medium ${textClass}`}>
      {current}
      <span className="text-text-muted">/{needed}</span>
    </td>
  );
}

/** Color is always passed in — row, tile and footer each use a different V1 threshold helper. */
function GearPercent({ percent, color, className = '' }: { percent: number; color: GearColor; className?: string }) {
  return (
    <span className={`text-sm font-bold tabular-nums ${GEAR_TEXT_CLASS[color]} ${className}`}>
      {percent}%
    </span>
  );
}

/** One aggregate tile. Local: there is no shared stat-tile primitive yet. */
function StatTile({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-base p-3">
      <dt className="flex items-center gap-2 text-xs text-text-secondary">
        <span className="text-text-tertiary" aria-hidden="true">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 text-xl font-display font-bold tabular-nums text-text-primary leading-none">
        {children}
      </dd>
    </div>
  );
}

/** The muted `/denominator` that follows a tile's headline number. */
function Denominator({ value }: { value: ReactNode }) {
  return <span className="text-sm font-normal text-text-muted">/{value}</span>;
}

function SummaryRow({ row, chip }: { row: TeamSummaryRow; chip: SummaryRoleLabel | undefined }) {
  const { player, gearPercent } = row;
  return (
    <tr className="transition-colors hover:bg-surface-elevated/50">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2 whitespace-nowrap">
          <JobIcon job={player.job} size="sm" />
          <span className="text-sm font-medium text-text-primary">{player.name}</span>
          {chip && (
            <Tag variant="label" tone={ROLE_CHIP[chip].tone}>
              {ROLE_CHIP[chip].text}
            </Tag>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <GearPercent percent={gearPercent} color={gearColor(gearPercent)} className="min-w-[2rem]" />
          <ProgressBar
            value={gearPercent / 100}
            color={gearColor(gearPercent)}
            ariaLabel={`${player.name} BiS progress`}
            className="min-w-[60px] flex-1"
          />
        </div>
      </td>
      {COLUMNS.map((column) => (
        <ValueCell key={column.key} {...columnValues(row, column)} textClass={column.textClass} />
      ))}
    </tr>
  );
}

export function TeamSummaryCard({ groupId, tierId }: TeamSummaryCardProps) {
  const players = useTierPlayers();
  const pageBalances = useLootTrackingStore((s) => s.pageBalances);
  const materialBalances = useLootTrackingStore((s) => s.materialBalances);
  const registrations =
    useStaticCharacterStore((s) => s.registrationsByGroup[groupId]) ?? EMPTY_REGISTRATIONS;
  // Local, off by default, not persisted (V1 parity).
  const [mainsOnly, setMainsOnly] = useState(false);

  const rows = useMemo(
    () => buildTeamSummaryRows(players, pageBalances, materialBalances),
    [players, pageBalances, materialBalances],
  );
  const visibleRows = useMemo(
    () => (mainsOnly ? filterMainsOnly(rows, registrations) : rows),
    [rows, mainsOnly, registrations],
  );
  const totals = useMemo(() => teamSummaryTotals(visibleRows), [visibleRows]);
  const chips = useMemo(() => roleLabelsByPlayer(registrations), [registrations]);

  const tier = tierId ? getTierById(tierId) : undefined;
  if (!tier) return null;

  // The empty state is decided on the unfiltered rows (V1 `:341`): "Mains
  // only" with zero mains still shows the table, with no body rows.
  const isEmpty = rows.length === 0;
  const hasRegistrations = Object.keys(registrations).length > 0;
  const avgColor = tileGearColor(totals.gearPercent);

  return (
    <CardShell
      title="Team Summary"
      icon={<Users size={14} />}
      headerRight={
        hasRegistrations && !isEmpty ? (
          <Toggle size="sm" label="Mains only" checked={mainsOnly} onChange={setMainsOnly} />
        ) : undefined
      }
    >
      <p className="text-xs text-text-tertiary leading-snug">
        Book and material progress for all players. Values show current balance vs. needed.
      </p>

      {isEmpty ? (
        <EmptyStateInvite
          icon={<Users className="h-5 w-5" />}
          title="No configured players"
          description="Progress appears once players on this static are configured."
        />
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile icon={<Users size={14} />} label="Players">
              {totals.playerCount}
              <Denominator value={8} />
            </StatTile>
            <StatTile icon={<Target size={14} />} label="Avg BiS progress">
              <span className={GEAR_TEXT_CLASS[avgColor]}>{totals.gearPercent}%</span>
              <ProgressBar
                value={totals.gearPercent / 100}
                color={avgColor}
                ariaLabel="Average BiS progress"
                className="mt-2"
              />
            </StatTile>
            <StatTile icon={<BookOpen size={14} />} label="Books collected">
              {totals.booksHave}
              <Denominator value={totals.booksNeed} />
            </StatTile>
            <StatTile icon={<Wrench size={14} />} label="Materials received">
              {totals.matsHave}
              <Denominator value={totals.matsNeed} />
            </StatTile>
          </dl>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full">
              <caption className="sr-only">Per-player gear, book and material progress</caption>
              <thead>
                <tr className="border-b border-border-default">
                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-text-secondary">
                    Player
                  </th>
                  <th scope="col" className="min-w-[140px] px-3 py-2 text-left text-xs font-medium text-text-secondary">
                    Gear
                  </th>
                  {COLUMNS.map((column) => {
                    const name = columnName(column, tier);
                    return (
                      <th
                        key={column.key}
                        scope="col"
                        title={name}
                        aria-label={name}
                        className={`px-2 py-2 text-center text-xs font-medium ${column.textClass}`}
                      >
                        {column.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {visibleRows.map((row) => (
                  <SummaryRow
                    key={row.player.id}
                    row={row}
                    chip={mainsOnly ? undefined : chips[row.player.id]}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border-default">
                  <th scope="row" className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">
                    Team Total
                  </th>
                  <td className="px-3 py-2">
                    <GearPercent percent={totals.gearPercent} color={footerGearColor(totals.gearPercent)} />
                  </td>
                  {COLUMNS.map((column) => (
                    <TotalCell key={column.key} {...columnValues(totals, column)} textClass={column.textClass} />
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-tertiary">
            <span>I–IV = Books (Floor 1–4)</span>
            <span className="text-material-twine">T = {tier.upgradeMaterials.twine}</span>
            <span className="text-material-glaze">G = {tier.upgradeMaterials.glaze}</span>
            <span className="text-material-solvent">S = {tier.upgradeMaterials.solvent}</span>
            <span className="text-status-success">Green = Complete</span>
          </div>
        </>
      )}
    </CardShell>
  );
}
