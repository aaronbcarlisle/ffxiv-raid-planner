/**
 * All Weeks View
 *
 * Filterable, sortable data table showing ALL loot and material entries
 * across all weeks for the current tier. Provides a comprehensive overview
 * that the per-week Grid and List views cannot.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { JobIcon } from '../ui/JobIcon';
import { Input } from '../ui/Input';
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu';
import { SortableHeader } from '../admin/SortableHeader';
import { toggleSort, type SortDirection } from '../admin/sortUtils';
import { getRoleColor, getValidRole } from '../../gamedata';
import { FLOOR_COLORS, parseFloorName, UPGRADE_MATERIAL_DISPLAY_NAMES, type FloorNumber } from '../../gamedata/loot-tables';
import type { SnapshotPlayer, LootLogEntry, MaterialLogEntry } from '../../types';
import { GEAR_SLOT_NAMES } from '../../types';
import { Pencil, Link, Trash2, UserRound, Search, X, LayoutGrid, List } from 'lucide-react';
import { METHOD_INFO } from './lootMethodDisplay';

/** Map raw material type to CSS color token name (universal_tomestone → tomestone) */
const MATERIAL_CSS_TOKEN: Record<string, string> = {
  twine: 'twine',
  glaze: 'glaze',
  solvent: 'solvent',
  universal_tomestone: 'tomestone',
};

/** Method display (text-only variant) derived from shared METHOD_INFO */
const METHOD_DISPLAY = Object.fromEntries(
  Object.entries(METHOD_INFO).map(([k, v]) => [k, { label: v.label, className: v.textClass }])
) as Record<string, { label: string; className: string }>;

type EntryType = 'all' | 'loot' | 'materials';
type SortField = 'week' | 'floor' | 'slot' | 'player' | 'method' | 'date' | 'type';

/** Unified entry for the table */
interface UnifiedRow {
  id: number;
  type: 'loot' | 'material';
  weekNumber: number;
  floor: string;
  floorNum: FloorNumber;
  slot: string; // display name for the slot/material
  slotRaw: string; // raw value for search
  playerName: string;
  playerId: string;
  playerJob: string;
  playerRole: string;
  method: string;
  isExtra: boolean;
  weaponJob?: string;
  /** For materials: the gear slot that was augmented */
  slotAugmented?: string;
  createdAt: string;
  /** Original entry for edit/delete handlers */
  originalLoot?: LootLogEntry;
  originalMaterial?: MaterialLogEntry;
}

interface AllWeeksViewProps {
  players: SnapshotPlayer[];
  lootLog: LootLogEntry[];
  materialLog: MaterialLogEntry[];
  floors: string[];
  canEdit: boolean;
  onEditLoot?: (entry: LootLogEntry) => void;
  onEditMaterial?: (entry: MaterialLogEntry) => void;
  onDeleteLoot?: (entry: LootLogEntry) => void;
  onDeleteMaterial?: (entry: MaterialLogEntry) => void;
  onCopyEntryUrl?: (entryId: number, entryType: 'loot' | 'material') => void;
  onNavigateToPlayer?: (playerId: string, slot?: string) => void;
  /** Navigate to a specific week in Grid or List view */
  onJumpToWeek?: (week: number, layout: 'grid' | 'split') => void;
  highlightedEntryId?: string | null;
  highlightedEntryType?: 'loot' | 'material' | null;
}

