/**
 * Weekly Loot Grid
 *
 * Spreadsheet-style weekly loot tracking with:
 * - Floor-colored section headers
 * - Loot count summary bar with fairness indicators
 * - Per-floor notes input
 * - Role-colored recipient badges
 * - Grid-based item layout
 */

import { useMemo, useState, useCallback } from 'react';
import { JobIcon } from '../ui/JobIcon';
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu';
import { getRoleColor, type Role } from '../../gamedata';
import { type FloorNumber } from '../../gamedata/loot-tables';
import type { SnapshotPlayer, LootLogEntry, MaterialLogEntry } from '../../types';
import { GEAR_SLOT_NAMES } from '../../types';
import { Pencil, Link, Trash2 } from 'lucide-react';

/**
 * Floor colors - MUST match CSS tokens in index.css
 * @see --color-floor-1, --color-floor-2, --color-floor-3, --color-floor-4
 */
const FLOOR_COLORS: Record<FloorNumber, string> = {
  1: '#22c55e', // Green (--color-floor-1)
  2: '#3b82f6', // Blue (--color-floor-2)
  3: '#a855f7', // Purple (--color-floor-3)
  4: '#f59e0b', // Amber (--color-floor-4)
};

/**
 * Material colors - MUST match CSS tokens in index.css
 * @see --color-gear-crafted, --color-gear-augmented
 */
const MATERIAL_COLORS: Record<string, string> = {
  twine: '#c4b5fd',   // (--color-gear-crafted)
  glaze: '#fcd34d',   // (--color-gear-augmented)
  solvent: '#f87171', // (--color-progress-priority)
  universal_tomestone: '#14b8a6', // Teal (accent color)
};

interface WeeklyLootGridProps {
  players: SnapshotPlayer[];
  lootLog: LootLogEntry[];
  materialLog: MaterialLogEntry[];
  floors: string[];
  currentWeek: number;
  canEdit: boolean;
  onLogLoot?: (floor: FloorNumber, slot: string) => void;
  onLogMaterial?: (floor: FloorNumber, material: string) => void;
  onDeleteLoot?: (entryId: number) => void;
  onDeleteMaterial?: (entryId: number) => void;
  onEditLoot?: (entry: LootLogEntry) => void;
  onEditMaterial?: (entry: MaterialLogEntry) => void;
  onCopyEntryUrl?: (entryId: number) => void;
  onEditNote?: (floor: FloorNumber, note: string) => void;
}

