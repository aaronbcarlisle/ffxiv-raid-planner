/**
 * LootEntryRow — the History table's row anatomy (spec §5.6; mockup `.wk`
 * pill + `.src` 30px badge). Presentational only: no store access. Task 8
 * supplies the `HistoryItem[]` data, Task 9 wires the edit/delete handlers.
 */
import { MoreVertical } from 'lucide-react';
import { PlayerIdentity, Tag } from '../ui';
import { IconButton } from '../primitives/IconButton';
import { Dropdown, DropdownTrigger, DropdownContent, DropdownItem } from '../primitives/Dropdown';
import { getValidRole } from '../../gamedata';
import { relativeTime } from '../../utils/staticActivity';
import { GEAR_SLOT_NAMES } from '../../types';
import { UPGRADE_MATERIAL_DISPLAY_NAMES } from '../../gamedata/loot-tables';
import type { LootLogEntry, MaterialLogEntry, SnapshotPlayer } from '../../types';

export type HistoryItem =
  | { kind: 'loot'; entry: LootLogEntry }
  | { kind: 'material'; entry: MaterialLogEntry };

export interface LootEntryRowProps {
  item: HistoryItem;
  /** role/job lookup; fall back to the entry's stored `recipientPlayerName`. */
  playersById: Map<string, SnapshotPlayer>;
  /** fight names → the "· F{n}" suffix. */
  floors: string[];
  canEdit: boolean;
  highlighted?: boolean;
  /** loot rows only. */
  onEdit?: (entry: LootLogEntry) => void;
  onCopyLink?: (item: HistoryItem) => void;
  onDelete?: (item: HistoryItem) => void;
}

function SourceBadge({ children, className }: { children: string; className: string }) {
  return (
    <span
      aria-hidden="true"
      data-testid="source-badge"
      className={`grid h-[30px] w-[30px] place-items-center rounded-md font-display text-xs font-extrabold ${className}`}
    >
      {children}
    </span>
  );
}

function Recipient({ item, playersById }: Pick<LootEntryRowProps, 'item' | 'playersById'>) {
  const { entry } = item;
  const player = playersById.get(entry.recipientPlayerId);
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span aria-hidden="true" className="text-text-tertiary">
        →
      </span>
      {player ? (
        <PlayerIdentity variant="inline" name={player.name} job={player.job} role={getValidRole(player.role)} />
      ) : (
        <PlayerIdentity variant="inline" name={entry.recipientPlayerName} />
      )}
    </div>
  );
}

function floorText(floor: string, floors: string[]): string {
  if (!floor) return '—';
  const idx = floors.indexOf(floor);
  return `${floor}${idx >= 0 ? ` · F${idx + 1}` : ''}`;
}

export function LootEntryRow({
  item,
  playersById,
  floors,
  canEdit,
  highlighted = false,
  onEdit,
  onCopyLink,
  onDelete,
}: LootEntryRowProps) {
  const { kind, entry } = item;
  const rowId = kind === 'loot' ? `loot-entry-${entry.id}` : `material-entry-${entry.id}`;
  const rowClassName = `flex items-center gap-3 border-b border-border-subtle px-4 py-2.5${
    highlighted ? ' highlight-pulse' : ''
  }`;

  let badge: React.ReactNode;
  let itemNode: React.ReactNode;
  let reasonTag: React.ReactNode;

  if (kind === 'loot') {
    const isTome = entry.method === 'tome' || entry.method === 'purchase';
    badge = isTome ? (
      <SourceBadge className="bg-gear-tome/25 text-text-primary">T</SourceBadge>
    ) : (
      <SourceBadge className="bg-gear-raid/25 text-text-primary">R</SourceBadge>
    );

    const slotName = GEAR_SLOT_NAMES[entry.itemSlot as keyof typeof GEAR_SLOT_NAMES] ?? entry.itemSlot;
    itemNode = (
      <div className="min-w-0">
        <div className="font-medium text-text-primary">{slotName}</div>
        <div className="text-xs text-text-tertiary">
          {`${entry.itemSlot} · ${entry.method}${entry.isExtra ? ' · extra' : ''}`}
        </div>
      </div>
    );

    reasonTag = entry.isExtra ? (
      <Tag variant="label" tone="muted">
        free / sell
      </Tag>
    ) : (
      <Tag variant="label" tone="success">
        BiS need
      </Tag>
    );
  } else {
    badge = <SourceBadge className="bg-gear-augmented/30 text-text-primary">A</SourceBadge>;

    itemNode = (
      <div className="min-w-0">
        <div className="font-medium text-text-primary">
          {UPGRADE_MATERIAL_DISPLAY_NAMES[entry.materialType]}
        </div>
        <div className="text-xs text-text-tertiary">Upgrade material</div>
      </div>
    );

    reasonTag = (
      <Tag variant="label" tone="muted">
        {`aug ${entry.slotAugmented ?? 'tome wpn'}`}
      </Tag>
    );
  }

  return (
    <div id={rowId} className={rowClassName}>
      {badge}
      {itemNode}
      <Recipient item={item} playersById={playersById} />
      {reasonTag}
      <span className="text-xs text-text-tertiary">{floorText(entry.floor, floors)}</span>
      <span className="text-xs text-text-tertiary">{relativeTime(entry.createdAt)}</span>
      <Dropdown>
        <DropdownTrigger asChild>
          <IconButton aria-label="Entry actions" icon={<MoreVertical className="h-4 w-4" />} variant="ghost" size="sm" />
        </DropdownTrigger>
        <DropdownContent align="end">
          {kind === 'loot' && canEdit && (
            <DropdownItem onSelect={() => onEdit?.(entry)}>Edit</DropdownItem>
          )}
          <DropdownItem onSelect={() => onCopyLink?.(item)}>Copy link</DropdownItem>
          {canEdit && (
            <DropdownItem danger onSelect={() => onDelete?.(item)}>
              Delete
            </DropdownItem>
          )}
        </DropdownContent>
      </Dropdown>
    </div>
  );
}
