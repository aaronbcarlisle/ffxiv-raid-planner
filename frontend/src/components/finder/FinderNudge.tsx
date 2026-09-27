/**
 * FinderNudge — nudges a signed-in viewer to fill in what the fit engine is
 * missing (R-SF-P "Nudge"). `viewer: null` (a guest) renders nothing.
 */
import { useNavigate } from 'react-router-dom';
import { LinkText } from '../ui/LinkText';
import type { FitViewer } from './types';

interface FinderNudgeProps {
  viewer: FitViewer | null;
}

export function FinderNudge({ viewer }: FinderNudgeProps) {
  const navigate = useNavigate();
  if (!viewer) return null;

  const missingTemplate = viewer.missing.includes('template');
  const missingJobs = viewer.missing.includes('jobs');
  if (!missingTemplate && !missingJobs) return null;

  return (
    <div data-testid="finder-nudge" className="bg-accent/5 border border-accent/20 rounded-lg p-3 text-sm text-text-secondary flex flex-col gap-1">
      {missingTemplate && (
        <p>
          Add your typical week on the Hub to match raid times.{' '}
          <LinkText onClick={() => navigate('/profile?tab=availability')}>Set your typical week</LinkText>
        </p>
      )}
      {missingJobs && (
        <p>
          Add your jobs on the Hub to match open roles.{' '}
          <LinkText onClick={() => navigate('/profile?tab=characters')}>Add jobs</LinkText>
        </p>
      )}
    </div>
  );
}