export function WeeklyLootGrid({
  players,
  lootLog,
  materialLog,
  floors,
  currentWeek,
  canEdit,
  onLogLoot,
  onLogMaterial,
  onDeleteLoot,
  onDeleteMaterial,
  onEditLoot,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onEditMaterial, // Reserved for future material editing
  onCopyEntryUrl,
}: WeeklyLootGridProps) {
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry: LootLogEntry | MaterialLogEntry;
    type: 'loot' | 'material';
  } | null>(null);

  // Handle context menu for entries
  const handleContextMenu = useCallback((
    e: React.MouseEvent,
    entry: LootLogEntry | MaterialLogEntry,
    type: 'loot' | 'material'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, entry, type });
  }, []);

  // Get context menu items for an entry
  const getContextMenuItems = useCallback((): ContextMenuItem[] => {
    if (!contextMenu) return [];
    const { entry, type } = contextMenu;
    const items: ContextMenuItem[] = [];

    if (type === 'loot' && onEditLoot) {
      items.push({
        label: 'Edit',
        icon: <Pencil className="w-4 h-4" />,
        onClick: () => onEditLoot(entry as LootLogEntry),
      });
    }

    if (onCopyEntryUrl) {
      items.push({
        label: 'Copy URL',
        icon: <Link className="w-4 h-4" />,
        onClick: () => onCopyEntryUrl(entry.id),
      });
    }

    if (items.length > 0 && ((type === 'loot' && onDeleteLoot) || (type === 'material' && onDeleteMaterial))) {
      items.push({ separator: true });
    }

    if (type === 'loot' && onDeleteLoot) {
      items.push({
        label: 'Delete',
        icon: <Trash2 className="w-4 h-4" />,
        onClick: () => onDeleteLoot(entry.id),
        danger: true,
      });
    }

    if (type === 'material' && onDeleteMaterial) {
      items.push({
        label: 'Delete',
        icon: <Trash2 className="w-4 h-4" />,
        onClick: () => onDeleteMaterial(entry.id),
        danger: true,
      });
    }

    return items;
  }, [contextMenu, onEditLoot, onCopyEntryUrl, onDeleteLoot, onDeleteMaterial]);
  // Filter entries for current week
  const weekLootEntries = useMemo(() =>
    lootLog.filter(e => e.weekNumber === currentWeek),
    [lootLog, currentWeek]
  );

  const weekMaterialEntries = useMemo(() =>
    materialLog.filter(e => e.weekNumber === currentWeek),
    [materialLog, currentWeek]
  );

  // Calculate loot counts per player
  const playerLootCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    players.forEach(p => { counts[p.id] = 0; });
    weekLootEntries.forEach(e => {
      if (counts[e.recipientPlayerId] !== undefined) {
        counts[e.recipientPlayerId]++;
      }
    });
    return counts;
  }, [players, weekLootEntries]);

  // Calculate average for fairness coloring
  const avgLoot = useMemo(() => {
    const values = Object.values(playerLootCounts);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }, [playerLootCounts]);

  /**
   * Get loot style based on count vs average
   * Colors reference CSS tokens:
   * - Blue (#3b82f6) = most loot (--color-floor-2)
   * - Yellow (#eab308) = least loot (--color-status-warning)
   * - Gray (#a1a1aa) = average (--color-text-secondary)
   */
  const getLootCountStyle = (count: number) => {
    if (count > avgLoot + 1) return { color: '#3b82f6', label: 'Most' };
    if (count < avgLoot - 1) return { color: '#eab308', label: 'Least' };
    return { color: '#a1a1aa', label: 'Average' };
  };

  // Get player by ID
  const getPlayerById = (playerId: string): SnapshotPlayer | undefined => {
    return players.find(p => p.id === playerId);
  };

  // Get loot entry for a specific floor and slot
  const getLootForSlot = (floorNum: FloorNumber, slot: string): LootLogEntry | undefined => {
    const floorName = floors[floorNum - 1];
    return weekLootEntries.find(e =>
      e.floor === floorName && e.itemSlot === slot
    );
  };

  // Get material entry for a specific floor and type
  const getMaterialForFloor = (floorNum: FloorNumber, materialType: string): MaterialLogEntry | undefined => {
    const floorName = floors[floorNum - 1];
    return weekMaterialEntries.find(e =>
      e.floor === floorName && e.materialType === materialType
    );
  };

  // Get valid roles for color lookup
  const validRoles: Role[] = ['tank', 'healer', 'melee', 'ranged', 'caster'];
  const getValidRole = (role: string): Role => {
    return validRoles.includes(role as Role) ? role as Role : 'melee';
  };

  // Render recipient badge
  const renderRecipientBadge = (entry: LootLogEntry | MaterialLogEntry | undefined) => {
    if (!entry) {
      return (
        <span className="text-xs text-text-muted italic">—</span>
      );
    }

    const player = getPlayerById(entry.recipientPlayerId);
    const roleColor = player ? getRoleColor(getValidRole(player.role)) : '#a1a1aa';

    return (
      <div className="group flex items-center gap-1">
        <div
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded transition-all"
          style={{
            color: roleColor,
            backgroundColor: `${roleColor}15`,
            border: `1px solid ${roleColor}30`,
          }}
        >
          {player && <JobIcon job={player.job} size="xs" />}
          <span>{player?.name || 'Unknown'}</span>
        </div>
        {canEdit && onDeleteLoot && 'itemSlot' in entry && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteLoot(entry.id);
            }}
            className="opacity-0 group-hover:opacity-100 p-0.5 text-status-error hover:text-status-error/80 transition-opacity"
            title="Delete entry"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {canEdit && onDeleteMaterial && 'materialType' in entry && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteMaterial(entry.id);
            }}
            className="opacity-0 group-hover:opacity-100 p-0.5 text-status-error hover:text-status-error/80 transition-opacity"
            title="Delete entry"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  };

  // Floor configurations
  const floorConfigs: Array<{
    number: FloorNumber;
    id: string;
    book: string;
    items: Array<{ slot: string; name: string }>;
    materials: Array<{ type: string; name: string }>;
  }> = [
    {
      number: 1,
      id: floors[0] || 'Floor 1',
      book: 'I',
      items: [
        { slot: 'earring', name: 'Ears' },
        { slot: 'necklace', name: 'Neck' },
        { slot: 'bracelet', name: 'Wrists' },
        { slot: 'ring1', name: 'Ring' },
      ],
      materials: [], // Floor 1 has no upgrade materials
    },
    {
      number: 2,
      id: floors[1] || 'Floor 2',
      book: 'II',
      items: [
        { slot: 'head', name: 'Head' },
        { slot: 'hands', name: 'Hands' },
        { slot: 'feet', name: 'Feet' },
      ],
      materials: [
        { type: 'glaze', name: 'Glaze' },
        { type: 'universal_tomestone', name: 'Tome' },
      ],
    },
    {
      number: 3,
      id: floors[2] || 'Floor 3',
      book: 'III',
      items: [
        { slot: 'body', name: 'Chest' },
        { slot: 'legs', name: 'Legs' },
      ],
      materials: [
        { type: 'twine', name: 'Twine' },
        { type: 'solvent', name: 'Solvent' },
      ],
    },
    {
      number: 4,
      id: floors[3] || 'Floor 4',
      book: 'IV',
      items: [
        { slot: 'weapon', name: 'Weapon' },
      ],
      materials: [],
    },
  ];

  return (
    <div className="space-y-4">
      {/* Loot Count Summary Bar */}
      <div className="flex gap-2 p-3 bg-surface-card rounded-lg border border-border-default overflow-x-auto">
        {players.map(player => {
          const count = playerLootCounts[player.id] || 0;
          const style = getLootCountStyle(count);
          const roleColor = getRoleColor(getValidRole(player.role));

          return (
            <div
              key={player.id}
              className="flex-1 min-w-[80px] text-center p-2 bg-surface-elevated rounded-lg border"
              style={{ borderColor: '#1f1f28' }}
            >
              <div
                className="text-[10px] font-semibold mb-0.5"
                style={{ color: roleColor }}
              >
                {player.position || player.role.substring(0, 2).toUpperCase()}
              </div>
              <div className="text-[10px] text-text-muted truncate">{player.name}</div>
              <div className="text-xl font-bold" style={{ color: style.color }}>
                {count}
              </div>
              <div className="text-[9px] text-text-muted uppercase">drops</div>
            </div>
          );
        })}
      </div>

      {/* Main Grid */}
      <div className="bg-surface-card rounded-lg border border-border-default overflow-hidden">
        {floorConfigs.map((floor, floorIdx) => (
          <div key={floor.number}>
            {/* Floor Header */}
            <div
              className="flex items-center px-4 py-2.5"
              style={{
                backgroundColor: `${FLOOR_COLORS[floor.number]}10`,
                borderTop: floorIdx > 0 ? '1px solid var(--border-default)' : 'none',
              }}
            >
              <div
                className="w-1 h-5 rounded mr-3"
                style={{ backgroundColor: FLOOR_COLORS[floor.number] }}
              />
              <div className="font-bold" style={{ color: FLOOR_COLORS[floor.number] }}>
                {floor.id}
              </div>
              <div className="ml-3 text-xs text-text-muted">
                Floor {floor.number} • Book {floor.book}
              </div>
            </div>

            {/* Loot Row */}
            <div className="flex border-b border-border-subtle">
              {/* Label */}
              <div className="w-16 shrink-0 px-3 py-2 text-[10px] font-semibold text-text-muted uppercase bg-surface-base">
                Loot
              </div>

              {/* Item columns */}
              <div className="flex-1 flex flex-wrap">
                {floor.items.map(item => {
                  const lootEntry = getLootForSlot(floor.number, item.slot);
                  const slotDisplayName = GEAR_SLOT_NAMES[item.slot as keyof typeof GEAR_SLOT_NAMES] || item.name;
                  const canClickToLog = canEdit && onLogLoot && !lootEntry;
                  const canClickToEdit = canEdit && onEditLoot && !!lootEntry;

                  return (
                    <div
                      key={item.slot}
                      className={`min-w-[100px] flex-1 px-3 py-2 border-l border-border-subtle hover:bg-surface-elevated/50 transition-colors ${canClickToLog || canClickToEdit ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        if (canClickToLog) onLogLoot(floor.number, item.slot);
                        if (canClickToEdit && lootEntry) onEditLoot(lootEntry);
                      }}
                      onContextMenu={lootEntry ? (e) => handleContextMenu(e, lootEntry, 'loot') : undefined}
                    >
                      <div className="text-[10px] text-text-muted mb-1">{slotDisplayName}</div>
                      {renderRecipientBadge(lootEntry)}
                    </div>
                  );
                })}

                {/* Material columns */}
                {floor.materials.map(mat => {
                  const matEntry = getMaterialForFloor(floor.number, mat.type);
                  const canClickMat = canEdit && onLogMaterial && !matEntry;

                  return (
                    <div
                      key={mat.type}
                      className={`min-w-[90px] px-3 py-2 border-l border-border-default bg-surface-base hover:bg-surface-elevated/50 transition-colors ${canClickMat ? 'cursor-pointer' : ''}`}
                      onClick={canClickMat ? () => onLogMaterial(floor.number, mat.type) : undefined}
                      onContextMenu={matEntry ? (e) => handleContextMenu(e, matEntry, 'material') : undefined}
                    >
                      <div
                        className="text-[10px] mb-1"
                        style={{ color: MATERIAL_COLORS[mat.type] || '#a1a1aa' }}
                      >
                        {mat.name}
                      </div>
                      {renderRecipientBadge(matEntry)}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems()}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

/**
 * Loot fairness legend - displayed below the grid
 * Extracted as separate component so it can be rendered outside the grid+sidebar flex container
 */
export function LootFairnessLegend() {
  return (
    <div className="flex items-center gap-6 text-xs text-text-muted px-1">
      <span className="text-text-secondary">Loot fairness:</span>
      <div className="flex items-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: '#3b82f6' }} />
        <span>Most (&gt;avg+1)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: '#a1a1aa' }} />
        <span>Average</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: '#eab308' }} />
        <span>Least (&lt;avg-1)</span>
      </div>
    </div>
  );
}
