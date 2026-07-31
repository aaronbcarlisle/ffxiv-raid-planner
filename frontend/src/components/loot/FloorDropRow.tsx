/* eslint-disable react-refresh/only-export-components -- MATERIAL_TOKEN is exported alongside the component so the v2 NeedMatrix (Phase-D D3, director M-6) can reuse the same material→color map instead of a fourth copy. */
/**
 * FloorDropRow — one droppable item inside a FloorCard (F6d §5.2; Phase-D R-8).
 *
 * R-8 split what the old coloured letter square conflated (slot + status +
 * floor in one 16px element) so each element says one thing:
 *   - gear rows lead with the generic monochrome `GearSlotIcon` — it reads as
 *     an icon, not a status — and the gear NAME carries the floor colour;
 *   - material rows keep the material-token letter square (their identity
 *     language is the material tokens, not the floor — R-19's rule).
 * Both keep the same 34px leading well so names align down the card.
 */
import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Button, IconButton, Tooltip } from '../primitives';
import { PriorityRow, type PriorityRowEntry } from '../ui';
import { GearSlotIcon } from '../ui/GearSlotIcon';
import { FLOOR_TEXT_CLASS } from './floorClasses';
import type { FloorNumber } from '../../gamedata/loot-tables';
import type { MaterialType, GearSlot } from '../../types';

export interface FloorDropRowProps {
  kind: 'gear' | 'material';
  label: string;                       // "Weapon" / "Ring" / "Twine"
  subLabel: string;                    // "Weapon · raid" / "Upgrade material"
  /** Which floor drops this — colours the gear name (R-8). */
  floorNumber: FloorNumber;
  slot?: GearSlot | 'ring';
  material?: MaterialType;
  entries: PriorityRowEntry[];
  canEdit: boolean;
  onAssign: () => void;
  /** Disable the Assign button (e.g. an empty roster → nobody to assign to). */
  disableAssign?: boolean;
  /** D3 R-6: the queue's "why this order" popover content. Undefined → no
   *  trigger renders at all (material rows never pass this). */
  why?: ReactNode;
}

export const MATERIAL_TOKEN: Record<string, string> = {
  twine: 'var(--color-material-twine)',
  glaze: 'var(--color-material-glaze)',
  solvent: 'var(--color-material-solvent)',
  universal_tomestone: 'var(--color-material-tomestone)',
};

export function FloorDropRow({
  kind, label, subLabel, floorNumber, slot, material, entries, canEdit, onAssign, disableAssign = false, why,
}: FloorDropRowProps) {
  const materialTone = MATERIAL_TOKEN[material ?? ''] ?? 'var(--color-accent)';
  return (
    <div className="flex items-center gap-3.5 border-b border-border-subtle px-4 py-3 last:border-b-0">
      <div className="flex w-[230px] flex-none items-center gap-2.5">
        {kind === 'gear' && slot ? (
          <span className="grid h-[34px] w-[34px] flex-none place-items-center text-text-secondary">
            <GearSlotIcon slot={slot} size={22} />
          </span>
        ) : (
          <span
            aria-hidden
            className="grid h-[34px] w-[34px] flex-none place-items-center rounded-lg font-display text-xs font-extrabold"
            style={{
              backgroundColor: `color-mix(in srgb, ${materialTone} 22%, transparent)`,
              color: materialTone,
            }}
          >
            {label.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0">
          <div
            className={`truncate text-sm font-bold ${kind === 'gear' ? FLOOR_TEXT_CLASS[floorNumber] : 'text-text-primary'}`}
          >
            {label}
          </div>
          <div className="truncate text-xs text-text-tertiary">{subLabel}</div>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <PriorityRow entries={entries} />
      </div>
      {why !== undefined && (
        <div className="flex-none">
          <Tooltip content={why} side="left">
            {/* No onClick by design: Radix opens on hover AND focus, and a click
                focuses. Dead on touch — recorded Phase-P item (mobile deferral). */}
            <IconButton
              variant="ghost"
              size="sm"
              aria-label={`Why this order for ${label}`}
              icon={<Info className="h-3.5 w-3.5" aria-hidden />}
            />
          </Tooltip>
        </div>
      )}
      {canEdit && (
        <div className="flex-none">
          <Button variant="secondary" size="sm" onClick={onAssign} disabled={disableAssign}>Assign</Button>
        </div>
      )}
    </div>
  );
}
