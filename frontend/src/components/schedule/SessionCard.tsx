import { useState } from 'react';
import { Clock, MapPin, Repeat, Edit2, Trash2, CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import { Button, IconButton, Tooltip } from '../primitives';
import { ConfirmModal } from '../ui/ConfirmModal';
import { useModal } from '../../hooks/useModal';
import type { ScheduleSession, RsvpStatus } from '../../types';

interface SessionCardProps {
  session: ScheduleSession;
  currentUserId?: string;
  canManage: boolean;
  canRsvp: boolean;
  onRsvp: (sessionId: string, status: RsvpStatus) => Promise<void>;
  onEdit: (session: ScheduleSession) => void;
  onDelete: (sessionId: string) => Promise<void>;
}

function formatInTimezone(isoString: string, tz: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
    timeZoneName: 'short',
  }).format(new Date(isoString));
}

function formatLocalTime(isoString: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(isoString));
}

function getDurationMinutes(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const RSVP_CONFIG: Record<RsvpStatus, { icon: typeof CheckCircle; label: string; activeClass: string }> = {
  available: { icon: CheckCircle, label: 'Available', activeClass: 'bg-green-400/20 text-green-300 border-green-400/40' },
  tentative: { icon: HelpCircle, label: 'Tentative', activeClass: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/40' },
  unavailable: { icon: XCircle, label: 'Unavailable', activeClass: 'bg-red-400/20 text-red-300 border-red-400/40' },
};

export function SessionCard({ session, currentUserId, canManage, canRsvp, onRsvp, onEdit, onDelete }: SessionCardProps) {
  const [rsvpLoading, setRsvpLoading] = useState<RsvpStatus | null>(null);
  const deleteModal = useModal();

  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const isLocalTzSame = localTz === session.timezone;
  const duration = getDurationMinutes(session.startTime, session.endTime);

  const myRsvp = currentUserId
    ? session.rsvps.find((r) => r.userId === currentUserId)
    : undefined;

  const rsvpSummary = {
    available: session.rsvps.filter((r) => r.status === 'available').length,
    tentative: session.rsvps.filter((r) => r.status === 'tentative').length,
    unavailable: session.rsvps.filter((r) => r.status === 'unavailable').length,
  };

  const handleRsvp = async (status: RsvpStatus) => {
    setRsvpLoading(status);
    try {
      await onRsvp(session.id, status);
    } finally {
      setRsvpLoading(null);
    }
  };

  const handleDelete = async () => {
    await onDelete(session.id);
    deleteModal.close();
  };

  return (
    <div className="bg-surface-raised border border-border-default rounded-lg p-4 space-y-3" data-testid="session-card">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium text-text-primary text-lg flex items-center gap-2">
            {session.title}
            {session.isRecurring && (
              <Tooltip content="Recurring session">
                <span className="inline-flex">
                  <Repeat className="w-4 h-4 text-accent" aria-hidden="true" />
                </span>
              </Tooltip>
            )}
          </h3>
          {session.description && (
            <p className="text-sm text-text-secondary mt-0.5">{session.description}</p>
          )}
        </div>
        {canManage && (
          <div className="flex gap-1">
            <IconButton
              icon={<Edit2 className="w-4 h-4" />}
              aria-label="Edit session"
              size="sm"
              onClick={() => onEdit(session)}
            />
            <IconButton
              icon={<Trash2 className="w-4 h-4" />}
              aria-label="Delete session"
              size="sm"
              variant="danger"
              onClick={deleteModal.open}
            />
          </div>
        )}
      </div>

      {/* Time display - the key UX feature */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-4 h-4 text-accent shrink-0" />
          <span className="text-text-primary font-medium">
            {formatInTimezone(session.startTime, session.timezone)}
          </span>
        </div>
        {!isLocalTzSame && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-text-muted shrink-0" />
            <span className="text-text-secondary">
              Your time: {formatLocalTime(session.startTime)}
            </span>
          </div>
        )}
        <div className="text-xs text-text-muted ml-6">
          Duration: {formatDuration(duration)}
        </div>
      </div>

      {/* RSVP buttons */}
      {canRsvp && (
        <div className="flex gap-2 pt-1">
          {(Object.entries(RSVP_CONFIG) as [RsvpStatus, typeof RSVP_CONFIG['available']][]).map(([status, config]) => {
            const Icon = config.icon;
            const isActive = myRsvp?.status === status;
            const isLoading = rsvpLoading === status;
            return (
              <Button
                key={status}
                variant="secondary"
                size="sm"
                onClick={() => handleRsvp(status)}
                disabled={rsvpLoading !== null}
                className={isActive ? config.activeClass : ''}
                data-testid={`rsvp-${status}`}
              >
                <Icon className="w-4 h-4 mr-1" />
                {isLoading ? '...' : config.label}
              </Button>
            );
          })}
        </div>
      )}

      {/* RSVP summary */}
      {session.rsvps.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-text-secondary pt-1 border-t border-border-subtle">
          <span className="text-green-400">{rsvpSummary.available} available</span>
          <span className="text-yellow-400">{rsvpSummary.tentative} tentative</span>
          <span className="text-red-400">{rsvpSummary.unavailable} unavailable</span>
        </div>
      )}

      {/* Per-member RSVP list */}
      {session.rsvps.length > 0 && (
        <div className="text-xs text-text-muted space-y-0.5">
          {session.rsvps.map((rsvp) => (
            <div key={rsvp.id} className="flex items-center gap-2">
              <span className={
                rsvp.status === 'available' ? 'text-green-400' :
                rsvp.status === 'tentative' ? 'text-yellow-400' :
                'text-red-400'
              }>
                {rsvp.status === 'available' ? '✓' : rsvp.status === 'tentative' ? '?' : '✗'}
              </span>
              <span>{rsvp.username ?? 'Unknown'}</span>
              {rsvp.note && <span className="text-text-muted italic">— {rsvp.note}</span>}
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        title="Delete Session"
        message={`Are you sure you want to delete "${session.title}"? This will also remove all RSVPs.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={deleteModal.close}
      />
    </div>
  );
}
