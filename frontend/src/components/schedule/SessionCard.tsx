import React, { useState, useMemo, useEffect } from 'react';
import { Clock, Check, MapPin, Repeat, Edit2, Trash2, Share2, MessageSquare, CheckCircle, XCircle, HelpCircle, Mountain, RotateCcw, Users, Gamepad2, MoreHorizontal, CalendarDays } from 'lucide-react';
import { XivIcon } from '../ui/XivIcon';
import { Button, IconButton, Tooltip } from '../primitives';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Modal } from '../ui/Modal';
import { useModal } from '../../hooks/useModal';
import { toast } from '../../stores/toastStore';
import { useScheduleStore } from '../../stores/scheduleStore';
import { OccurrenceListModal } from './OccurrenceListModal';
import { computeNextOccurrence, getOccurrenceDateKey } from '../../utils/recurrence';
import type { EventCategory, ScheduleSession, RsvpStatus } from '../../types';

interface SessionCardProps {
  session: ScheduleSession;
  currentUserId?: string;
  shareCode?: string;
  staticName?: string;
  canManage: boolean;
  canRsvp: boolean;
  compact?: boolean;
  groupId?: string;
  deliveryStatus?: {
    mirrorState: 'synced' | 'failed' | 'pending' | 'disabled';
    reminderLabel: string | null;
  };
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

const CATEGORY_CONFIG: Record<EventCategory, { icon: React.ReactNode; label: string; color: string }> = {
  raid: { icon: <XivIcon name="sword" size={12} />, label: 'Raid', color: 'bg-red-400/20 text-red-300' },
  ultimate: { icon: <XivIcon name="sword" size={12} />, label: 'Ultimate', color: 'bg-blue-400/20 text-blue-300' },
  farm: { icon: <Mountain className="w-3 h-3" />, label: 'Farm', color: 'bg-amber-400/20 text-amber-300' },
  reclear: { icon: <RotateCcw className="w-3 h-3" />, label: 'Reclear', color: 'bg-blue-400/20 text-blue-300' },
  prog: { icon: <Gamepad2 className="w-3 h-3" />, label: 'Prog', color: 'bg-purple-400/20 text-purple-300' },
  social: { icon: <Users className="w-3 h-3" />, label: 'Social', color: 'bg-green-400/20 text-green-300' },
  other: { icon: <MoreHorizontal className="w-3 h-3" />, label: 'Other', color: 'bg-surface-elevated text-text-secondary' },
};

const RSVP_CONFIG: Record<RsvpStatus, { icon: typeof CheckCircle; label: string; shortLabel: string; activeClass: string }> = {
  available: { icon: CheckCircle, label: 'Available', shortLabel: 'Yes', activeClass: 'bg-green-400/20 text-green-300 border-green-400/40' },
  tentative: { icon: HelpCircle, label: 'Tentative', shortLabel: 'Maybe', activeClass: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/40' },
  unavailable: { icon: XCircle, label: 'Unavailable', shortLabel: 'No', activeClass: 'bg-red-400/20 text-red-300 border-red-400/40' },
};

function CategoryBadge({ category }: { category: EventCategory }) {
  const config = CATEGORY_CONFIG[category];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${config.color}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

function buildDiscordMessage(session: ScheduleSession, rsvpSummary: Record<string, number>, shareCode?: string, staticName?: string): string {
  const timeStr = formatInTimezone(session.startTime, session.timezone);
  const duration = getDurationMinutes(session.startTime, session.endTime);
  const lines: string[] = [];

  lines.push(`**${session.title}**`);
  if (session.contentName) lines.push(`> ${session.contentName}`);
  lines.push(`\u{1f4c5} ${timeStr} (${formatDuration(duration)})`);
  if (session.isRecurring) lines.push('\u{1f501} Recurring weekly');
  if (staticName) lines.push(`\u{1f465} ${staticName}`);
  if (session.description) lines.push(`> ${session.description}`);

  if (session.trackAvailability !== false) {
    const rsvpParts: string[] = [];
    if (rsvpSummary.available > 0) rsvpParts.push(`\u{2705} ${rsvpSummary.available}`);
    if (rsvpSummary.tentative > 0) rsvpParts.push(`\u{2753} ${rsvpSummary.tentative}`);
    if (rsvpSummary.unavailable > 0) rsvpParts.push(`\u{274c} ${rsvpSummary.unavailable}`);
    if (rsvpParts.length > 0) lines.push(rsvpParts.join(' \u{2502} '));
  } else {
    lines.push('Availability not required');
  }

  if (shareCode) {
    lines.push(`${window.location.origin}/group/${shareCode}?tab=schedule&sessionId=${session.id}`);
  }

  return lines.join('\n');
}

export function SessionCard({ session, currentUserId, shareCode, staticName, canManage, canRsvp, compact, groupId, deliveryStatus, onRsvp, onEdit, onDelete }: SessionCardProps) {
  const [rsvpLoading, setRsvpLoading] = useState<RsvpStatus | null>(null);
  const [copied, setCopied] = useState(false);
  const deleteModal = useModal();
  const occurrenceModal = useModal();
  const recurringDeleteModal = useModal();
  const { createException, fetchExceptions } = useScheduleStore();

  const [cancelledDates, setCancelledDates] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!session.isRecurring || !groupId) return;
    let alive = true;
    fetchExceptions(groupId, session.id).then((exceptions) => {
      if (!alive) return;
      setCancelledDates(new Set(
        exceptions.filter((e) => e.type === 'cancelled').map((e) => e.occurrenceDate),
      ));
    }).catch(() => {});
    return () => { alive = false; };
  }, [session.id, session.isRecurring, groupId, fetchExceptions]);

