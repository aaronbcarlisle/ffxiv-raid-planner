/**
 * Log Entry Items
 *
 * Memoized components for rendering loot and material log entries.
 * Extracted from SectionedLogView to prevent unnecessary re-renders.
 */

import { memo } from 'react';
import { Link2, Pencil, Trash2 } from 'lucide-react';
import { Tooltip } from '../primitives/Tooltip';
import { IconButton } from '../primitives/IconButton';
import type { LootLogEntry, MaterialLogEntry } from '../../types';
import { GEAR_SLOT_NAMES } from '../../types';
import { JobIcon } from '../ui/JobIcon';

// Format date for display
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

const MATERIAL_LABELS: Record<string, string> = {
  twine: 'Twine',
  glaze: 'Glaze',
  solvent: 'Solvent',
  universal_tomestone: 'Universal Tomestone',
};

interface LootLogEntryItemProps {
  entry: LootLogEntry;
  highlightedEntryId: string | null;
  canEdit: boolean;
  getPlayerName: (playerId: string) => string;
  onCopyUrl: (entryId: string) => void;
  onEdit: (entry: LootLogEntry) => void;
  onDelete: (entry: LootLogEntry) => void;
  onContextMenu: (e: React.MouseEvent, entry: LootLogEntry) => void;
  onNavigateToPlayer?: (playerId: string) => void;
}

