import { useEffect, useState } from 'react';
import { Calendar, Plus } from 'lucide-react';
import { useScheduleStore } from '../../stores/scheduleStore';
import { useAuthStore } from '../../stores/authStore';
import { canManageRoster } from '../../utils/permissions';
import { useModal } from '../../hooks/useModal';
import { Button } from '../primitives';
import { Spinner } from '../ui';
import { SessionCard } from './SessionCard';
import { CreateSessionModal } from './CreateSessionModal';
import { AvailabilityGrid } from './AvailabilityGrid';
import type { ScheduleSession, ScheduleSessionCreate, RsvpStatus, MemberRole } from '../../types';

interface ScheduleTabProps {
  groupId: string;
  userRole: MemberRole | null | undefined;
}

export function ScheduleTab({ groupId, userRole }: ScheduleTabProps) {
  const { user } = useAuthStore();
  const { sessions, isLoading, fetchSessions, createSession, updateSession, deleteSession, submitRsvp } = useScheduleStore();
  const createModal = useModal();
  const [editSession, setEditSession] = useState<ScheduleSession | null>(null);

  useEffect(() => {
    fetchSessions(groupId);
  }, [groupId, fetchSessions]);

  const canManage = canManageRoster(userRole, user?.isAdmin).allowed;
  const canRsvp = !!userRole && userRole !== 'viewer';

  const handleCreate = async (data: ScheduleSessionCreate) => {
    await createSession(groupId, data);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-text-primary flex items-center gap-2">
          <Calendar className="w-5 h-5 text-accent" />
          Raid Schedule
        </h2>
        {canManage && (
          <Button onClick={createModal.open} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Add Session
          </Button>
        )}
      </div>

      <p className="text-sm text-text-secondary">
        Times are shown in the static's timezone and automatically converted to your local time
        ({Intl.DateTimeFormat().resolvedOptions().timeZone}).
      </p>

      {sessions.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg">No sessions scheduled</p>
          {canManage && (
            <p className="text-sm mt-1">Add a raid session to help your static coordinate times.</p>
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

      {/* Availability Grid */}
      <div className="mt-8 border-t border-border-default pt-8">
        <div className="mx-auto w-full max-w-6xl">
          <AvailabilityGrid groupId={groupId} canSubmit={canRsvp} />
        </div>
      </div>

      <CreateSessionModal
        isOpen={createModal.isOpen}
        onClose={createModal.close}
        onSubmit={handleCreate}
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
