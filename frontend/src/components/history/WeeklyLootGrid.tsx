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

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { JobIcon } from '../ui/JobIcon';
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu';
import { Tooltip } from '../primitives/Tooltip';
import { getRoleColor, type Role } from '../../gamedata';
import { FLOOR_COLORS, type FloorNumber } from '../../gamedata/loot-tables';
import type { SnapshotPlayer, LootLogEntry, MaterialLogEntry } from '../../types';
import { GEAR_SLOT_NAMES } from '../../types';
import { Pencil, Link, Trash2, UserRound, ClipboardList } from 'lucide-react';

/** Long-press duration in ms for touch devices to trigger context menu */
const LONG_PRESS_DURATION = 500;

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
  onNavigateToPlayer?: (playerId: string, slot?: string) => void;
  /** Handler to open Log Floor wizard for a specific floor */
  onLogFloor?: (floor: FloorNumber) => void;
  /** Handler to reset floor loot (opens confirmation modal) */
  onResetFloorLoot?: (floor: FloorNumber) => void;
  /** Handler to reset floor books (opens confirmation modal) */
  onResetFloorBooks?: (floor: FloorNumber) => void;
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
  onLogFloor,
  onResetFloorLoot,
  onResetFloorBooks,
}: WeeklyLootGridProps) {
  // Context menu state for loot/material entries
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry: LootLogEntry | MaterialLogEntry;
    type: 'loot' | 'material';
  } | null>(null);

  // Context menu state for floor headers
  const [floorContextMenu, setFloorContextMenu] = useState<{
    x: number;
    y: number;
    floor: FloorNumber;
    floorName: string;
  } | null>(null);

  // Handle context menu for floor headers
  const handleFloorContextMenu = useCallback((
    e: React.MouseEvent,
    floor: FloorNumber,
    floorName: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setFloorContextMenu({ x: e.clientX, y: e.clientY, floor, floorName });
  }, []);

  // Get context menu items for floor header
  const getFloorContextMenuItems = useCallback((): ContextMenuItem[] => {
    if (!floorContextMenu) return [];
    const { floor, floorName } = floorContextMenu;
    const items: ContextMenuItem[] = [];

    // Log Floor Loot - opens the wizard for this floor
    if (canEdit && onLogFloor) {
      items.push({
        label: 'Log Floor Loot',
        icon: <ClipboardList className="w-4 h-4" />,
        onClick: () => onLogFloor(floor),
      });
    }

    // Separator before reset options
    if (canEdit && (onResetFloorLoot || onResetFloorBooks)) {
      items.push({ separator: true });
    }

    // Reset Floor Loot
    if (canEdit && onResetFloorLoot) {
      items.push({
        label: `Reset ${floorName} Loot`,
        icon: <Trash2 className="w-4 h-4" />,
        onClick: () => onResetFloorLoot(floor),
        danger: true,
      });
    }

    // Reset Floor Books
    if (canEdit && onResetFloorBooks) {
      items.push({
        label: `Reset ${floorName} Books`,
        icon: <Trash2 className="w-4 h-4" />,
        onClick: () => onResetFloorBooks(floor),
        danger: true,
      });
    }

    return items;
  }, [floorContextMenu, canEdit, onLogFloor, onResetFloorLoot, onResetFloorBooks]);

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

  // Long-press support for touch devices
  // Note: Uses inline implementation instead of useLongPress hook because handlers need
  // entry-specific context (entry, type) passed at call-time, which the generic hook doesn't support.
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isMountedRef = useRef(true);
  const longPressTriggeredRef = useRef(false); // Track if long-press fired to suppress subsequent click

  const handleTouchStart = useCallback((
    e: React.TouchEvent,
    entry: LootLogEntry | MaterialLogEntry,
    type: 'loot' | 'material'
  ) => {
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      // Only trigger if component is still mounted
      if (isMountedRef.current) {
        longPressTriggeredRef.current = true; // Mark that long-press fired
        setContextMenu({ x: touch.clientX, y: touch.clientY, entry, type });
      }
      // Note: Don't clear longPressTimerRef here - cleanup happens in handleTouchEnd/handleTouchCancel/useEffect
    }, LONG_PRESS_DURATION);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  }, []);

  // Handle touchcancel (e.g., system alerts, browser gestures) same as touchend
  const handleTouchCancel = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // Cancel long-press if user moves finger more than 10px
    if (touchStartPosRef.current && longPressTimerRef.current) {
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
      const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
      if (dx > 10 || dy > 10) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  }, []);

  // Cleanup long-press timer and track mount state
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
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

  // Render recipient badge - fixed height container to prevent layout shift
  const renderRecipientBadge = (entry: LootLogEntry | MaterialLogEntry | undefined) => {
    // Fixed height (28px) ensures cells don't shift when content changes
    // Badge: 12px font + 8px padding + 2px border + icon = ~26-28px
    const containerClass = "h-[28px] flex items-center";

    if (!entry) {
      return (
        <div className={containerClass}>
          <span className="text-xs text-text-muted italic">—</span>
        </div>
      );
    }

    const player = getPlayerById(entry.recipientPlayerId);
    const roleColor = player ? getRoleColor(getValidRole(player.role)) : 'var(--color-text-secondary)';

    return (
      <div className={`${containerClass} group gap-1`}>
        <div
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded transition-all whitespace-nowrap"
          style={{
            color: roleColor,
            backgroundColor: `color-mix(in srgb, ${roleColor} 15%, transparent)`,
            border: `1px solid color-mix(in srgb, ${roleColor} 30%, transparent)`,
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

  // Stop touch events from propagating to parent swipe handlers (e.g., tab navigation)
  const handleGridTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
  }, []);

  const handleGridTouchEnd = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div className="space-y-4 w-full">
      {/* Main Grid */}
      <div className="bg-surface-card rounded-lg border border-border-default w-full">
        {floorConfigs.map((floor, floorIdx) => (
          <div key={floor.number}>
            {/* Floor Header - stays fixed, doesn't scroll */}
            <div
              className="flex items-center px-4 py-2.5"
              style={{
                backgroundColor: `${FLOOR_COLORS[floor.number].hex}10`,
                borderTop: floorIdx > 0 ? '1px solid var(--border-default)' : 'none',
              }}
              onContextMenu={(e) => handleFloorContextMenu(e, floor.number, floor.id)}
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

              {/* Log Floor button */}
              {canEdit && onLogFloor && (
                <Tooltip content={`Log all drops for ${floor.id} using wizard`}>
                  <button
                    className="ml-auto px-2.5 py-1 text-xs font-bold rounded border transition-colors flex items-center gap-1.5 hover:brightness-110"
                    style={{
                      backgroundColor: `${FLOOR_COLORS[floor.number].hex}15`,
                      borderColor: `${FLOOR_COLORS[floor.number].hex}40`,
                      color: FLOOR_COLORS[floor.number].hex,
                    }}
                    onClick={() => onLogFloor(floor.number)}
                  >
                    <ClipboardList className="w-3 h-3" />
                    Log Floor
                  </button>
                </Tooltip>
              )}
            </div>

            {/* Loot Row - horizontally scrollable on mobile, wrapping grid on desktop */}
            <div
              className="flex border-b border-border-subtle sm:overflow-visible overflow-x-auto"
              onTouchStart={handleGridTouchStart}
              onTouchEnd={handleGridTouchEnd}
            >
              {/* Label - sticky on left for mobile scroll */}
              <div className="w-14 shrink-0 px-2 py-2 text-[10px] font-semibold text-text-muted uppercase bg-surface-base sm:static sticky left-0 z-10">
                Loot
              </div>

              {/* Item columns - flex-nowrap for mobile horizontal scroll, flex-wrap for desktop grid */}
              <div className="flex flex-nowrap sm:flex-wrap flex-1">
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
                      className={`min-w-[120px] shrink-0 sm:shrink sm:min-w-0 sm:flex-1 px-3 py-2 border-l border-border-subtle hover:bg-surface-elevated/50 transition-colors select-none ${isClickable ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset' : ''} ${isHighlighted ? 'highlight-pulse' : ''}`}
                      onMouseDown={(e) => {
                        // Prevent focus flash when Shift+Click
                        if (e.shiftKey && lootEntry && onCopyEntryUrl) {
                          e.preventDefault();
                        }
                      }}
                      onClick={(e) => {
                        // Suppress click if this was a long-press that opened context menu
                        if (longPressTriggeredRef.current) {
                          longPressTriggeredRef.current = false;
                          return;
                        }
                        // Shift+Click copies entry URL
                        if (e.shiftKey && lootEntry && onCopyEntryUrl) {
                          e.preventDefault();
                          window.getSelection()?.removeAllRanges();
                          onCopyEntryUrl(lootEntry.id, 'loot');
                          return;
                        }
                        // Alt+Click navigates to player and highlights the gear slot
                        if (e.altKey && lootEntry && onNavigateToPlayer) {
                          e.preventDefault();
                          onNavigateToPlayer(lootEntry.recipientPlayerId, lootEntry.itemSlot);
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
                      onTouchStart={lootEntry ? (e) => handleTouchStart(e, lootEntry, 'loot') : undefined}
                      onTouchEnd={lootEntry ? handleTouchEnd : undefined}
                      onTouchCancel={lootEntry ? handleTouchCancel : undefined}
                      onTouchMove={lootEntry ? handleTouchMove : undefined}
                      role={isClickable ? 'button' : undefined}
                      tabIndex={isClickable ? 0 : -1}
                    >
                      <div className="text-[10px] text-text-muted mb-1">{slotDisplayName}</div>
                      {renderRecipientBadge(lootEntry)}
                    </div>
                  );

                  // Wrap with tooltip if there's an entry
                  if (lootEntry) {
                    return (
                      <Tooltip
                        key={item.slot}
                        content={
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center gap-2">
                              <kbd className="px-1 py-0.5 bg-surface-base rounded text-[10px] font-mono">Click</kbd>
                              <span className="text-text-secondary">Edit entry</span>
                            </div>
                            {onCopyEntryUrl && (
                              <div className="flex items-center gap-2">
                                <kbd className="px-1 py-0.5 bg-surface-base rounded text-[10px] font-mono">Shift+Click</kbd>
                                <span className="text-text-secondary">Copy link</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <kbd className="px-1 py-0.5 bg-surface-base rounded text-[10px] font-mono">Alt+Click</kbd>
                              <span className="text-text-secondary">Go to player</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <kbd className="px-1 py-0.5 bg-surface-base rounded text-[10px] font-mono">Right-click</kbd>
                              <span className="text-text-secondary">More options</span>
                            </div>
                          </div>
                        }
                        delayDuration={400}
                      >
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
                      className={`min-w-[120px] shrink-0 sm:shrink sm:min-w-0 sm:flex-1 px-3 py-2 border-l border-border-default bg-surface-base hover:bg-surface-elevated/50 transition-colors select-none ${isClickable ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset' : ''} ${isMatHighlighted ? 'highlight-pulse' : ''}`}
                      onMouseDown={(e) => {
                        // Prevent focus flash when Shift+Click
                        if (e.shiftKey && matEntry && onCopyEntryUrl) {
                          e.preventDefault();
                        }
                      }}
                      onClick={(e) => {
                        // Suppress click if this was a long-press that opened context menu
                        if (longPressTriggeredRef.current) {
                          longPressTriggeredRef.current = false;
                          return;
                        }
                        // Shift+Click copies entry URL
                        if (e.shiftKey && matEntry && onCopyEntryUrl) {
                          e.preventDefault();
                          window.getSelection()?.removeAllRanges();
                          onCopyEntryUrl(matEntry.id, 'material');
                          return;
                        }
                        // Alt+Click navigates to player and highlights the gear slot
                        if (e.altKey && matEntry && onNavigateToPlayer) {
                          e.preventDefault();
                          onNavigateToPlayer(matEntry.recipientPlayerId, matEntry.slotAugmented ?? undefined);
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
                      onTouchStart={matEntry ? (e) => handleTouchStart(e, matEntry, 'material') : undefined}
                      onTouchEnd={matEntry ? handleTouchEnd : undefined}
                      onTouchCancel={matEntry ? handleTouchCancel : undefined}
                      onTouchMove={matEntry ? handleTouchMove : undefined}
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
                    return (
                      <Tooltip
                        key={mat.type}
                        content={
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center gap-2">
                              <kbd className="px-1 py-0.5 bg-surface-base rounded text-[10px] font-mono">Click</kbd>
                              <span className="text-text-secondary">Edit entry</span>
                            </div>
                            {onCopyEntryUrl && (
                              <div className="flex items-center gap-2">
                                <kbd className="px-1 py-0.5 bg-surface-base rounded text-[10px] font-mono">Shift+Click</kbd>
                                <span className="text-text-secondary">Copy link</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <kbd className="px-1 py-0.5 bg-surface-base rounded text-[10px] font-mono">Alt+Click</kbd>
                              <span className="text-text-secondary">Go to player</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <kbd className="px-1 py-0.5 bg-surface-base rounded text-[10px] font-mono">Right-click</kbd>
                              <span className="text-text-secondary">More options</span>
                            </div>
                          </div>
                        }
                        delayDuration={400}
                      >
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

      {/* Entry Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems()}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Floor Header Context Menu */}
      {floorContextMenu && (
        <ContextMenu
          x={floorContextMenu.x}
          y={floorContextMenu.y}
          items={getFloorContextMenuItems()}
          onClose={() => setFloorContextMenu(null)}
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
