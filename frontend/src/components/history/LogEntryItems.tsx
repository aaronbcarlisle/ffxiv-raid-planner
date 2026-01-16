/**
 * Log Entry Items
 *
 * Memoized components for rendering loot and material log entries.
 * Extracted from SectionedLogView to prevent unnecessary re-renders.
 */

import { memo } from 'react';
import { Tooltip } from '../primitives/Tooltip';
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
}: LootLogEntryItemProps) {
  const slotName = GEAR_SLOT_NAMES[entry.itemSlot as keyof typeof GEAR_SLOT_NAMES] || entry.itemSlot;
  const isWeapon = entry.itemSlot === 'weapon';
  const isHighlighted = highlightedEntryId === String(entry.id);

  return (
    <div
      id={`loot-entry-${entry.id}`}
      className={`bg-surface-elevated border-l-2 border-l-accent rounded-lg p-3 ${isHighlighted ? 'highlight-pulse' : ''}`}
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
        <div className="flex items-center gap-3 ml-4">
          <Tooltip content="Copy link to this entry">
            <button
              onClick={() => onCopyUrl(String(entry.id))}
              className="text-text-muted hover:text-accent text-sm"
            >
              Copy URL
            </button>
          </Tooltip>
          {canEdit && (
            <>
              <Tooltip content="Edit entry">
                <button
                  onClick={() => onEdit(entry)}
                  className="text-text-muted hover:text-accent text-sm"
                >
                  Edit
                </button>
              </Tooltip>
              <Tooltip content="Delete entry">
                <button
                  onClick={() => onDelete(entry)}
                  className="text-status-error hover:text-status-error/80 text-sm"
                >
                  Delete
                </button>
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
}: MaterialLogEntryItemProps) {
  const isMatHighlighted = highlightedEntryId === String(entry.id) && highlightedEntryType === 'material';

  return (
    <div
      id={`material-entry-${entry.id}`}
      className={`bg-surface-elevated border-l-2 border-l-accent rounded-lg p-3 ${isMatHighlighted ? 'highlight-pulse' : ''}`}
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
        <div className="flex items-center gap-3 ml-4">
          <Tooltip content="Copy link to this entry">
            <button
              onClick={() => onCopyUrl(String(entry.id), 'material')}
              className="text-text-muted hover:text-accent text-sm"
            >
              Copy URL
            </button>
          </Tooltip>
          {canEdit && (
            <>
              <Tooltip content="Edit entry">
                <button
                  onClick={() => onEdit(entry)}
                  className="text-text-muted hover:text-accent text-sm"
                >
                  Edit
                </button>
              </Tooltip>
              <Tooltip content="Delete entry">
                <button
                  onClick={() => onDelete(entry.id)}
                  className="text-status-error hover:text-status-error/80 text-sm"
                >
                  Delete
                </button>
              </Tooltip>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
