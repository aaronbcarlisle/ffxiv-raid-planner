/**
 * FloorDropRow — one droppable item inside a FloorCard (F6d, spec §5.2).
 * Mockup 03-loot-priority.html `.drop`: item icon + name/slot line +
 * PriorityRow queue + an "Assign" button (canEdit; NO trailing arrow, DS §4.1).
 */
import { Button } from '../primitives';
import { PriorityRow, type PriorityRowEntry } from '../ui';
import type { MaterialType, GearSlot } from '../../types';

export interface FloorDropRowProps {
  kind: 'gear' | 'material';
  label: string;                       // "Weapon" / "Ring" / "Twine"
  subLabel: string;                    // "Weapon · raid" / "Upgrade material"
  slot?: GearSlot | 'ring';
  material?: MaterialType;
  entries: PriorityRowEntry[];
  canEdit: boolean;
  onAssign: () => void;
}

const MATERIAL_TOKEN: Record<string, string> = {
  twine: 'var(--color-material-twine)',
  glaze: 'var(--color-material-glaze)',
  solvent: 'var(--color-material-solvent)',
  universal_tomestone: 'var(--color-material-tomestone)',
};

export function FloorDropRow({ kind, label, subLabel, material, entries, canEdit, onAssign }: FloorDropRowProps) {
  const tone = kind === 'gear' ? 'var(--color-gear-raid)' : MATERIAL_TOKEN[material ?? ''] ?? 'var(--color-accent)';
  return (
    <div className="flex items-center gap-3.5 border-b border-border-subtle px-4 py-3 last:border-b-0">
      <div className="flex w-[230px] flex-none items-center gap-2.5">
        <span
          aria-hidden
          className="grid h-[34px] w-[34px] flex-none place-items-center rounded-lg font-display text-xs font-extrabold"
          style={{
            backgroundColor: `color-mix(in srgb, ${tone} 22%, transparent)`,
            color: tone,
          }}
        >
          {label.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-text-primary">{label}</div>
          <div className="truncate text-xs text-text-tertiary">{subLabel}</div>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <PriorityRow entries={entries} />
      </div>
      {canEdit && (
        <div className="flex-none">
          <Button variant="secondary" size="sm" onClick={onAssign}>Assign</Button>
        </div>
      )}
    </div>
  );
}
