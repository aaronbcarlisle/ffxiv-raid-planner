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
import { Tooltip } from '../primitives/Tooltip';
import { getRoleColor, type Role } from '../../gamedata';
import { FLOOR_COLORS, type FloorNumber } from '../../gamedata/loot-tables';
import type { SnapshotPlayer, LootLogEntry, MaterialLogEntry } from '../../types';
import { GEAR_SLOT_NAMES } from '../../types';
import { Pencil, Link, Trash2, UserRound } from 'lucide-react';

/**
 * Material colors using CSS custom properties for design system compliance
 * @see index.css --color-material-* tokens
 */
const MATERIAL_COLORS: Record<string, string> = {
  twine: 'var(--color-material-twine)',
  glaze: 'var(--color-material-glaze)',
  solvent: 'var(--color-material-solvent)',
  universal_tomestone: 'var(--color-material-tomestone)',
};

interface WeeklyLootGridProps {
  players: SnapshotPlayer[];
  lootLog: LootLogEntry[];
  materialLog: MaterialLogEntry[];
  floors: string[];
  currentWeek: number;
  canEdit: boolean;
  highlightedEntryId?: string | null;
  highlightedEntryType?: 'loot' | 'material' | null;
  onLogLoot?: (floor: FloorNumber, slot: string) => void;
  onLogMaterial?: (floor: FloorNumber, material: string) => void;
  onDeleteLoot?: (entryId: number) => void;
  onDeleteMaterial?: (entryId: number) => void;
  onEditLoot?: (entry: LootLogEntry) => void;
  onEditMaterial?: (entry: MaterialLogEntry) => void;
  onCopyEntryUrl?: (entryId: number, entryType: 'loot' | 'material') => void;
  onEditNote?: (floor: FloorNumber, note: string) => void;
  onNavigateToPlayer?: (playerId: string) => void;
}

