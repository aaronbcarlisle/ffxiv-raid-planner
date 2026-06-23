/* eslint-disable design-system/no-raw-button */
import { useEffect, useMemo } from 'react';
import { Calendar, Clock, Repeat, Link2, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import { useScheduleStore } from '../../stores/scheduleStore';

interface ScheduleUpcomingPanelProps {
  groupId: string;
  canManage: boolean;
  onSwitchToCalendar: () => void;
  onCreateSession?: () => void;
}

function fmtDate(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: tz,
  }).format(new Date(iso));
}

function fmtTimeRange(start: string, end: string, tz: string): string {
  const s = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: tz,
  }).format(new Date(start));
  const e = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: tz,
  }).format(new Date(end));
  return `${s} – ${e}`;
}

function fmtDuration(start: string, end: string): string {
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function fmtRelative(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return 'starting now';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.floor(diff / 86400000);
  return `in ${days} day${days !== 1 ? 's' : ''}`;
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  progression: { bg: 'bg-role-melee/15', text: 'text-role-melee', label: 'Prog' },
  farm:        { bg: 'bg-role-healer/15', text: 'text-role-healer', label: 'Farm' },
  mount_farm:  { bg: 'bg-role-ranged/15', text: 'text-role-ranged', label: 'Mount Farm' },
  ultimate:    { bg: 'bg-role-caster/15', text: 'text-role-caster', label: 'Ultimate' },
  social:      { bg: 'bg-role-tank/15', text: 'text-role-tank', label: 'Social' },
};

export function ScheduleUpcomingPanel({
  groupId,
  canManage,
  onSwitchToCalendar,
  onCreateSession,
}: ScheduleUpcomingPanelProps) {
  const { sessions, settings, isLoading, fetchSessions, fetchSettings } = useScheduleStore();

  useEffect(() => {
    void fetchSessions(groupId);
    void fetchSettings(groupId);
  }, [groupId, fetchSessions, fetchSettings]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return [...sessions]
      .filter(s => new Date(s.endTime) > now)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [sessions]);

  const nextSession = upcoming[0] ?? null;
  const laterSessions = upcoming.slice(1, 4);
  const recurringCount = upcoming.filter(s => s.isRecurring).length;
  const discordLinked = settings?.discordLinkStatus === 'connected';
  const webhookOk = settings?.webhookConfigured ?? false;
  const discordConnected = discordLinked || webhookOk;

  if (isLoading && upcoming.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-text-secondary text-sm">
        Loading schedule…
      </div>
    );
  }

  if (!isLoading && upcoming.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-surface-card border border-border-default flex items-center justify-center mb-4">
          <Calendar size={28} className="text-text-muted" />
        </div>
        <h3 className="text-lg font-display font-semibold text-text-primary mb-2">
          No sessions scheduled
        </h3>
        <p className="text-sm text-text-secondary mb-6 max-w-sm">
          Create your first raid night and choose whether availability should be tracked.
        </p>
        {canManage && onCreateSession && (
          <button
            onClick={onCreateSession}
            className="px-4 py-2 bg-accent/20 hover:bg-accent/30 text-accent rounded-lg text-sm font-medium transition-colors border border-accent/30"
          >
            + Add session
          </button>
        )}
        <button
          onClick={onSwitchToCalendar}
          className="mt-3 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          View calendar <ChevronRight size={14} />
        </button>
      </div>
    );
  }

  const catStyle = nextSession?.category ? (CATEGORY_STYLES[nextSession.category] ?? null) : null;

  return (
    <div className="space-y-4">
      {/* Row 1: Next Session + Upcoming list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Next Session — 2/3 width */}
        {nextSession && (
          <div className="lg:col-span-2 relative bg-surface-card border border-border-default rounded-xl p-5 overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-0.5 bg-accent rounded-l-xl" />
            <div className="pl-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={13} className="text-accent" />
                <span className="text-xs font-semibold text-accent uppercase tracking-widest">
                  Next Session
                </span>
                {catStyle && (
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${catStyle.bg} ${catStyle.text}`}>
                    {catStyle.label}
                  </span>
                )}
              </div>
              <h3 className="text-xl font-display font-bold text-text-primary mb-1 leading-tight">
                {nextSession.title}
              </h3>
              <p className="text-sm text-text-secondary mb-3">
                {fmtDate(nextSession.startTime, nextSession.timezone)}
                {' · '}
                {fmtTimeRange(nextSession.startTime, nextSession.endTime, nextSession.timezone)}
              </p>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1 text-text-secondary">
                  <Clock size={11} />
                  {fmtDuration(nextSession.startTime, nextSession.endTime)}
                </span>
                {nextSession.isRecurring && (
                  <span className="flex items-center gap-1 text-text-secondary">
                    <Repeat size={11} />
                    Recurring
                  </span>
                )}
                <span className="text-accent font-semibold">
                  {fmtRelative(nextSession.startTime)}
                </span>
              </div>
              <button
                onClick={onSwitchToCalendar}
                className="mt-4 flex items-center gap-1 text-sm text-accent font-medium hover:underline transition-colors"
              >
                View full schedule <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Upcoming mini-list */}
        <div className="bg-surface-card border border-border-default rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#c9a84c] uppercase tracking-widest">
              Upcoming
            </span>
            <span className="text-xs text-text-secondary">{upcoming.length} total</span>
          </div>
          {laterSessions.length === 0 ? (
            <p className="text-sm text-text-secondary">Only one session scheduled.</p>
          ) : (
            <div className="space-y-2.5">
              {laterSessions.map(s => (
                <div key={s.id} className="flex items-center gap-2 text-sm min-w-0">
                  <span className="text-text-secondary text-xs flex-shrink-0 w-14 truncate">
                    {new Intl.DateTimeFormat('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric', timeZone: s.timezone,
                    }).format(new Date(s.startTime)).split(',')[0]}
                    {' '}
                    {new Intl.DateTimeFormat('en-US', {
                      month: 'short', day: 'numeric', timeZone: s.timezone,
                    }).format(new Date(s.startTime))}
                  </span>
                  <span className="text-text-primary flex-1 truncate font-medium">{s.title}</span>
                  <span className="text-text-secondary text-xs flex-shrink-0">
                    {fmtDuration(s.startTime, s.endTime)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={onSwitchToCalendar}
            className="mt-3 flex items-center gap-1 text-xs text-accent font-medium hover:underline"
          >
            View all <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {/* Row 2: Recurring Series + Discord Sync */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Recurring Series */}
        <div className="bg-surface-card border border-border-default rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Repeat size={13} className="text-text-secondary" />
            <span className="text-xs font-semibold text-[#c9a84c] uppercase tracking-widest">
              Recurring Series
            </span>
          </div>
          {recurringCount > 0 ? (
            <>
              <p className="text-3xl font-display font-bold text-text-primary">{recurringCount}</p>
              <p className="text-xs text-text-secondary mt-1">
                active recurring {recurringCount === 1 ? 'series' : 'series'}
              </p>
            </>
          ) : (
            <p className="text-sm text-text-secondary">
              No recurring sessions. Create one in the calendar view.
            </p>
          )}
          <button
            onClick={onSwitchToCalendar}
            className="mt-3 flex items-center gap-1 text-xs text-accent font-medium hover:underline"
          >
            Manage series <ChevronRight size={12} />
          </button>
        </div>

        {/* Discord Sync */}
        <div className="bg-surface-card border border-border-default rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Link2 size={13} className="text-text-secondary" />
            <span className="text-xs font-semibold text-[#c9a84c] uppercase tracking-widest">
              Discord Sync
            </span>
          </div>
          {discordConnected ? (
            <div className="flex items-start gap-2.5">
              <CheckCircle size={16} className="text-status-success flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {discordLinked && settings?.discordGuildName
                    ? settings.discordGuildName
                    : 'Connected'}
                </p>
                <p className="text-xs text-text-secondary">Reminders and events synced</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5">
              <XCircle size={16} className="text-text-muted flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-text-secondary">Not connected</p>
                <p className="text-xs text-text-muted">Link Discord to sync reminders</p>
              </div>
            </div>
          )}
          {canManage && (
            <button
              onClick={onSwitchToCalendar}
              className="mt-3 flex items-center gap-1 text-xs text-accent font-medium hover:underline"
            >
              {discordConnected ? 'Manage' : 'Configure'} integration <ChevronRight size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
