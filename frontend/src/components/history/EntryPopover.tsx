/**
 * Entry Popover
 *
 * Shows all loot entries for a grid cell when multiple entries exist.
 * Triggered by clicking the ×N badge on a multi-entry cell.
 */

import { useRef, useEffect, useCallback } from 'react';
import { JobIcon } from '../ui/JobIcon';
import { getRoleColor, type Role } from '../../gamedata';
import type { SnapshotPlayer, LootLogEntry } from '../../types';
import { GEAR_SLOT_NAMES } from '../../types';

/** Method display info */
const METHOD_BADGE: Record<string, { label: string; className: string }> = {
  drop: { label: 'Drop', className: 'bg-status-success/15 text-status-success' },
  purchase: { label: 'Purchase', className: 'bg-status-warning/15 text-status-warning' },
  book: { label: 'Book', className: 'bg-accent/15 text-accent' },
  tome: { label: 'Tome', className: 'bg-blue-400/15 text-blue-400' },
};

interface EntryPopoverProps {
  entries: LootLogEntry[];
  players: SnapshotPlayer[];
  anchorRect: DOMRect;
  onClose: () => void;
  onEdit?: (entry: LootLogEntry) => void;
}

export function EntryPopover({ entries, players, anchorRect, onClose, onEdit }: EntryPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  const getPlayer = (playerId: string) => players.find(p => p.id === playerId);

  const validRoles: Role[] = ['tank', 'healer', 'melee', 'ranged', 'caster'];
  const getValidRole = (role: string): Role =>
    validRoles.includes(role as Role) ? role as Role : 'melee';

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use setTimeout so the click that opened the popover doesn't immediately close it
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Position the popover below the badge, centered
  const style: React.CSSProperties = {
    position: 'fixed',
    top: anchorRect.bottom + 4,
    left: Math.max(8, anchorRect.left + anchorRect.width / 2 - 140),
    zIndex: 50,
    width: 280,
  };

  // If popover would go off the bottom, show above
  if (anchorRect.bottom + 200 > window.innerHeight) {
    style.top = anchorRect.top - 4;
    style.transform = 'translateY(-100%)';
  }

  const handleEntryClick = useCallback((e: React.MouseEvent, entry: LootLogEntry) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(entry);
      onClose();
    }
  }, [onEdit, onClose]);

  const slotName = entries[0] ? (GEAR_SLOT_NAMES[entries[0].itemSlot as keyof typeof GEAR_SLOT_NAMES] || entries[0].itemSlot) : 'Slot';

  return (
    <div ref={popoverRef} style={style} className="bg-surface-card border border-border-default rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border-default bg-surface-raised">
        <div className="text-xs font-medium text-text-primary">
          {entries.length} {slotName} {entries.length === 1 ? 'entry' : 'entries'}
        </div>
      </div>

      {/* Entry list */}
      <div className="max-h-48 overflow-y-auto divide-y divide-border-subtle">
        {entries.map(entry => {
          const player = getPlayer(entry.recipientPlayerId);
          const roleColor = player ? getRoleColor(getValidRole(player.role)) : 'var(--color-text-secondary)';
          const methodInfo = METHOD_BADGE[entry.method] || { label: entry.method, className: 'bg-surface-elevated text-text-secondary' };

          return (
            <div
              key={entry.id}
              className={`px-3 py-2 hover:bg-surface-elevated/50 transition-colors ${onEdit ? 'cursor-pointer' : ''}`}
              onClick={(e) => handleEntryClick(e, entry)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div
                    className="inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded whitespace-nowrap"
                    style={{
                      color: roleColor,
                      backgroundColor: `color-mix(in srgb, ${roleColor} 15%, transparent)`,
                    }}
                  >
                    {player && <JobIcon job={player.job} size="xs" />}
                    <span>{player?.name || 'Unknown'}</span>
                  </div>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${methodInfo.className}`}>
                    {methodInfo.label}
                  </span>
                </div>
                <span className="text-[10px] text-text-muted whitespace-nowrap flex-shrink-0">
                  {formatDate(entry.createdAt)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