export function WeeklyLootGrid({
  players,
  lootLog,
  materialLog,
  floors,
  currentWeek,
  canEdit,
  highlightedEntryId,
  highlightedEntryType,
  onLogLoot,
  onLogMaterial,
  onDeleteLoot,
  onDeleteMaterial,
  onEditLoot,
  onEditMaterial,
  onCopyEntryUrl,
  onNavigateToPlayer,
}: WeeklyLootGridProps) {
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry: LootLogEntry | MaterialLogEntry;
    type: 'loot' | 'material';
  } | null>(null);

  // Filter out substitute players from display
  const mainRosterPlayers = useMemo(() =>
    players.filter(p => !p.isSubstitute),
    [players]
  );

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

    // Edit option - only show if user has edit permission
    if (type === 'loot' && onEditLoot && canEdit) {
      items.push({
        label: 'Edit',
        icon: <Pencil className="w-4 h-4" />,
        onClick: () => onEditLoot(entry as LootLogEntry),
      });
    }

    if (type === 'material' && onEditMaterial && canEdit) {
      items.push({
        label: 'Edit',
        icon: <Pencil className="w-4 h-4" />,
        onClick: () => onEditMaterial(entry as MaterialLogEntry),
      });
    }

    // Copy URL is always available (read-only action)
    if (onCopyEntryUrl) {
      items.push({
        label: 'Copy URL',
        icon: <Link className="w-4 h-4" />,
        onClick: () => onCopyEntryUrl(entry.id, type),
      });
    }

    // Jump to Player - navigate to recipient's player card
    if (onNavigateToPlayer) {
      const recipientName = 'recipientPlayerName' in entry ? entry.recipientPlayerName : '';
      const recipientId = 'recipientPlayerId' in entry ? entry.recipientPlayerId : '';
      if (recipientId) {
        items.push({
          label: `Jump to ${recipientName}`,
          icon: <UserRound className="w-4 h-4" />,
          onClick: () => onNavigateToPlayer(recipientId),
        });
      }
    }

    // Separator before delete if there are other items and delete is available
    const canDeleteLoot = type === 'loot' && onDeleteLoot && canEdit;
    const canDeleteMaterial = type === 'material' && onDeleteMaterial && canEdit;
    if (items.length > 0 && (canDeleteLoot || canDeleteMaterial)) {
      items.push({ separator: true });
    }

    // Delete options - only show if user has edit permission
    // Note: Close context menu before delete to prevent stale state
    if (canDeleteLoot) {
      items.push({
        label: 'Delete',
        icon: <Trash2 className="w-4 h-4" />,
        onClick: () => {
          setContextMenu(null);
          onDeleteLoot(entry.id);
        },
        danger: true,
      });
    }

    if (canDeleteMaterial) {
      items.push({
        label: 'Delete',
        icon: <Trash2 className="w-4 h-4" />,
        onClick: () => {
          setContextMenu(null);
          onDeleteMaterial(entry.id);
        },
        danger: true,
      });
    }

    return items;
  }, [contextMenu, onEditLoot, onEditMaterial, onCopyEntryUrl, onDeleteLoot, onDeleteMaterial, canEdit, setContextMenu, onNavigateToPlayer]);
  // Filter entries for current week
  const weekLootEntries = useMemo(() =>
    lootLog.filter(e => e.weekNumber === currentWeek),
    [lootLog, currentWeek]
  );

  const weekMaterialEntries = useMemo(() =>
    materialLog.filter(e => e.weekNumber === currentWeek),
    [materialLog, currentWeek]
  );

  // Calculate loot counts per player (main roster only)
  const playerLootCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    mainRosterPlayers.forEach(p => { counts[p.id] = 0; });
    weekLootEntries.forEach(e => {
      if (counts[e.recipientPlayerId] !== undefined) {
        counts[e.recipientPlayerId]++;
      }
    });
    return counts;
  }, [mainRosterPlayers, weekLootEntries]);

  // Calculate average for fairness coloring
  const avgLoot = useMemo(() => {
    const values = Object.values(playerLootCounts);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }, [playerLootCounts]);

  /**
   * Get loot style based on count vs average
   * Uses CSS custom properties for design system compliance
   */
  const getLootCountStyle = (count: number) => {
    if (count > avgLoot + 1) return { color: 'var(--color-status-info)', label: 'Most' };
    if (count < avgLoot - 1) return { color: 'var(--color-status-warning)', label: 'Least' };
    return { color: 'var(--color-text-secondary)', label: 'Average' };
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
    const roleColor = player ? getRoleColor(getValidRole(player.role)) : 'var(--color-text-secondary)';

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
          <Tooltip content="Delete entry">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteLoot(entry.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-status-error hover:text-status-error/80 transition-opacity"
              aria-label="Delete loot entry"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </Tooltip>
        )}
        {canEdit && onDeleteMaterial && 'materialType' in entry && (
          <Tooltip content="Delete entry">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteMaterial(entry.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-status-error hover:text-status-error/80 transition-opacity"
              aria-label="Delete material entry"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </Tooltip>
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
      <div className="flex gap-2 p-3 bg-surface-card rounded-lg border border-border-default overflow-x-clip">
        {mainRosterPlayers.map(player => {
          const count = playerLootCounts[player.id] || 0;
          const style = getLootCountStyle(count);
          const roleColor = getRoleColor(getValidRole(player.role));

          return (
            <div
              key={player.id}
              className="flex-1 min-w-[80px] text-center p-2 bg-surface-elevated rounded-lg border border-border-subtle"
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
                backgroundColor: `${FLOOR_COLORS[floor.number].hex}10`,
                borderTop: floorIdx > 0 ? '1px solid var(--border-default)' : 'none',
              }}
            >
              <div
                className="w-1 h-5 rounded mr-3"
                style={{ backgroundColor: FLOOR_COLORS[floor.number].hex }}
              />
              <div className="font-bold" style={{ color: FLOOR_COLORS[floor.number].hex }}>
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
                  const isHighlighted = lootEntry && highlightedEntryId === String(lootEntry.id) && (!highlightedEntryType || highlightedEntryType === 'loot');

                  const isClickable = canClickToLog || canClickToEdit;
                  const cellContent = (
                    <div
                      key={item.slot}
                      id={lootEntry ? `loot-entry-${lootEntry.id}` : undefined}
                      className={`min-w-[100px] flex-1 px-3 py-2 border-l border-border-subtle hover:bg-surface-elevated/50 transition-colors select-none ${isClickable ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset' : ''} ${isHighlighted ? 'highlight-pulse' : ''}`}
                      onMouseDown={(e) => {
                        // Prevent focus flash when Shift+Click
                        if (e.shiftKey && lootEntry && onCopyEntryUrl) {
                          e.preventDefault();
                        }
                      }}
                      onClick={(e) => {
                        // Shift+Click copies entry URL
                        if (e.shiftKey && lootEntry && onCopyEntryUrl) {
                          e.preventDefault();
                          window.getSelection()?.removeAllRanges();
                          onCopyEntryUrl(lootEntry.id, 'loot');
                          return;
                        }
                        // Alt+Click navigates to player
                        if (e.altKey && lootEntry && onNavigateToPlayer) {
                          e.preventDefault();
                          onNavigateToPlayer(lootEntry.recipientPlayerId);
                          return;
                        }
                        // Edit takes priority over log (mutually exclusive but use else for clarity)
                        if (canClickToEdit && lootEntry) {
                          onEditLoot(lootEntry);
                        } else if (canClickToLog) {
                          onLogLoot(floor.number, item.slot);
                        }
                      }}
                      onKeyDown={isClickable ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          // Edit takes priority over log
                          if (canClickToEdit && lootEntry) {
                            onEditLoot(lootEntry);
                          } else if (canClickToLog) {
                            onLogLoot(floor.number, item.slot);
                          }
                        }
                      } : undefined}
                      onContextMenu={lootEntry ? (e) => handleContextMenu(e, lootEntry, 'loot') : undefined}
                      role={isClickable ? 'button' : undefined}
                      tabIndex={isClickable ? 0 : -1}
                    >
                      <div className="text-[10px] text-text-muted mb-1">{slotDisplayName}</div>
                      {renderRecipientBadge(lootEntry)}
                    </div>
                  );

                  // Wrap with tooltip if there's an entry
                  if (lootEntry) {
                    const tooltipText = onCopyEntryUrl
                      ? 'Shift+Click to copy link • Alt+Click to go to player • Right-click for menu'
                      : 'Alt+Click to go to player • Right-click for menu';
                    return (
                      <Tooltip key={item.slot} content={tooltipText} delayDuration={400}>
                        {cellContent}
                      </Tooltip>
                    );
                  }

                  // For empty cells that can be clicked to log
                  if (canClickToLog) {
                    return (
                      <Tooltip key={item.slot} content="Click to log loot" delayDuration={400}>
                        {cellContent}
                      </Tooltip>
                    );
                  }

                  return cellContent;
                })}

                {/* Material columns */}
                {floor.materials.map(mat => {
                  const matEntry = getMaterialForFloor(floor.number, mat.type);
                  const canClickToLogMat = canEdit && onLogMaterial && !matEntry;
                  const canClickToEditMat = canEdit && onEditMaterial && !!matEntry;
                  const isMatHighlighted = matEntry && highlightedEntryId === String(matEntry.id) && highlightedEntryType === 'material';

                  const isClickable = canClickToLogMat || canClickToEditMat;
                  const matCellContent = (
                    <div
                      key={mat.type}
                      id={matEntry ? `material-entry-${matEntry.id}` : undefined}
                      className={`min-w-[90px] px-3 py-2 border-l border-border-default bg-surface-base hover:bg-surface-elevated/50 transition-colors select-none ${isClickable ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset' : ''} ${isMatHighlighted ? 'highlight-pulse' : ''}`}
                      onMouseDown={(e) => {
                        // Prevent focus flash when Shift+Click
                        if (e.shiftKey && matEntry && onCopyEntryUrl) {
                          e.preventDefault();
                        }
                      }}
                      onClick={(e) => {
                        // Shift+Click copies entry URL
                        if (e.shiftKey && matEntry && onCopyEntryUrl) {
                          e.preventDefault();
                          window.getSelection()?.removeAllRanges();
                          onCopyEntryUrl(matEntry.id, 'material');
                          return;
                        }
                        // Alt+Click navigates to player
                        if (e.altKey && matEntry && onNavigateToPlayer) {
                          e.preventDefault();
                          onNavigateToPlayer(matEntry.recipientPlayerId);
                          return;
                        }
                        // Edit takes priority over log (mutually exclusive but use else for clarity)
                        if (canClickToEditMat && matEntry) {
                          onEditMaterial(matEntry);
                        } else if (canClickToLogMat) {
                          onLogMaterial(floor.number, mat.type);
                        }
                      }}
                      onKeyDown={isClickable ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          // Edit takes priority over log
                          if (canClickToEditMat && matEntry) {
                            onEditMaterial(matEntry);
                          } else if (canClickToLogMat) {
                            onLogMaterial(floor.number, mat.type);
                          }
                        }
                      } : undefined}
                      onContextMenu={matEntry ? (e) => handleContextMenu(e, matEntry, 'material') : undefined}
                      role={isClickable ? 'button' : undefined}
                      tabIndex={isClickable ? 0 : -1}
                    >
                      <div
                        className="text-[10px] mb-1"
                        style={{ color: MATERIAL_COLORS[mat.type] || 'var(--color-text-secondary)' }}
                      >
                        {mat.name}
                      </div>
                      {renderRecipientBadge(matEntry)}
                    </div>
                  );

                  // Wrap with tooltip if there's an entry
                  if (matEntry) {
                    const tooltipText = onCopyEntryUrl
                      ? 'Shift+Click to copy link • Alt+Click to go to player • Right-click for menu'
                      : 'Alt+Click to go to player • Right-click for menu';
                    return (
                      <Tooltip key={mat.type} content={tooltipText} delayDuration={400}>
                        {matCellContent}
                      </Tooltip>
                    );
                  }

                  // For empty cells that can be clicked to log
                  if (canClickToLogMat) {
                    return (
                      <Tooltip key={mat.type} content="Click to log material" delayDuration={400}>
                        {matCellContent}
                      </Tooltip>
                    );
                  }

                  return matCellContent;
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
        <div className="w-2.5 h-2.5 rounded bg-status-info" />
        <span>Most (&gt;avg+1)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded bg-text-secondary" />
        <span>Average</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded bg-status-warning" />
        <span>Least (&lt;avg-1)</span>
      </div>
    </div>
  );
}
