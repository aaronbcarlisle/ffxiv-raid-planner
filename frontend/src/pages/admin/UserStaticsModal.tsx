/**
 * UserStaticsModal - Shows statics created and joined by a user
 *
 * Used from AdminOverview to drill into a user's statics.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/ui';
import { Button } from '../../components/primitives';
import { Skeleton } from '../../components/ui/Skeleton';
import { Users } from 'lucide-react';
import { api } from '../../services/api';

interface UserStatic {
  staticId: string;
  name: string;
  shareCode: string;
  memberCount: number;
  role?: string | null;
}

interface UserStaticsData {
  created: UserStatic[];
  joined: UserStatic[];
}

interface UserStaticsModalProps {
  userId: string;
  username: string;
  onClose: () => void;
}

// Role badge styles using design system membership tokens
const ROLE_BADGE_STYLES: Record<string, string> = {
  owner: 'bg-membership-owner/30 text-membership-owner border-membership-owner/50',
  lead: 'bg-membership-lead/30 text-membership-lead border-membership-lead/50',
  member: 'bg-membership-member/30 text-membership-member border-membership-member/50',
  viewer: 'bg-membership-viewer/30 text-membership-viewer border-membership-viewer/50',
};

export function UserStaticsModal({ userId, username, onClose }: UserStaticsModalProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<UserStaticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(false);
      try {
        const result = await api.get<UserStaticsData>(
          `/api/admin/analytics/users/${encodeURIComponent(userId)}/statics`
        );
        setData(result);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId]);

  const handleNavigate = (shareCode: string) => {
    navigate(`/group/${shareCode}?adminMode=true`);
    onClose();
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Users className="w-5 h-5 text-accent" />
          {username}&apos;s Statics
        </span>
      }
      size="md"
    >
      <div className="space-y-5">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-32 mt-4" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : error ? (
          <p className="text-status-error text-sm">Failed to load statics data.</p>
        ) : data ? (
          <>
            {/* Statics Created (Owned) */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-2">
                Statics Created
                <span className="text-text-muted font-normal ml-1">({data.created.length})</span>
              </h3>
              {data.created.length === 0 ? (
                <p className="text-sm text-text-muted">No statics created</p>
              ) : (
                <div className="border border-border-subtle rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-surface-elevated border-b border-border-subtle">
                        <th className="text-left px-3 py-1.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Name</th>
                        <th className="text-right px-3 py-1.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Members</th>
                        <th className="text-right px-3 py-1.5 text-xs font-medium text-text-secondary uppercase tracking-wider w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {data.created.map((s) => (
                        <tr key={s.staticId} className="hover:bg-surface-elevated transition-colors">
                          <td className="px-3 py-1.5 text-sm text-text-primary">{s.name}</td>
                          <td className="px-3 py-1.5 text-sm text-text-secondary text-right tabular-nums">{s.memberCount}</td>
                          <td className="px-3 py-1.5 text-right">
                            <Button variant="ghost" size="sm" onClick={() => handleNavigate(s.shareCode)} className="!px-2 !py-0.5 !text-xs !min-h-0">
                              View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Statics Joined */}
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-2">
                Statics Joined
                <span className="text-text-muted font-normal ml-1">({data.joined.length})</span>
              </h3>
              {data.joined.length === 0 ? (
                <p className="text-sm text-text-muted">No statics joined</p>
              ) : (
                <div className="border border-border-subtle rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-surface-elevated border-b border-border-subtle">
                        <th className="text-left px-3 py-1.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Name</th>
                        <th className="text-center px-3 py-1.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Role</th>
                        <th className="text-right px-3 py-1.5 text-xs font-medium text-text-secondary uppercase tracking-wider">Members</th>
                        <th className="text-right px-3 py-1.5 text-xs font-medium text-text-secondary uppercase tracking-wider w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {data.joined.map((s) => (
                        <tr key={s.staticId} className="hover:bg-surface-elevated transition-colors">
                          <td className="px-3 py-1.5 text-sm text-text-primary">{s.name}</td>
                          <td className="px-3 py-1.5 text-center">
                            {s.role && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wide ${ROLE_BADGE_STYLES[s.role] || ''}`}>
                                {s.role}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-sm text-text-secondary text-right tabular-nums">{s.memberCount}</td>
                          <td className="px-3 py-1.5 text-right">
                            <Button variant="ghost" size="sm" onClick={() => handleNavigate(s.shareCode)} className="!px-2 !py-0.5 !text-xs !min-h-0">
                              View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
