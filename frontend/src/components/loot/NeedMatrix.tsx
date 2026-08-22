/**
 * NeedMatrix — v2's Who-Needs-It matrix (Phase-D D3; R-48). Net-new per R-48:
 * legacy WhoNeedsItMatrix is frozen and V1-only. Differences from legacy are
 * ruled, not accidental: R-8/R-9 floor-coloured names + neutral slot icons
 * (always, not only when scoped), R-11 roster-size Need denominator, rows
 * band by floor F4→F1 (user-ruled at D3 build), scoping HIGHLIGHTS rows (the
 * D1 pill row is the scope control — R-48 rules FilterBar out): every row
 * stays mounted, the selected floor's rows get the floor-accent edge, and
 * every other row dims + disables its log affordances (R-P3/R-V4, matching
 * V1's `WhoNeedsItMatrix.tsx` opacity/disabled treatment), cells route
 * through the picker (R-4) instead of writing directly, and the ring row
 * hands the picker slot 'ring' (it resolves ring1/ring2 itself).
 */
import { useMemo } from 'react';
import { Tooltip, IconButton } from '../primitives';
import { Tag } from '../ui';
import { GearSlotIcon } from '../ui/GearSlotIcon';
import { JobIcon } from '../ui/JobIcon';
import { getValidRole } from '../../gamedata';
import { FLOOR_TEXT_CLASS, FLOOR_ACCENT_CLASS } from './floorClasses';
import { MATERIAL_TOKEN } from './FloorDropRow';
import { sortByPosition, buildGearMatrixRows, buildMaterialMatrixRows } from './needMatrixData';
import type { FloorScope } from './priorityScope';
import type { FloorNumber, UpgradeMaterialType } from '../../gamedata/loot-tables';
import type { SnapshotPlayer, StaticSettings, MaterialLogEntry, GearSlot } from '../../types';

export interface NeedMatrixProps {
  /** Main roster (configured, non-substitute) — any order; sorted by position inside. */
  players: SnapshotPlayer[];
  floorScope: FloorScope;
  materialLog: MaterialLogEntry[];
  settings: StaticSettings;
  canEdit: boolean;
  onLogGear: (item: { slot: GearSlot | 'ring'; label: string; floorNumber: FloorNumber }, playerId: string) => void;
  onLogMaterial: (material: UpgradeMaterialType, player: SnapshotPlayer) => void;
}

/** Role-colored ring, never a fill — mirrors PriorityRow's contrast-safe avatar treatment. */
const roleVar = (player: SnapshotPlayer) => `var(--color-role-${getValidRole(player.role)}, var(--color-text-muted))`;

/**
 * The needer dot: a role-colored ring + role-tint fill around a role-colored
 * center — V1's cell treatment (`WhoNeedsItMatrix.tsx:392-405`: 2px solid
 * ring, `color-mix(role 30%, transparent)` fill, solid role-colored inner
 * dot), re-expressed v2-owned. File-local — one shape, two contexts (live
 * cell + legend sample).
 */
function NeedDot({ roleVar: color }: { roleVar: string }) {
  return (
    <span
      aria-hidden
      className="grid h-6 w-6 place-items-center rounded-full border-2"
      style={{ borderColor: color, backgroundColor: `color-mix(in srgb, ${color} 30%, transparent)` }}
    >
      <span className="block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
    </span>
  );
}

/**
 * The material progress ring: `total` segments around a donut, the first
 * `needed` bright (role colour, still owed) and the rest dim (same colour,
 * low opacity — already applied). Restores v1's material progress-pie
 * treatment (WhoNeedsItMatrix's MaterialPieIndicator), re-expressed with a
 * DIFFERENT mechanism — a CSS conic-gradient built from per-segment degree
 * stops, no SVG and no stroke-dasharray/stroke-dashoffset math (jscpd gate:
 * same idea, no shared code). `total === 1` collapses to a single full-ring
 * segment. The center count is a plain overlaid span, never SVG <text> or a
 * colour fill behind it — the contrast rule: role colour is never a fill
 * behind text.
 */
