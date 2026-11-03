/**
 * ProgressToolbar — the Progress view bar (S2a-4a·A2 Task TA2; R-F-4, D-5, E-7, R-S2-17).
 *
 * In DOM order: the "Progress view" switch (Tracks, Find), Track a farm for leads only, then the
 * page's `editBar` (the Edit statuses row), which is hidden in Find. It renders for every member
 * role, so the order keeps Tab running from Edit statuses into the tier row below it. The switch's
 * group is one control, so a lead meets four controls or fewer in every state.
 */
import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../primitives/Button';
import { SegmentedToggle } from '../ui/SegmentedToggle';
import type { ProgressViewName } from './useProgressView';

const VIEW_OPTIONS: { value: ProgressViewName; label: string }[] = [
  { value: 'tracks', label: 'Tracks' },
  { value: 'find', label: 'Find' },
];

interface ProgressToolbarProps {
  view: ProgressViewName;
  onView: (view: ProgressViewName) => void;
  /** The reader may manage the static: Track a farm shows. */
  lead: boolean;
  /** The existing Edit statuses bar, or null. Hidden in Find. */
  editBar: ReactNode;
  onTrackFarm: () => void;
}

export function ProgressToolbar({ view, onView, lead, editBar, onTrackFarm }: ProgressToolbarProps) {
  return (
    <div data-testid="progress-view-bar" className="flex flex-wrap items-center gap-2">
      <SegmentedToggle ariaLabel="Progress view" options={VIEW_OPTIONS} value={view} onChange={onView} />
      {lead && (
        <Button variant="secondary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" aria-hidden />} onClick={onTrackFarm}>
          Track a farm
        </Button>
      )}
      {view === 'tracks' && editBar}
    </div>
  );
}
