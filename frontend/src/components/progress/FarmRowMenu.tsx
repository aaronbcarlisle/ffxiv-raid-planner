/**
 * FarmRowMenu — a lead's ⋯ menu on a farm row (S2a-3a·G4 Task TG7; D-9 as amended by D-22, D-10,
 * D-11, R-S3-17). An `IconButton` "Actions for {title}" (`aria-haspopup="menu"`) opening a
 * `ContextMenu` at the button: Mark finished · Delete on an active row, Reopen · Delete on a
 * finished one (TG8 prepends Edit). Leads only; the row renders nothing for anyone else.
 *
 * Mark finished and Reopen are `useGoalStatus`'s. Delete asks first (V1's confirm, word for
 * word): "Delete Goal", `Delete "{title}"? This will remove all participant states and drop
 * history for this goal.`, danger, label "Delete"; confirming calls the store's `deleteGoal`. The
 * row is gone as the store drops the goal, and the page closes its panel and clears `?track` (it
 * names no goal any more), so the confirm unmounts with the row, and focus goes to the farm beside
 * it (`focusAfterDelete`). A failure toasts and keeps the confirm open.
 *
 * Focus: closing the menu returns it to the button, so the confirm's own restore (it records the
 * focused element when it opens) lands there too, never on the vanished menu item. The button
 * takes the matrix's roving props on an active row (`grid`, R-S3-17); on a Finished row it is a
 * plain tab stop.
 */
import { useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';
import { wasToastedByApi } from '../../services/api';
import { useCollectionGoalStore, type CollectionGoal } from '../../stores/collectionGoalStore';
import { toast } from '../../stores/toastStore';
import { IconButton } from '../primitives';
import { ConfirmModal } from '../ui/ConfirmModal';
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu';
import { focusAfterDelete, neighbourFarmId } from './farmFocus';
import { messageOf } from './undoToasts';
import type { MatrixCellProps } from './useMatrixKeyboard';
import { useGoalStatus } from './useGoalStatus';

interface FarmRowMenuProps {
  groupId: string;
  goal: CollectionGoal;
  /** The matrix's roving props for this cell (`'__menu'`); absent on a Finished row. */
  grid?: MatrixCellProps;
}

export function FarmRowMenu({ groupId, goal, grid }: FarmRowMenuProps) {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const { markFinished, reopen } = useGoalStatus(groupId, goal);
  const finished = goal.status === 'complete';

  const closeMenu = () => {
    setAnchor(null);
    buttonRef.current?.focus({ preventScroll: true });
  };

  const items: ContextMenuItem[] = [
    finished
      ? { label: 'Reopen', onClick: () => void reopen() }
      : { label: 'Mark finished', accent: true, onClick: () => void markFinished() },
    { separator: true },
    { label: 'Delete', danger: true, onClick: () => setConfirming(true) },
  ];

  const confirmDelete = async () => {
    // The farm beside this one, read while the row is still here: it takes the focus the row held.
    const neighbour = buttonRef.current ? neighbourFarmId(buttonRef.current) : null;
    try {
      await useCollectionGoalStore.getState().deleteGoal(groupId, goal.id);
    } catch (err) {
      if (!wasToastedByApi(err)) toast.error(`Couldn't delete the goal: ${messageOf(err)}`);
      return;
    }
    toast.success('Farm deleted.');
    setConfirming(false);
    focusAfterDelete(neighbour);
  };

  return (
    <>
      <IconButton
        {...grid}
        ref={(el) => {
          buttonRef.current = el;
          grid?.ref(el);
        }}
        aria-label={`Actions for ${goal.title}`}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        icon={<MoreVertical size={16} aria-hidden="true" />}
        variant="ghost"
        size="sm"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setAnchor({ x: rect.left, y: rect.bottom });
        }}
      />
      {anchor !== null && <ContextMenu x={anchor.x} y={anchor.y} items={items} onClose={closeMenu} />}
      <ConfirmModal
        isOpen={confirming}
        onCancel={() => setConfirming(false)}
        onConfirm={confirmDelete}
        title="Delete Goal"
        message={`Delete "${goal.title}"? This will remove all participant states and drop history for this goal.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}