export const LootLogEntryItem = memo(function LootLogEntryItem({
  entry,
  highlightedEntryId,
  canEdit,
  getPlayerName,
  onCopyUrl,
  onEdit,
  onDelete,
  onContextMenu,
  onNavigateToPlayer,
}: LootLogEntryItemProps) {
  const slotName = GEAR_SLOT_NAMES[entry.itemSlot as keyof typeof GEAR_SLOT_NAMES] || entry.itemSlot;
  const isWeapon = entry.itemSlot === 'weapon';
  const isHighlighted = highlightedEntryId === String(entry.id);

  const handleClick = (e: React.MouseEvent) => {
    // Shift+Click copies entry URL
    if (e.shiftKey) {
      e.preventDefault();
      window.getSelection()?.removeAllRanges();
      onCopyUrl(String(entry.id));
      return;
    }
    // Alt+Click navigates to player
    if (e.altKey && onNavigateToPlayer) {
      e.preventDefault();
      onNavigateToPlayer(entry.recipientPlayerId);
      return;
    }
  };

  return (
    <div
      id={`loot-entry-${entry.id}`}
      className={`bg-surface-elevated border-l-2 border-l-accent rounded-lg p-3 cursor-pointer select-none ${isHighlighted ? 'highlight-pulse' : ''}`}
      onClick={handleClick}
      onContextMenu={(e) => onContextMenu(e, entry)}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated text-text-muted border border-border-subtle">
              {entry.floor}
            </span>
            {isWeapon && entry.weaponJob && (
              <JobIcon job={entry.weaponJob} size="sm" />
            )}
            <span className="text-text-primary font-medium">
              {isWeapon && entry.weaponJob ? `Weapon (${entry.weaponJob})` : slotName}
            </span>
            <span className="text-text-muted">→</span>
            <span className="text-text-primary">{getPlayerName(entry.recipientPlayerId)}</span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${
                entry.method === 'drop'
                  ? 'bg-status-success/20 text-status-success'
                  : 'bg-status-warning/20 text-status-warning'
              }`}
            >
              {entry.method}
            </span>
            {entry.isExtra && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-surface-elevated text-text-muted border border-border-subtle">
                Extra
              </span>
            )}
          </div>
          <div className="text-xs text-text-muted mt-1">
            {formatDate(entry.createdAt)}
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 ml-4">
          <Tooltip content="Copy link to this entry">
            <IconButton
              icon={<Link2 className="w-4 h-4" />}
              onClick={() => onCopyUrl(String(entry.id))}
              variant="ghost"
              size="sm"
              aria-label="Copy link to this entry"
            />
          </Tooltip>
          {canEdit && (
            <>
              <Tooltip content="Edit entry">
                <IconButton
                  icon={<Pencil className="w-4 h-4" />}
                  onClick={() => onEdit(entry)}
                  variant="ghost"
                  size="sm"
                  aria-label="Edit entry"
                />
              </Tooltip>
              <Tooltip content="Delete entry">
                <IconButton
                  icon={<Trash2 className="w-4 h-4" />}
                  onClick={() => onDelete(entry)}
                  variant="danger"
                  size="sm"
                  aria-label="Delete entry"
                />
              </Tooltip>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

interface MaterialLogEntryItemProps {
  entry: MaterialLogEntry;
  highlightedEntryId: string | null;
  highlightedEntryType: 'loot' | 'material' | null;
  canEdit: boolean;
  getPlayerName: (playerId: string) => string;
  onCopyUrl: (entryId: string, entryType: 'material') => void;
  onEdit: (entry: MaterialLogEntry) => void;
  onDelete: (entryId: number) => void;
  onContextMenu: (e: React.MouseEvent, entry: MaterialLogEntry) => void;
  onNavigateToPlayer?: (playerId: string) => void;
}

export const MaterialLogEntryItem = memo(function MaterialLogEntryItem({
  entry,
  highlightedEntryId,
  highlightedEntryType,
  canEdit,
  getPlayerName,
  onCopyUrl,
  onEdit,
  onDelete,
  onContextMenu,
  onNavigateToPlayer,
}: MaterialLogEntryItemProps) {
  const isMatHighlighted = highlightedEntryId === String(entry.id) && highlightedEntryType === 'material';

  const handleClick = (e: React.MouseEvent) => {
    // Shift+Click copies entry URL
    if (e.shiftKey) {
      e.preventDefault();
      window.getSelection()?.removeAllRanges();
      onCopyUrl(String(entry.id), 'material');
      return;
    }
    // Alt+Click navigates to player
    if (e.altKey && onNavigateToPlayer) {
      e.preventDefault();
      onNavigateToPlayer(entry.recipientPlayerId);
      return;
    }
  };

  return (
    <div
      id={`material-entry-${entry.id}`}
      className={`bg-surface-elevated border-l-2 border-l-accent rounded-lg p-3 cursor-pointer select-none ${isMatHighlighted ? 'highlight-pulse' : ''}`}
      onClick={handleClick}
      onContextMenu={(e) => onContextMenu(e, entry)}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated text-text-muted border border-border-subtle">
              {entry.floor}
            </span>
            <span className={`font-medium ${
              entry.materialType === 'twine' ? 'text-material-twine' :
              entry.materialType === 'glaze' ? 'text-material-glaze' :
              entry.materialType === 'universal_tomestone' ? 'text-material-tomestone' :
              'text-material-solvent'
            }`}>
              {MATERIAL_LABELS[entry.materialType]}
            </span>
            <span className="text-text-muted">→</span>
            <span className="text-text-primary">{getPlayerName(entry.recipientPlayerId)}</span>
          </div>
          <div className="text-xs text-text-muted mt-1">
            {formatDate(entry.createdAt)}
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 ml-4">
          <Tooltip content="Copy link to this entry">
            <IconButton
              icon={<Link2 className="w-4 h-4" />}
              onClick={() => onCopyUrl(String(entry.id), 'material')}
              variant="ghost"
              size="sm"
              aria-label="Copy link to this entry"
            />
          </Tooltip>
          {canEdit && (
            <>
              <Tooltip content="Edit entry">
                <IconButton
                  icon={<Pencil className="w-4 h-4" />}
                  onClick={() => onEdit(entry)}
                  variant="ghost"
                  size="sm"
                  aria-label="Edit entry"
                />
              </Tooltip>
              <Tooltip content="Delete entry">
                <IconButton
                  icon={<Trash2 className="w-4 h-4" />}
                  onClick={() => onDelete(entry.id)}
                  variant="ghost"
                  size="sm"
                  aria-label="Delete entry"
                  className="text-status-error hover:text-status-error hover:bg-status-error/10"
                />
              </Tooltip>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
