/**
 * RecruitHeader — the Recruiting page's PageHeader (R-RH-G frame, R-RH-L).
 *
 * Subtitle: `Live` / `Listing off` (public and enabled), the status label, and
 * the waiting count when there is one (`N still waiting` while paused or
 * closed). The status `Select` renders on the Applicants and Invites tabs
 * only: on the Listing tab the editor's own status cards are the single write
 * path (M9), so the header must not offer a second one there.
 */
import { Megaphone } from 'lucide-react';
import { PageHeader } from '../layout/PageHeader';
import { Select } from '../ui/Select';
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import {
  RECRUITMENT_STATUS_LABEL,
  RECRUITMENT_STATUS_OPTIONS,
  useRecruitStatus,
  type RecruitmentStatus,
} from './useRecruitStatus';
import type { RecruitTab } from './recruitTabs';
import type { StaticGroup } from '../../types';

interface RecruitHeaderProps {
  group: StaticGroup;
  tab: RecruitTab;
}

export function RecruitHeader({ group, tab }: RecruitHeaderProps) {
  const pendingCount = useJoinRequestStore((s) => s.pendingCount);
  const { status, setStatus, isSaving } = useRecruitStatus(group);

  const discovery = group.settings?.discovery;
  const live = !!group.isPublic && !!discovery?.enabled;
  const parts = [live ? 'Live' : 'Listing off', RECRUITMENT_STATUS_LABEL[status]];
  if (pendingCount > 0) {
    parts.push(
      status === 'paused' || status === 'closed' ? `${pendingCount} still waiting` : `${pendingCount} waiting`,
    );
  }

  return (
    <PageHeader
      title="Recruiting"
      icon={<Megaphone className="w-4 h-4 text-accent" aria-hidden="true" />}
      subtitle={parts.join(' · ')}
      actions={
        tab !== 'listing' ? (
          <div className="w-40">
            <Select
              id="recruit-status"
              aria-label="Recruitment status"
              value={status}
              onChange={(v) => void setStatus(v as RecruitmentStatus)}
              options={RECRUITMENT_STATUS_OPTIONS}
              disabled={isSaving}
            />
          </div>
        ) : undefined
      }
    />
  );
}