function MaterialProgressRing({ roleVar: color, total, needed }: { roleVar: string; total: number; needed: number }) {
  const segments = Math.max(total, 1);
  const segDeg = 360 / segments;
  const gapDeg = segments > 1 ? 8 : 0;
  const stops: string[] = [];
  for (let i = 0; i < segments; i++) {
    const bright = i < needed;
    const segColor = bright ? color : `color-mix(in srgb, ${color} 28%, transparent)`;
    const segStart = i * segDeg + gapDeg / 2;
    const segEnd = (i + 1) * segDeg - gapDeg / 2;
    stops.push(`transparent ${i * segDeg}deg ${segStart}deg`, `${segColor} ${segStart}deg ${segEnd}deg`, `transparent ${segEnd}deg ${(i + 1) * segDeg}deg`);
  }
  return (
    <span
      aria-hidden
      className="relative grid h-6 w-6 place-items-center rounded-full"
      style={{ background: `conic-gradient(${stops.join(', ')})` }}
    >
      <span className="absolute inset-1 rounded-full bg-surface-interactive" />
      <span className="relative text-xs font-bold text-text-primary">{needed}</span>
    </span>
  );
}

/** The "not a needer" cell — same footprint as NeedDot, neutral instead of role-colored. */
function EmptyDot() {
  return <span aria-hidden className="mx-auto block h-6 w-6 rounded-full border border-border-subtle bg-surface-interactive" />;
}

/**
 * R-P3/R-V4: is this row relevant to the selected floor? `'all'` makes every
 * row relevant (today's unscoped render, unchanged). Irrelevant rows stay
 * mounted — the caller dims them and disables their log affordances instead
 * of unmounting them, matching V1's `WhoNeedsItMatrix.tsx` opacity-30 /
 * disabled treatment (`:358,446` / `:391,480`).
 */
function isRowRelevant(rowFloors: FloorNumber | FloorNumber[], floorScope: FloorScope): boolean {
  if (floorScope === 'all') return true;
  return Array.isArray(rowFloors) ? rowFloors.includes(floorScope) : rowFloors === floorScope;
}