  const displayStartTime = useMemo(() => {
    if (!session.isRecurring || !session.recurrenceRule) return session.startTime;
    const next = computeNextOccurrence(
      session.startTime,
      session.recurrenceRule,
      new Date(),
      cancelledDates,
      session.timezone,
    );
    return next ? next.toISOString() : session.startTime;
  }, [session.startTime, session.recurrenceRule, session.isRecurring, cancelledDates, session.timezone]);

  const nextOccurrenceDate = getOccurrenceDateKey(displayStartTime, session.timezone);

  const handleDeleteClick = () => {
    if (session.isRecurring) {
      recurringDeleteModal.open();
    } else {
      deleteModal.open();
    }
  };

  const handleCancelOccurrence = async () => {
    if (!groupId) return;
    recurringDeleteModal.close();
    try {
      await createException(groupId, session.id, { occurrenceDate: nextOccurrenceDate, type: 'cancelled' });
      toast.success(`Cancelled session for ${new Date(displayStartTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
    } catch {
      toast.error('Failed to cancel occurrence');
    }
  };

  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const isLocalTzSame = localTz === session.timezone;
  const duration = getDurationMinutes(session.startTime, session.endTime);
  const availabilityTracked = session.trackAvailability !== false;

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

  const handleShare = async () => {
    const timeStr = formatInTimezone(displayStartTime, session.timezone);
    const durationStr = formatDuration(duration);
    const lines = [session.title, `${timeStr} (${durationStr})`];
    if (session.category) lines.push(`Type: ${CATEGORY_CONFIG[session.category]?.label ?? session.category}`);
    if (availabilityTracked && (rsvpSummary.available > 0 || rsvpSummary.tentative > 0)) {
      lines.push(`RSVP: ${rsvpSummary.available} available, ${rsvpSummary.tentative} tentative`);
    } else if (!availabilityTracked) {
      lines.push('Availability not required');
    }
    if (shareCode) lines.push(`${window.location.origin}/group/${shareCode}?tab=schedule&sessionId=${session.id}`);
    const text = lines.join('\n');

    if (navigator.share) {
      try { await navigator.share({ title: session.title, text }); return; } catch { /* fall through */ }
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyDiscord = async () => {
    const msg = buildDiscordMessage(session, rsvpSummary, shareCode, staticName);
    await navigator.clipboard.writeText(msg);
    toast.success('Copied Discord message');
  };

  // ── Information-dense tile layout ──
  if (compact) {
    // Attendee preview: first 3 names + overflow count
    const attendeeNames = session.rsvps
      .filter(r => r.status === 'available')
      .map(r => r.username ?? 'Unknown');
    const previewNames = attendeeNames.slice(0, 3);
    const overflowCount = attendeeNames.length - previewNames.length;

    return (
      <div className="bg-surface-raised border border-border-default rounded-lg p-3 flex flex-col gap-2" data-testid="session-card">
        {/* Top: title + badges + actions */}
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-text-primary text-sm truncate">{session.title}</span>
              {session.isRecurring && (
                <Tooltip content="Recurring">
                  <span className="inline-flex"><Repeat className="w-3 h-3 text-accent" /></span>
                </Tooltip>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {session.category && <CategoryBadge category={session.category} />}
              {deliveryStatus?.mirrorState === 'synced' && (
                <span className="inline-flex items-center gap-1 rounded bg-blue-400/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-300">
                  <CalendarDays className="h-3 w-3" /> Discord
                </span>
              )}
              {deliveryStatus?.mirrorState === 'failed' && (
                <span className="inline-flex items-center gap-1 rounded bg-red-400/15 px-1.5 py-0.5 text-[10px] font-medium text-red-300">
                  <XCircle className="h-3 w-3" /> Discord issue
                </span>
              )}
              {deliveryStatus?.reminderLabel && (
                <span className="inline-flex items-center gap-1 rounded bg-purple-400/15 px-1.5 py-0.5 text-[10px] font-medium text-purple-300">
                  <MessageSquare className="h-3 w-3" /> {deliveryStatus.reminderLabel}
                </span>
              )}
              {session.contentName && (
                <span className="text-[10px] text-text-tertiary truncate">{session.contentName}</span>
              )}
            </div>
          </div>
          <div className="flex gap-0.5 flex-shrink-0">
            <IconButton icon={copied ? <Check className="w-3.5 h-3.5 text-status-success" /> : <Share2 className="w-3.5 h-3.5" />} aria-label="Share" size="sm" onClick={handleShare} />
            {session.isRecurring && groupId && (
              <Tooltip content="View occurrences">
                <IconButton icon={<CalendarDays className="w-3.5 h-3.5" />} aria-label="View occurrences" size="sm" onClick={occurrenceModal.open} />
              </Tooltip>
            )}
            {canManage && (
              <>
                <IconButton icon={<Edit2 className="w-3.5 h-3.5" />} aria-label="Edit" size="sm" onClick={() => onEdit(session)} />
                <IconButton icon={<Trash2 className="w-3.5 h-3.5" />} aria-label="Delete" size="sm" variant="danger" onClick={handleDeleteClick} />
              </>
            )}
          </div>
        </div>

        {/* Middle: time + notes */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs">
            <MapPin className="w-3 h-3 text-accent flex-shrink-0" />
            <span className="text-text-primary font-medium">{formatInTimezone(displayStartTime, session.timezone)}</span>
            <span className="text-text-tertiary">({formatDuration(duration)})</span>
          </div>
          {!isLocalTzSame && (
            <div className="flex items-center gap-1.5 text-[11px] text-text-secondary ml-[18px]">
              <span>Your time: {formatLocalTime(displayStartTime)}</span>
            </div>
          )}
          {session.description && (
            <p className="text-[11px] text-text-secondary line-clamp-2 ml-[18px]">{session.description}</p>
          )}
        </div>

        {/* Bottom: RSVP summary + attendee preview + buttons */}
        <div className="border-t border-border-subtle pt-2 space-y-1.5">
          {/* RSVP totals + attendee preview */}
          <div className="flex items-center justify-between text-[11px]">
            {availabilityTracked ? (
              <div className="flex items-center gap-2">
                <span className="text-green-400">{rsvpSummary.available} yes</span>
                <span className="text-yellow-400">{rsvpSummary.tentative} maybe</span>
                <span className="text-red-400">{rsvpSummary.unavailable} no</span>
              </div>
            ) : (
              <span className="text-text-tertiary">Availability not required</span>
            )}
            {myRsvp && (
              <span className={`text-[10px] font-medium ${
                myRsvp.status === 'available' ? 'text-green-400' :
                myRsvp.status === 'tentative' ? 'text-yellow-400' : 'text-red-400'
              }`}>
                You: {myRsvp.status === 'available' ? 'Yes' : myRsvp.status === 'tentative' ? 'Maybe' : 'No'}
              </span>
            )}
          </div>

          {/* Compact attendee preview */}
          {availabilityTracked && previewNames.length > 0 && (
            <div className="text-[10px] text-text-tertiary truncate">
              {previewNames.join(', ')}{overflowCount > 0 && ` +${overflowCount} more`}
            </div>
          )}

          {/* Quick RSVP buttons */}
          {canRsvp && availabilityTracked && (
            <div className="flex gap-1.5">
              {(Object.entries(RSVP_CONFIG) as [RsvpStatus, typeof RSVP_CONFIG['available']][]).map(([status, config]) => {
                const Icon = config.icon;
                const isActive = myRsvp?.status === status;
                return (
                  <Button key={status} variant="secondary" size="sm" onClick={() => handleRsvp(status)} disabled={rsvpLoading !== null}
                    className={`flex-1 text-xs py-1 ${isActive ? config.activeClass : ''}`} data-testid={`rsvp-${status}`}>
                    <Icon className="w-3 h-3 mr-0.5" />
                    {rsvpLoading === status ? '...' : config.shortLabel}
                  </Button>
                );
              })}
            </div>
          )}
        </div>

        <ConfirmModal isOpen={deleteModal.isOpen} title="Delete Session" message={`Delete "${session.title}"? This will also remove all RSVPs.`} confirmLabel="Delete" variant="danger" onConfirm={handleDelete} onCancel={deleteModal.close} />

        {session.isRecurring && (
          <Modal isOpen={recurringDeleteModal.isOpen} onClose={recurringDeleteModal.close} title="Recurring Session">
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">This is a recurring session. What would you like to do?</p>
              <div className="flex flex-col gap-2">
                <Button variant="secondary" onClick={handleCancelOccurrence}>
                  Cancel {new Date(displayStartTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} only
                </Button>
                <Button variant="danger" onClick={async () => { recurringDeleteModal.close(); await onDelete(session.id); }}>
                  Delete entire series
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {session.isRecurring && groupId && (
          <OccurrenceListModal
            isOpen={occurrenceModal.isOpen}
            onClose={occurrenceModal.close}
            session={session}
            groupId={groupId}
            canManage={canManage}
          />
        )}
      </div>
    );
  }

  // ── Full list layout ──
  return (
    <div className="bg-surface-raised border border-border-default rounded-lg p-4 space-y-3" data-testid="session-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-medium text-text-primary text-lg flex items-center gap-2 flex-wrap">
            <span className="truncate">{session.title}</span>
            {session.isRecurring && (
              <Tooltip content="Recurring session">
                <span className="inline-flex"><Repeat className="w-4 h-4 text-accent" /></span>
              </Tooltip>
            )}
            {session.category && <CategoryBadge category={session.category} />}
            {deliveryStatus?.mirrorState === 'synced' && (
              <span className="inline-flex items-center gap-1 rounded bg-blue-400/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-300">
                <CalendarDays className="h-3 w-3" /> Discord Event synced
              </span>
            )}
            {deliveryStatus?.mirrorState === 'failed' && (
              <span className="inline-flex items-center gap-1 rounded bg-red-400/15 px-1.5 py-0.5 text-[10px] font-medium text-red-300">
                <XCircle className="h-3 w-3" /> Discord delivery issue
              </span>
            )}
            {deliveryStatus?.reminderLabel && (
              <span className="inline-flex items-center gap-1 rounded bg-purple-400/15 px-1.5 py-0.5 text-[10px] font-medium text-purple-300">
                <MessageSquare className="h-3 w-3" /> Reminders {deliveryStatus.reminderLabel}
              </span>
            )}
          </h3>
          {session.contentName && (
            <p className="mt-0.5 truncate text-sm text-text-tertiary">{session.contentName}</p>
          )}
          {session.description && (
            <p className="text-sm text-text-secondary mt-0.5 line-clamp-2">{session.description}</p>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {session.isRecurring && groupId && (
            <Tooltip content="View occurrences">
              <IconButton icon={<CalendarDays className="w-4 h-4" />} aria-label="View occurrences" size="sm" onClick={occurrenceModal.open} />
            </Tooltip>
          )}
          <Tooltip content="Copy for Discord">
            <IconButton icon={<MessageSquare className="w-4 h-4" />} aria-label="Copy Discord message" size="sm" onClick={handleCopyDiscord} />
          </Tooltip>
          <IconButton icon={copied ? <Check className="w-4 h-4 text-status-success" /> : <Share2 className="w-4 h-4" />} aria-label="Share session" size="sm" onClick={handleShare} />
          {canManage && (
            <>
              <IconButton icon={<Edit2 className="w-4 h-4" />} aria-label="Edit session" size="sm" onClick={() => onEdit(session)} />
              <IconButton icon={<Trash2 className="w-4 h-4" />} aria-label="Delete session" size="sm" variant="danger" onClick={handleDeleteClick} />
            </>
          )}
        </div>
      </div>

      {/* Time display */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-4 h-4 text-accent shrink-0" />
          <span className="text-text-primary font-medium">{formatInTimezone(displayStartTime, session.timezone)}</span>
        </div>
        {!isLocalTzSame && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-text-muted shrink-0" />
            <span className="text-text-secondary">Your time: {formatLocalTime(displayStartTime)}</span>
          </div>
        )}
        <div className="text-xs text-text-muted ml-6">Duration: {formatDuration(duration)}</div>
      </div>

      {/* RSVP buttons */}
      {canRsvp && availabilityTracked && (
        <div className="flex gap-2 pt-1">
          {(Object.entries(RSVP_CONFIG) as [RsvpStatus, typeof RSVP_CONFIG['available']][]).map(([status, config]) => {
            const Icon = config.icon;
            const isActive = myRsvp?.status === status;
            return (
              <Button key={status} variant="secondary" size="sm" onClick={() => handleRsvp(status)} disabled={rsvpLoading !== null}
                className={isActive ? config.activeClass : ''} data-testid={`rsvp-${status}`}>
                <Icon className="w-4 h-4 mr-1" />
                {rsvpLoading === status ? '...' : config.label}
              </Button>
            );
          })}
        </div>
      )}

      {!availabilityTracked && (
        <div className="rounded-lg border border-border-subtle bg-surface-muted/30 px-3 py-2 text-sm text-text-secondary">
          Availability not required
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
              <span className={rsvp.status === 'available' ? 'text-green-400' : rsvp.status === 'tentative' ? 'text-yellow-400' : 'text-red-400'}>
                {rsvp.status === 'available' ? '✓' : rsvp.status === 'tentative' ? '?' : '✗'}
              </span>
              <span>{rsvp.username ?? 'Unknown'}</span>
              {rsvp.note && <span className="text-text-muted italic">— {rsvp.note}</span>}
            </div>
          ))}
        </div>
      )}

      <ConfirmModal isOpen={deleteModal.isOpen} title="Delete Session" message={`Are you sure you want to delete "${session.title}"? This will also remove all RSVPs.`} confirmLabel="Delete" variant="danger" onConfirm={handleDelete} onCancel={deleteModal.close} />

      {session.isRecurring && (
        <Modal isOpen={recurringDeleteModal.isOpen} onClose={recurringDeleteModal.close} title="Recurring Session">
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">This is a recurring session. What would you like to do?</p>
            <div className="flex flex-col gap-2">
              <Button variant="secondary" onClick={handleCancelOccurrence}>
                Cancel {new Date(displayStartTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} only
              </Button>
              <Button variant="danger" onClick={async () => { recurringDeleteModal.close(); await onDelete(session.id); }}>
                Delete entire series
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {session.isRecurring && groupId && (
        <OccurrenceListModal
          isOpen={occurrenceModal.isOpen}
          onClose={occurrenceModal.close}
          session={session}
          groupId={groupId}
          canManage={canManage}
        />
      )}
    </div>
  );
}
