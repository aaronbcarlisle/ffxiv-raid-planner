/**
 * FarmRow — one farm of the Progress matrix (R-S2-7): "{title} · {type}" with its
 * type icon, a "Wanted" / "Scheduled" tag when it isn't Farming (Q-3), the status
 * column ("{n} of {m} have it"), then one cell per column. Read-only in F3; S2a-3a
 * adds the row menu and "Mark finished".
 */
import { Tag } from '../ui/Tag';
import { GOAL_TYPE_ICONS, GOAL_TYPE_LABELS } from '../../utils/goalTypeMeta';
import type { FarmRow as FarmRowModel } from '../../utils/progressModel';
import { ProgressCell } from './ProgressCell';

interface FarmRowProps {
  row: FarmRowModel;
  /** Leads read "Everyone has it" at n = m; everyone else reads the count. */
  canManage: boolean;
}

function statusText(tally: FarmRowModel['tally'], canManage: boolean): string {
  if (tally.m === 0) return 'Nobody to track yet';
  if (tally.everyone && canManage) return 'Everyone has it';
  return `${tally.n} of ${tally.m} have it`;
}

export function FarmRow({ row, canManage }: FarmRowProps) {
  const { goal } = row;
  const TypeIcon = GOAL_TYPE_ICONS[goal.goalType];
  const stateTag = goal.status === 'wanted' ? 'Wanted' : goal.status === 'scheduled' ? 'Scheduled' : null;
  return (
    <tr data-testid="progress-farm-row" data-goal-id={goal.id} className="border-t border-border-subtle">
      <th scope="row" className="px-3 py-2 text-left align-middle font-normal">
        <div className="flex items-center gap-2">
          <TypeIcon size={16} className="shrink-0 text-accent" aria-hidden="true" />
          <span className="whitespace-nowrap text-sm font-medium text-text-primary">
            {`${goal.title} · ${GOAL_TYPE_LABELS[goal.goalType]}`}
          </span>
          {stateTag !== null && <Tag variant="label">{stateTag}</Tag>}
        </div>
      </th>
      <td data-testid="progress-status" className="whitespace-nowrap px-3 py-2 text-sm text-text-secondary">
        {statusText(row.tally, canManage)}
      </td>
      {row.cells.map((cell) => (
        <ProgressCell key={cell.column.key} cell={cell} goal={goal} />
      ))}
    </tr>
  );
}