export function NeedMatrix(props: NeedMatrixProps) {
  const { players, floorScope, materialLog, settings, canEdit, onLogGear, onLogMaterial } = props;

  const sorted = useMemo(() => sortByPosition(players), [players]);
  const gearRows = useMemo(() => buildGearMatrixRows(sorted, settings), [sorted, settings]);
  const materialRows = useMemo(() => buildMaterialMatrixRows(sorted, materialLog), [sorted, materialLog]);

  if (players.length === 0) {
    return (
      <div className="overflow-hidden rounded-lg border border-border-default bg-surface-card p-4">
        <p className="text-sm text-text-muted">No configured players on the roster yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border-default bg-surface-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Who needs each drop — one column per roster player</caption>
          <thead>
            <tr>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-text-muted">Slot</th>
              {sorted.map((player) => (
                <th
                  key={player.id}
                  scope="col"
                  aria-label={`${player.position ?? '?'} ${player.name}`}
                  className="px-2 py-2.5 text-center align-bottom"
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="flex items-center gap-1">
                      <JobIcon job={player.job} size="sm" />
                      <span className="text-sm font-bold" style={{ color: roleVar(player) }}>
                        {player.position ?? '?'}
                      </span>
                    </div>
                    <span className="block truncate text-xs text-text-muted" title={player.name}>
                      {player.name.split(' ')[0]}
                    </span>
                  </div>
                </th>
              ))}
              <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-text-muted">Need</th>
            </tr>
          </thead>
          <tbody>
            {gearRows.map((row) => {
              const relevant = isRowRelevant(row.floorNumber, floorScope);
              return (
              <tr
                key={`${row.slot}-${row.floorNumber}`}
                className={`border-t border-border-subtle ${relevant ? '' : 'opacity-30'}`}
              >
                <th
                  scope="row"
                  aria-label={row.label}
                  className={`px-3 py-2 text-left font-medium ${floorScope !== 'all' && relevant ? FLOOR_ACCENT_CLASS[floorScope] : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-text-secondary"><GearSlotIcon slot={row.slot} size={18} /></span>
                    <span className={`text-sm font-semibold ${FLOOR_TEXT_CLASS[row.floorNumber]}`}>{row.label}</span>
                  </div>
                </th>
                {sorted.map((player) => {
                  const needs = row.needers.has(player.id);
                  return (
                    <td key={player.id} className="px-2 py-2 text-center">
                      {!needs ? (
                        <EmptyDot />
                      ) : canEdit ? (
                        <Tooltip content={`Log ${row.label} for ${player.name}`}>
                          <IconButton
                            variant="ghost"
                            size="sm"
                            aria-label={`Log ${row.label} for ${player.name}`}
                            icon={<NeedDot roleVar={roleVar(player)} />}
                            disabled={!relevant}
                            onClick={() => onLogGear({ slot: row.slot, label: row.label, floorNumber: row.floorNumber }, player.id)}
                          />
                        </Tooltip>
                      ) : (
                        <>
                          {/* mx-auto lives on this wrapper, not the dot component —
                              the dot's grid root is block-level (td text-center can't
                              centre it), and auto margins on the component itself
                              would break the legend's flex rows (PR review). */}
                          <span className="mx-auto block w-6">
                            <NeedDot roleVar={roleVar(player)} />
                          </span>
                          <span className="sr-only">{player.name} needs {row.label}</span>
                        </>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-center">
                  {row.needers.size === 0 ? (
                    <Tag variant="label" tone="success">FREE</Tag>
                  ) : (
                    <span
                      className={
                        row.needers.size >= Math.ceil(sorted.length / 2)
                          ? 'font-medium text-status-warning'
                          : 'text-text-muted'
                      }
                    >
                      {row.needers.size}/{sorted.length}
                    </span>
                  )}
                </td>
              </tr>
              );
            })}

            {materialRows.length > 0 && (
              <tr>
                <th
                  colSpan={sorted.length + 2}
                  scope="colgroup"
                  aria-label="Materials"
                  className="px-3 pt-3 pb-1 text-left"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Materials</span>
                </th>
              </tr>
            )}
            {materialRows.map((row) => {
              const token = MATERIAL_TOKEN[row.material];
              const relevant = isRowRelevant(row.floorNumbers, floorScope);
              return (
                <tr
                  key={row.material}
                  className={`border-t border-border-subtle ${relevant ? '' : 'opacity-30'}`}
                >
                  <th
                    scope="row"
                    aria-label={row.label}
                    className={`px-3 py-2 text-left font-medium ${floorScope !== 'all' && relevant ? FLOOR_ACCENT_CLASS[floorScope] : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="grid h-6 w-6 place-items-center rounded font-display text-xs font-extrabold"
                        style={{ backgroundColor: `color-mix(in srgb, ${token} 22%, transparent)`, color: token }}
                      >
                        {row.label.slice(0, 1)}
                      </span>
                      <span className="text-sm font-semibold text-text-primary">{row.label}</span>
                    </div>
                  </th>
                  {sorted.map((player) => {
                    const progress = row.counts.get(player.id);
                    if (!progress) {
                      return (
                        <td key={player.id} className="px-2 py-2 text-center">
                          <EmptyDot />
                        </td>
                      );
                    }
                    const { needed, total } = progress;
                    const progressSuffix = total > 1 ? ` of ${total}` : '';
                    return (
                      <td key={player.id} className="px-2 py-2 text-center">
                        {canEdit ? (
                          <Tooltip content={`Log ${row.label} for ${player.name} — needs ${needed}${progressSuffix}`}>
                            <IconButton
                              variant="ghost"
                              size="sm"
                              aria-label={`Log ${row.label} for ${player.name} — needs ${needed}${progressSuffix}`}
                              icon={<MaterialProgressRing roleVar={roleVar(player)} total={total} needed={needed} />}
                              disabled={!relevant}
                              onClick={() => onLogMaterial(row.material, player)}
                            />
                          </Tooltip>
                        ) : (
                          <>
                            {/* Same centring wrapper as the read-only gear cell. */}
                            <span className="mx-auto block w-6">
                              <MaterialProgressRing roleVar={roleVar(player)} total={total} needed={needed} />
                            </span>
                            <span className="sr-only">{player.name} needs {needed}{progressSuffix} {row.label}</span>
                          </>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center">
                    {row.totalNeeded === 0 ? (
                      <Tag variant="label" tone="success">FREE</Tag>
                    ) : (
                      <Tooltip
                        content={`${row.counts.size} player${row.counts.size === 1 ? '' : 's'} need ${row.totalNeeded} total`}
                      >
                        <span className="text-text-muted">{row.totalNeeded}</span>
                      </Tooltip>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-border-subtle px-3 py-2 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <NeedDot roleVar="var(--color-role-tank)" />
          Needs this slot
        </span>
        <span className="flex items-center gap-1.5">
          <EmptyDot />
          Has it, or not in their BiS
        </span>
        <span className="flex items-center gap-1.5">
          <MaterialProgressRing roleVar="var(--color-role-tank)" total={3} needed={1} />
          Material — slices show progress; the number is how many left
        </span>
        <span className="flex items-center gap-1.5">
          <Tag variant="label" tone="success">FREE</Tag>
          No one needs it
        </span>
        {canEdit && <span className="text-text-tertiary">Click a dot to log it</span>}
      </div>
    </div>
  );
}
