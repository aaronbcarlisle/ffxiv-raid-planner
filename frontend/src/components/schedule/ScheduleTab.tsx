import { useEffect, useMemo, useState } from 'react';
import { Calendar, CalendarClock, Link2, Plus, Sparkles } from 'lucide-react';
import { useScheduleStore } from '../../stores/scheduleStore';
import { useAuthStore } from '../../stores/authStore';
import { canManageRoster } from '../../utils/permissions';
import { useModal } from '../../hooks/useModal';
import { Button } from '../primitives';
import { Spinner } from '../ui';
import { SessionCard } from './SessionCard';
import { CreateSessionModal } from './CreateSessionModal';
import { AvailabilityGrid } from './AvailabilityGrid';
import type { ScheduleSession, ScheduleSessionCreate, RsvpStatus, MemberRole, Membership } from '../../types';

type SchedulerSubTab = 'sessions' | 'availability' | 'integrations';

interface ScheduleTabProps {
  groupId: string;
  staticName: string;
  shareCode: string;
  members: Membership[];
  userRole: MemberRole | null | undefined;
}

export function ScheduleTab({ groupId, staticName, shareCode, members, userRole }: ScheduleTabProps) {
  const { user } = useAuthStore();
  const {
    sessions,
    isLoading,
    fetchSessions,
    createSession,
    updateSession,
    deleteSession,
    submitRsvp,
    clearSessions,
  } = useScheduleStore();
  const createModal = useModal();
  const [editSession, setEditSession] = useState<ScheduleSession | null>(null);
  const [createDraft, setCreateDraft] = useState<ScheduleSessionCreate | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<SchedulerSubTab>(() => {
    const saved = sessionStorage.getItem(`schedule-subtab-${groupId}`);
    return saved === 'availability' || saved === 'integrations' || saved === 'sessions'
      ? saved
      : 'sessions';
  });

  useEffect(() => {
    void fetchSessions(groupId).catch(() => undefined);
    return () => {
      clearSessions();
    };
  }, [groupId, fetchSessions, clearSessions]);

  useEffect(() => {
    const saved = sessionStorage.getItem(`schedule-subtab-${groupId}`);
    if (saved === 'availability' || saved === 'integrations' || saved === 'sessions') {
      setActiveSubTab(saved);
    } else {
      setActiveSubTab('sessions');
    }
  }, [groupId]);

  const hasAuthenticatedUser = !!user;
  const canManage = hasAuthenticatedUser && canManageRoster(userRole, user?.isAdmin).allowed;
  const canRsvp = hasAuthenticatedUser && !!userRole && userRole !== 'viewer';
  const upcomingSessionCount = sessions.length;
  const trackedMemberCount = useMemo(
    () => members.filter((member) => member.role !== 'viewer').length,
    [members]
  );

  const handleCreate = async (data: ScheduleSessionCreate) => {
    await createSession(groupId, data);
    setCreateDraft(null);
  };

  const handleUpdate = async (data: ScheduleSessionCreate) => {
    if (!editSession) return;
    await updateSession(groupId, editSession.id, data);
    setEditSession(null);
  };

  const handleDelete = async (sessionId: string) => {
    await deleteSession(groupId, sessionId);
  };

  const handleRsvp = async (sessionId: string, status: RsvpStatus) => {
    await submitRsvp(groupId, sessionId, status);
  };

  const handleEdit = (session: ScheduleSession) => {
    setEditSession(session);
  };

  const handleCreateSessionDraft = (draft: ScheduleSessionCreate) => {
    setCreateDraft(draft);
    createModal.open();
  };

  const handleSubTabChange = (nextTab: SchedulerSubTab) => {
    setActiveSubTab(nextTab);
    sessionStorage.setItem(`schedule-subtab-${groupId}`, nextTab);
  };

  const nextSession = sessions[0];

  const subTabs: Array<{
    id: SchedulerSubTab;
    label: string;
    badge: string;
    icon: typeof Calendar;
    disabled?: boolean;
  }> = [
    {
      id: 'sessions',
      label: 'Sessions',
      badge: String(upcomingSessionCount),
      icon: CalendarClock,
    },
    {
      id: 'availability',
      label: 'Availability',
      badge: `${trackedMemberCount} tracked`,
      icon: Sparkles,
    },
    {
      id: 'integrations',
      label: 'Integrations',
      badge: 'Later',
      icon: Link2,
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="schedule-tab">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-lg font-medium text-text-primary">
            <Calendar className="h-5 w-5 text-accent" />
            Raid Schedule
          </h2>
          <p className="text-sm text-text-secondary">
            Times are shown in the static's timezone and automatically converted to your local time
            ({Intl.DateTimeFormat().resolvedOptions().timeZone}).
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border-default bg-surface-card/80 p-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-2 sm:flex sm:flex-wrap" role="tablist" aria-label="Scheduler sections">
          {subTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <Button
                key={tab.id}
                type="button"
                variant={isActive ? 'accent-subtle' : 'ghost'}
                size="sm"
                leftIcon={<Icon className="h-4 w-4" />}
                onClick={() => handleSubTabChange(tab.id)}
                disabled={tab.disabled}
                data-testid={`schedule-subtab-${tab.id}`}
                aria-selected={isActive}
                role="tab"
              >
                <span>{tab.label}</span>
                <span className="ml-2 rounded-full border border-border-subtle bg-surface-elevated px-2 py-0.5 text-[11px] text-text-secondary">
                  {tab.badge}
                </span>
              </Button>
            );
          })}
        </div>

        {canManage && activeSubTab === 'sessions' && (
          <Button onClick={createModal.open} size="sm" data-testid="add-session-btn" leftIcon={<Plus className="h-4 w-4" />}>
            Add Session
          </Button>
        )}
      </div>

      {activeSubTab === 'sessions' && (
        <div className="space-y-4" data-testid="schedule-sessions-panel">
          {nextSession && (
            <div className="flex flex-col gap-3 rounded-xl border border-border-default bg-surface-card/80 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
                  Next scheduled raid
                </div>
                <div className="mt-1 text-sm text-text-primary">{nextSession.title}</div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<Sparkles className="h-4 w-4" />}
                onClick={() => handleSubTabChange('availability')}
              >
                View best overlap
              </Button>
            </div>
          )}

          {sessions.length === 0 ? (
            <div className="py-12 text-center text-text-muted">
              <Calendar className="mx-auto mb-3 h-12 w-12 opacity-40" />
              <p className="text-lg">No sessions scheduled</p>
              {canManage && (
                <p className="mt-1 text-sm">Add a raid session to help your static coordinate times.</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  currentUserId={user?.id}
                  canManage={canManage}
                  canRsvp={canRsvp}
                  onRsvp={handleRsvp}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'availability' && (
        <div className="mx-auto w-full max-w-6xl" data-testid="schedule-availability-panel">
          <AvailabilityGrid
            groupId={groupId}
            canSubmit={canRsvp}
            canCreateSession={canManage}
            sessions={sessions}
            members={members}
            staticName={staticName}
            shareCode={shareCode}
            onCreateSessionDraft={handleCreateSessionDraft}
          />
        </div>
      )}

      {activeSubTab === 'integrations' && (
        <div className="space-y-4" data-testid="schedule-integrations-panel">
          <div className="rounded-xl border border-border-default bg-surface-card/80 px-4 py-6 text-sm text-text-secondary">
            <div className="flex items-start gap-3">
              <Link2 className="mt-0.5 h-5 w-5 text-accent" />
              <div>
                <p className="font-medium text-text-primary">Scheduler integrations are not configured yet.</p>
                <p className="mt-1">
                  Discord reminders and calendar links will appear here once those settings are available for this static.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <CreateSessionModal
        isOpen={createModal.isOpen}
        onClose={() => {
          setCreateDraft(null);
          createModal.close();
        }}
        onSubmit={handleCreate}
        initialDraft={createDraft}
      />

      {editSession && (
        <CreateSessionModal
          isOpen={true}
          onClose={() => setEditSession(null)}
          onSubmit={handleUpdate}
          editSession={editSession}
        />
      )}
    </div>
  );
}
