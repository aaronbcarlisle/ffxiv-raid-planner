/**
 * NeedMatrix — v2's Who-Needs-It matrix (Phase-D D3; R-48). Net-new per R-48:
 * legacy WhoNeedsItMatrix is frozen and V1-only. Differences from legacy are
 * ruled, not accidental: R-8/R-9 floor-coloured names + neutral slot icons
 * (always, not only when scoped), R-11 roster-size Need denominator, rows
 * band by floor F4→F1 (user-ruled at D3 build), scoping FILTERS rows (the D1
 * pill row is the scope control — R-48 rules FilterBar out), cells route
 * through the picker (R-4) instead of writing directly, and the ring row
 * hands the picker slot 'ring' (it resolves ring1/ring2 itself).
 */
import { useMemo } from 'react';
import { Tooltip, IconButton } from '../primitives';
import { Tag } from '../ui';
import { GearSlotIcon } from '../ui/GearSlotIcon';
import { JobIcon } from '../ui/JobIcon';
import { getValidRole } from '../../gamedata';
import { FLOOR_TEXT_CLASS } from './floorClasses';
import { MATERIAL_TOKEN } from './FloorDropRow';
import { sortByPosition, buildGearMatrixRows, buildMaterialMatrixRows } from './needMatrixData';
import type { FloorScope } from './priorityScope';
import type { FloorNumber, UpgradeMaterialType } from '../../gamedata/loot-tables';
import type { SnapshotPlayer, StaticSettings, MaterialLogEntry, GearSlot } from '../../types';

export interface NeedMatrixProps {
  /** Main roster (configured, non-substitute) — any order; sorted by position inside. */
  players: SnapshotPlayer[];
  floors: string[];
  floorScope: FloorScope;
  materialLog: MaterialLogEntry[];
  settings: StaticSettings;
  canEdit: boolean;
  onLogGear: (item: { slot: GearSlot | 'ring'; label: string; floorNumber: FloorNumber }, playerId: string) => void;
  onLogMaterial: (material: UpgradeMaterialType, player: SnapshotPlayer) => void;
}

/** Role-colored ring, never a fill — mirrors PriorityRow's contrast-safe avatar treatment. */
const roleVar = (player: SnapshotPlayer) => `var(--color-role-${getValidRole(player.role)}, var(--color-text-muted))`;

/** The needer dot: a role-colored ring around a role-colored center. File-local — one shape, two contexts (live cell + legend sample). */
function NeedDot({ roleVar: color }: { roleVar: string }) {
  return (
    <span aria-hidden className="grid h-6 w-6 place-items-center rounded-full border-2 bg-surface-interactive" style={{ borderColor: color }}>
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
    </span>
  );
}

/** The material needer dot: same ring shape as NeedDot, but the center is a count instead of a filled circle. */
function MaterialCountDot({ roleVar: color, count }: { roleVar: string; count: number }) {
  return (
    <span
      className="grid h-6 w-6 place-items-center rounded-full border-2 bg-surface-interactive text-xs font-bold text-text-primary"
      style={{ borderColor: color }}
    >
      {count}
    </span>
  );
}

/** The "not a needer" cell — same footprint as NeedDot, neutral instead of role-colored. */
function EmptyDot() {
  return <span aria-hidden className="mx-auto block h-6 w-6 rounded-full border border-border-subtle bg-surface-interactive" />;
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

  const visibleGearRows = gearRows.filter((row) => floorScope === 'all' || row.floorNumber === floorScope);
  const visibleMaterialRows = materialRows.filter(
    (row) => floorScope === 'all' || row.floorNumbers.includes(floorScope)
  );

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
            {visibleGearRows.map((row) => (
              <tr key={`${row.slot}-${row.floorNumber}`} className="border-t border-border-subtle">
                <th scope="row" aria-label={row.label} className="px-3 py-2 text-left font-medium">
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
                            onClick={() => onLogGear({ slot: row.slot, label: row.label, floorNumber: row.floorNumber }, player.id)}
                          />
                        </Tooltip>
                      ) : (
                        <>
                          <NeedDot roleVar={roleVar(player)} />
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
            ))}

            {visibleMaterialRows.length > 0 && (
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
            {visibleMaterialRows.map((row) => {
              const token = MATERIAL_TOKEN[row.material];
              return (
                <tr key={row.material} className="border-t border-border-subtle">
                  <th scope="row" aria-label={row.label} className="px-3 py-2 text-left font-medium">
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
                    const count = row.counts.get(player.id) ?? 0;
                    return (
                      <td key={player.id} className="px-2 py-2 text-center">
                        {count === 0 ? (
                          <EmptyDot />
                        ) : canEdit ? (
                          <Tooltip content={`Log ${row.label} for ${player.name}`}>
                            <IconButton
                              variant="ghost"
                              size="sm"
                              aria-label={`Log ${row.label} for ${player.name}`}
                              icon={<MaterialCountDot roleVar={roleVar(player)} count={count} />}
                              onClick={() => onLogMaterial(row.material, player)}
                            />
                          </Tooltip>
                        ) : (
                          <>
                            <MaterialCountDot roleVar={roleVar(player)} count={count} />
                            <span className="sr-only">{player.name} needs {row.label}</span>
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
          <MaterialCountDot roleVar="var(--color-role-tank)" count={2} />
          Material — number is how many
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
