/**
 * ObjectivesCard (ring0 `home/`; S2a-5a·C2a Task C2-1, R-M-4, O-3, O-5, C-3, C-4): the static's
 * active objectives, every one in full with no cap, below the Farm card. Not Doing is hidden, as on
 * V1's Home.
 *
 * It sends nothing: Home fetches. It reads the effective role, View As included, so a masked admin
 * or a View As of a non-member sees no card, as with `TrackCard`. It hides after a failed load with
 * no line and no Retry (C-4; the list and the Retry stay in the editor on Recruit ▸ Listing), and it
 * stays up while a refetch is `loading`, so a warm list doesn't blink on return to Home. The store is
 * unkeyed, so `objectiveCardRows` keeps only this static's rows.
 *
 * Edit opens Recruit ▸ Listing, for those who can manage the static; the card itself edits nothing.
 *
 * Boundary discipline (ring0): reads a store and pure `utils/`; never imports `static-group/`.
 */
import { useMemo } from 'react';
import { Target } from 'lucide-react';
import { useObjectiveGoalStore } from '../../stores/objectiveGoalStore';
import { useStaticPermissions } from '../../hooks/useStaticPermissions';
import { objectiveCardRows } from '../../utils/objectiveCardModel';
import type { StaticGroup } from '../../types';
import { CardShell } from '../ui/CardShell';
import { LinkText } from '../ui/LinkText';

interface ObjectivesCardProps {
  group: StaticGroup;
  canManage: boolean;
  /** Opens the editor (Recruit ▸ Listing). */
  onEdit?: () => void;
}

export function ObjectivesCard({ group, canManage, onEdit }: ObjectivesCardProps) {
  const objectives = useObjectiveGoalStore((s) => s.objectives);
  const objectivesError = useObjectiveGoalStore((s) => s.objectivesError);
  const { userRole } = useStaticPermissions();

  const rows = useMemo(() => objectiveCardRows(objectives, group.id), [objectives, group.id]);

  if (userRole == null || objectivesError !== null || rows.length === 0) return null;

  return (
    <CardShell
      as="div"
      title="Objectives"
      icon={<Target size={14} />}
      headerRight={
        canManage && onEdit ? (
          <LinkText onClick={onEdit} aria-label="Edit objectives">
            Edit
          </LinkText>
        ) : undefined
      }
    >
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-text-primary">{row.title}</span>
            <span className="text-xs text-text-secondary">{row.meta}</span>
            {row.description && <span className="text-xs text-text-secondary">{row.description}</span>}
          </li>
        ))}
      </ul>
    </CardShell>
  );
}