export function AllWeeksView({
  players,
  lootLog,
  materialLog,
  floors,
  canEdit,
  onEditLoot,
  onEditMaterial,
  onDeleteLoot,
  onDeleteMaterial,
  onCopyEntryUrl,
  onNavigateToPlayer,
  onJumpToWeek,
  highlightedEntryId,
  highlightedEntryType,
}: AllWeeksViewProps) {
  // --- State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [entryType, setEntryType] = useState<EntryType>('all');
  const [activeFloors, setActiveFloors] = useState<Set<FloorNumber>>(new Set([1, 2, 3, 4]));
  const [sortField, setSortField] = useState<SortField>('week');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; row: UnifiedRow;
  } | null>(null);

  // Search input ref for keyboard shortcut
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Ctrl+Shift+F (or Cmd+Shift+F on macOS) focuses search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Listen for keyboard shortcut entry type changes (Alt+1/2/3)
  useEffect(() => {
    const handler = (e: CustomEvent<string>) => {
      if (e.detail === 'all' || e.detail === 'loot' || e.detail === 'materials') {
        setEntryType(e.detail);
      }
    };
    window.addEventListener('log:set-entry-type', handler as EventListener);
    return () => window.removeEventListener('log:set-entry-type', handler as EventListener);
  }, []);

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  // --- Helpers ---
  const playerMap = useMemo(() =>
    new Map(players.map(p => [p.id, p])),
    [players]
  );
  const getPlayer = useCallback((playerId: string) =>
    playerMap.get(playerId),
    [playerMap]
  );

  // --- Build unified rows ---
  const allRows: UnifiedRow[] = useMemo(() => {
    const lootRows: UnifiedRow[] = lootLog.map(e => {
      const player = getPlayer(e.recipientPlayerId);
      const slotName = GEAR_SLOT_NAMES[e.itemSlot as keyof typeof GEAR_SLOT_NAMES]
        || (e.itemSlot === 'ring' ? 'Ring' : e.itemSlot);
      const displaySlot = e.weaponJob ? `Weapon (${e.weaponJob})` : slotName;
      return {
        id: e.id,
        type: 'loot',
        weekNumber: e.weekNumber,
        floor: e.floor,
        floorNum: parseFloorName(e.floor),
        slot: displaySlot,
        slotRaw: e.itemSlot,
        playerName: player?.name || e.recipientPlayerName || 'Unknown',
        playerId: e.recipientPlayerId,
        playerJob: player?.job || '',
        playerRole: player?.role || 'melee',
        method: e.method,
        isExtra: e.isExtra,
        weaponJob: e.weaponJob,
        createdAt: e.createdAt,
        originalLoot: e,
      };
    });

    const materialRows: UnifiedRow[] = materialLog.map(e => {
      const player = getPlayer(e.recipientPlayerId);
      return {
        id: e.id,
        type: 'material',
        weekNumber: e.weekNumber,
        floor: e.floor,
        floorNum: parseFloorName(e.floor),
        slot: UPGRADE_MATERIAL_DISPLAY_NAMES[e.materialType as keyof typeof UPGRADE_MATERIAL_DISPLAY_NAMES] || e.materialType,
        slotRaw: e.materialType,
        playerName: player?.name || e.recipientPlayerName || 'Unknown',
        playerId: e.recipientPlayerId,
        playerJob: player?.job || '',
        playerRole: player?.role || 'melee',
        method: e.method,
        isExtra: false,
        slotAugmented: e.slotAugmented ?? undefined,
        createdAt: e.createdAt,
        originalMaterial: e,
      };
    });

    return [...lootRows, ...materialRows];
  }, [lootLog, materialLog, getPlayer]);

  // --- Filter ---
  const filteredRows = useMemo(() => {
    let rows = allRows;

    // Type filter
    if (entryType === 'loot') rows = rows.filter(r => r.type === 'loot');
    if (entryType === 'materials') rows = rows.filter(r => r.type === 'material');

    // Floor filter
    rows = rows.filter(r => activeFloors.has(r.floorNum));

    // Smart search with structured filter syntax (e.g. slot:weapon player:warichard type:extra)
    if (debouncedQuery.trim()) {
      const tokens = debouncedQuery.trim().split(/\s+/);
      const filters: { key: string; value: string }[] = [];
      const freeTerms: string[] = [];

      for (const token of tokens) {
        const colonIdx = token.indexOf(':');
        if (colonIdx > 0 && colonIdx < token.length - 1) {
          filters.push({ key: token.slice(0, colonIdx).toLowerCase(), value: token.slice(colonIdx + 1).toLowerCase() });
        } else {
          freeTerms.push(token.toLowerCase());
        }
      }

      // Apply structured filters (all must match)
      for (const { key, value } of filters) {
        rows = rows.filter(r => {
          switch (key) {
            case 'slot': return r.slot.toLowerCase().includes(value) || r.slotRaw.toLowerCase().includes(value) || (r.weaponJob && r.weaponJob.toLowerCase().includes(value));
            case 'player': return r.playerName.toLowerCase().includes(value);
            case 'type': return value === 'extra' ? r.isExtra : value === 'bis' ? (!r.isExtra && r.type === 'loot') : r.type.toLowerCase().includes(value);
            case 'floor': return r.floor.toLowerCase().includes(value);
            case 'method': return r.method.toLowerCase().includes(value);
            case 'week': { const n = parseInt(value, 10); return !isNaN(n) ? r.weekNumber === n : false; }
            case 'job': return r.playerJob.toLowerCase().includes(value);
            default: return true;
          }
        });
      }

      // Apply free-text terms (each must match somewhere)
      for (const term of freeTerms) {
        // Week pattern shorthand: w3, week3, week 3
        const weekMatch = term.match(/^w(?:eek\s*)?(\d+)$/i);
        if (weekMatch) {
          const weekNum = parseInt(weekMatch[1], 10);
          rows = rows.filter(r => r.weekNumber === weekNum);
        } else {
          rows = rows.filter(r =>
            r.playerName.toLowerCase().includes(term) ||
            r.playerJob.toLowerCase().includes(term) ||
            r.slot.toLowerCase().includes(term) ||
            r.slotRaw.toLowerCase().includes(term) ||
            r.floor.toLowerCase().includes(term) ||
            r.method.toLowerCase().includes(term) ||
            r.type.toLowerCase().includes(term) ||
            (r.weaponJob && r.weaponJob.toLowerCase().includes(term)) ||
            (term === 'extra' && r.isExtra) ||
            (term === 'bis' && !r.isExtra && r.type === 'loot') ||
            `w${r.weekNumber}`.includes(term) ||
            `week ${r.weekNumber}`.includes(term)
          );
        }
      }
    }

    return rows;
  }, [allRows, entryType, activeFloors, debouncedQuery]);

  // --- Sort ---
  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'week': cmp = a.weekNumber - b.weekNumber; break;
        case 'floor': cmp = a.floorNum - b.floorNum; break;
        case 'slot': cmp = a.slot.localeCompare(b.slot); break;
        case 'player': cmp = a.playerName.localeCompare(b.playerName); break;
        case 'method': cmp = a.method.localeCompare(b.method); break;
        case 'date': cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
        case 'type': cmp = Number(a.isExtra) - Number(b.isExtra); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredRows, sortField, sortDir]);

  // --- Handlers ---
  const handleSort = useCallback((field: SortField) => {
    const result = toggleSort(field, sortField, sortDir);
    setSortField(result.field);
    setSortDir(result.direction);
  }, [sortField, sortDir]);

  const toggleFloor = useCallback((floor: FloorNumber) => {
    setActiveFloors(prev => {
      const next = new Set(prev);
      if (next.has(floor)) {
        if (next.size > 1) next.delete(floor);
      } else {
        next.add(floor);
      }
      return next;
    });
  }, []);

  const handleRowClick = useCallback((e: React.MouseEvent, row: UnifiedRow) => {
    // Shift+Click: copy URL
    if (e.shiftKey && onCopyEntryUrl) {
      e.preventDefault();
      window.getSelection()?.removeAllRanges();
      onCopyEntryUrl(row.id, row.type);
      return;
    }
    // Alt+Click: navigate to player
    if (e.altKey && onNavigateToPlayer) {
      e.preventDefault();
      onNavigateToPlayer(row.playerId, row.type === 'loot' ? row.slotRaw : row.slotAugmented);
      return;
    }
    // Regular click: edit
    if (canEdit) {
      if (row.type === 'loot' && row.originalLoot && onEditLoot) {
        onEditLoot(row.originalLoot);
      } else if (row.type === 'material' && row.originalMaterial && onEditMaterial) {
        onEditMaterial(row.originalMaterial);
      }
    }
  }, [canEdit, onEditLoot, onEditMaterial, onCopyEntryUrl, onNavigateToPlayer]);

  const handleContextMenu = useCallback((e: React.MouseEvent, row: UnifiedRow) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, row });
  }, []);

  const getContextMenuItems = useCallback((): ContextMenuItem[] => {
    if (!contextMenu) return [];
    const { row } = contextMenu;
    const items: ContextMenuItem[] = [];

    if (canEdit) {
      if (row.type === 'loot' && row.originalLoot && onEditLoot) {
        items.push({
          label: 'Edit',
          icon: <Pencil className="w-4 h-4" />,
          onClick: () => onEditLoot(row.originalLoot!),
        });
      }
      if (row.type === 'material' && row.originalMaterial && onEditMaterial) {
        items.push({
          label: 'Edit',
          icon: <Pencil className="w-4 h-4" />,
          onClick: () => onEditMaterial(row.originalMaterial!),
        });
      }
    }

    if (onCopyEntryUrl) {
      items.push({
        label: 'Copy URL',
        icon: <Link className="w-4 h-4" />,
        onClick: () => onCopyEntryUrl(row.id, row.type),
      });
    }

    if (onNavigateToPlayer && row.playerId) {
      items.push({
        label: `Jump to ${row.playerName}`,
        icon: <UserRound className="w-4 h-4" />,
        onClick: () => onNavigateToPlayer(row.playerId, row.type === 'loot' ? row.slotRaw : row.slotAugmented),
      });
    }

    // Jump to week navigation
    if (onJumpToWeek) {
      items.push({ separator: true });
      items.push({
        label: `View Week ${row.weekNumber} in Grid`,
        icon: <LayoutGrid className="w-4 h-4" />,
        onClick: () => onJumpToWeek(row.weekNumber, 'grid'),
      });
      items.push({
        label: `View Week ${row.weekNumber} in List`,
        icon: <List className="w-4 h-4" />,
        onClick: () => onJumpToWeek(row.weekNumber, 'split'),
      });
    }

    if (canEdit) {
      items.push({ separator: true });
      if (row.type === 'loot' && row.originalLoot && onDeleteLoot) {
        items.push({
          label: 'Delete',
          icon: <Trash2 className="w-4 h-4" />,
          onClick: () => onDeleteLoot(row.originalLoot!),
          danger: true,
        });
      }
      if (row.type === 'material' && row.originalMaterial && onDeleteMaterial) {
        items.push({
          label: 'Delete',
          icon: <Trash2 className="w-4 h-4" />,
          onClick: () => onDeleteMaterial(row.originalMaterial!),
          danger: true,
        });
      }
    }

    return items;
  }, [contextMenu, canEdit, onEditLoot, onEditMaterial, onDeleteLoot, onDeleteMaterial, onCopyEntryUrl, onNavigateToPlayer, onJumpToWeek]);

  // --- Stats ---
  const stats = useMemo(() => {
    const lootCount = filteredRows.filter(r => r.type === 'loot').length;
    const matCount = filteredRows.filter(r => r.type === 'material').length;
    return { lootCount, matCount, total: lootCount + matCount };
  }, [filteredRows]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // --- Render ---
  return (
    <div className="bg-surface-card border border-border-default rounded-lg flex flex-col max-h-[calc(100vh-16rem)]">
      {/* Header: Search + Filters */}
      <div className="flex-shrink-0 p-4 space-y-3 border-b border-border-default">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(value) => setSearchQuery(value)}
            placeholder="Search... slot:weapon player:name type:bis (Ctrl+Shift+F)"
            className="pl-9 pr-8"
          />
          {searchQuery && (
            /* design-system-ignore: Clear button inside search input requires specific positioning */
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Type Toggle */}
          {/* design-system-ignore: Type toggle requires specific toggle styling */}
          <div className="flex gap-1 bg-surface-raised rounded-lg p-0.5 border border-surface-overlay">
            {(['all', 'loot', 'materials'] as const).map(t => (
              <button
                key={t}
                onClick={() => setEntryType(t)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors font-medium capitalize ${
                  entryType === t
                    ? 'bg-accent/20 text-accent'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'
                }`}
              >
                {t === 'all' ? 'All' : t === 'loot' ? 'Gear' : 'Materials'}
              </button>
            ))}
          </div>

          {/* Floor Filter Chips */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-muted">Floor:</span>
            {([1, 2, 3, 4] as FloorNumber[]).map(floor => {
              const isActive = activeFloors.has(floor);
              const colors = FLOOR_COLORS[floor];
              return (
                /* design-system-ignore: Floor filter chip requires specific styling */
                <button
                  key={floor}
                  onClick={() => toggleFloor(floor)}
                  aria-pressed={isActive}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-colors border ${
                    isActive
                      ? `${colors.bg} ${colors.text} ${colors.border}`
                      : 'border-transparent bg-surface-interactive text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {floors[floor - 1]?.split(' ')[0] || `F${floor}`}
                </button>
              );
            })}
          </div>

          {/* Stats */}
          <div className="ml-auto text-xs text-text-muted">
            {stats.total} {stats.total === 1 ? 'entry' : 'entries'}
            {entryType === 'all' && stats.total > 0 && (
              <span> ({stats.lootCount} gear, {stats.matCount} material)</span>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface-raised z-10">
            <tr>
              <SortableHeader field="week" label="Week" currentField={sortField} currentDirection={sortDir} onSort={handleSort} className="w-16" />
              <SortableHeader field="floor" label="Floor" currentField={sortField} currentDirection={sortDir} onSort={handleSort} className="w-20" />
              <SortableHeader field="slot" label="Slot" currentField={sortField} currentDirection={sortDir} onSort={handleSort} />
              <SortableHeader field="player" label="Player" currentField={sortField} currentDirection={sortDir} onSort={handleSort} />
              <SortableHeader field="method" label="Method" currentField={sortField} currentDirection={sortDir} onSort={handleSort} className="w-24" />
              <SortableHeader field="date" label="Date" currentField={sortField} currentDirection={sortDir} onSort={handleSort} />
              <SortableHeader field="type" label="Type" currentField={sortField} currentDirection={sortDir} onSort={handleSort} align="center" className="w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-muted">
                  {debouncedQuery || entryType !== 'all' || activeFloors.size < 4
                    ? 'No entries match your filters.'
                    : 'No loot or materials logged this tier.'}
                </td>
              </tr>
            ) : (
              sortedRows.map(row => {
                const roleColor = getRoleColor(getValidRole(row.playerRole));
                const isHighlighted =
                  highlightedEntryId === String(row.id) &&
                  (!highlightedEntryType || highlightedEntryType === row.type);
                const methodInfo = METHOD_DISPLAY[row.method] || { label: row.method, className: 'text-text-secondary' };
                const floorColors = FLOOR_COLORS[row.floorNum];

                return (
                  <tr
                    key={`${row.type}-${row.id}`}
                    id={`${row.type}-entry-${row.id}`}
                    className={`hover:bg-surface-elevated/50 transition-colors cursor-pointer select-none ${isHighlighted ? 'highlight-pulse' : ''}`}
                    tabIndex={0}
                    aria-label={`${row.type === 'loot' ? 'Loot' : 'Material'}: ${row.slot} - ${row.playerName}, Week ${row.weekNumber}`}
                    onClick={(e) => handleRowClick(e, row)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleRowClick(e as unknown as React.MouseEvent, row);
                      }
                    }}
                    onContextMenu={(e) => handleContextMenu(e, row)}
                  >
                    {/* Week */}
                    <td className="px-4 py-2.5 text-text-primary font-medium">
                      W{row.weekNumber}
                    </td>

                    {/* Floor */}
                    <td className="px-4 py-2.5">
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded"
                        style={{
                          color: floorColors.hex,
                          backgroundColor: `${floorColors.hex}15`,
                        }}
                      >
                        {row.floor}
                      </span>
                    </td>

                    {/* Slot */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {row.type === 'material' && (
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: `var(--color-material-${MATERIAL_CSS_TOKEN[row.slotRaw] || row.slotRaw})` }}
                          />
                        )}
                        {row.weaponJob && <JobIcon job={row.weaponJob} size="xs" />}
                        <span className="text-text-primary">{row.slot}</span>
                      </div>
                    </td>

                    {/* Player */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded whitespace-nowrap"
                          style={{
                            color: roleColor,
                            backgroundColor: `color-mix(in srgb, ${roleColor} 15%, transparent)`,
                            border: `1px solid color-mix(in srgb, ${roleColor} 30%, transparent)`,
                          }}
                        >
                          {row.playerJob && <JobIcon job={row.playerJob} size="xs" />}
                          <span>{row.playerName}</span>
                        </div>
                      </div>
                    </td>

                    {/* Method */}
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-medium capitalize ${methodInfo.className}`}>
                        {methodInfo.label}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-2.5 text-text-secondary text-xs whitespace-nowrap">
                      {formatDate(row.createdAt)}
                    </td>

                    {/* Type */}
                    <td className="px-4 py-2.5 text-center">
                      {row.type === 'loot' && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          row.isExtra
                            ? 'bg-status-info/15 text-status-info'
                            : 'bg-accent/10 text-accent'
                        }`}>
                          {row.isExtra ? 'Extra' : 'BiS'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
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
