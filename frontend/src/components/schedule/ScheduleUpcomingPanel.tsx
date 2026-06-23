/* eslint-disable design-system/no-raw-button */
import { useEffect, useMemo } from 'react';
import { Calendar, Clock, Repeat, Link2, ChevronRight, CheckCircle, XCircle, Plus } from 'lucide-react';
import { useScheduleStore } from '../../stores/scheduleStore';
import { DashboardCard, IconMedallion } from '../ui/DashboardCard';
import { EmptyState } from '../ui/EmptyState';

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

function fmtShortDate(iso: string, tz: string): string {
  const date = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz }).format(new Date(iso));
  const md = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: tz }).format(new Date(iso));
  return `${date} ${md}`;
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
      <div className="space-y-4">
        <EmptyState
          icon={<Calendar size={28} />}
          heading="No sessions scheduled"
          description="Create your first raid night and choose whether availability should be tracked."
          action={canManage && onCreateSession ? { label: 'Add session', onClick: onCreateSession } : undefined}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DashboardCard title="Recurring Series" icon={<Repeat size={13} />}>
            <p className="text-sm text-text-secondary">
              No recurring sessions. Create one in the calendar to set up weekly raid nights.
            </p>
            <button
              onClick={onSwitchToCalendar}
              className="mt-3 flex items-center gap-1 text-xs text-accent font-medium hover:underline"
            >
              Go to Calendar <ChevronRight size={12} />
            </button>
          </DashboardCard>
          <DashboardCard title="Discord Sync" icon={<Link2 size={13} />}>
            {discordConnected ? (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle size={14} className="text-status-success" />
                <span className="text-text-primary font-medium">
                  {discordLinked && settings?.discordGuildName ? settings.discordGuildName : 'Connected'}
                </span>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">
                Link Discord to send reminders and sync event announcements automatically.
              </p>
            )}
            {canManage && (
              <button
                onClick={onSwitchToCalendar}
                className="mt-3 flex items-center gap-1 text-xs text-accent font-medium hover:underline"
              >
                {discordConnected ? 'Manage' : 'Configure integration'} <ChevronRight size={12} />
              </button>
            )}
          </DashboardCard>
        </div>
        <button
          onClick={onSwitchToCalendar}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <Calendar size={14} />
          View calendar & availability
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
          <DashboardCard
            accentColor="teal"
            onClick={onSwitchToCalendar}
            className="lg:col-span-2"
          >
            <div className="flex items-center gap-2 mb-3">
              <IconMedallion icon={<Calendar size={14} />} color="teal" size="sm" />
              <span className="text-xs font-semibold text-accent uppercase tracking-widest">Next Session</span>
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
              <span className="text-accent font-semibold">{fmtRelative(nextSession.startTime)}</span>
            </div>
            <div className="mt-4 flex items-center gap-1 text-accent text-xs font-medium">
              View full schedule <ChevronRight size={12} />
            </div>
          </DashboardCard>
        )}

        {/* Upcoming mini-list */}
        <DashboardCard
          title="Upcoming"
          badge={<span className="text-xs text-text-secondary">{upcoming.length} sessions</span>}
        >
          {laterSessions.length === 0 ? (
            <p className="text-sm text-text-secondary">Only one session scheduled.</p>
          ) : (
            <div className="space-y-2.5">
              {laterSessions.map(s => (
                <div key={s.id} className="flex items-center gap-2 text-sm min-w-0">
                  <span className="text-text-secondary text-xs flex-shrink-0 w-16 truncate">
                    {fmtShortDate(s.startTime, s.timezone)}
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
        </DashboardCard>
      </div>

      {/* Row 2: Recurring + Discord Sync */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Recurring Series */}
        <DashboardCard title="Recurring Series" icon={<Repeat size={13} />}>
          {recurringCount > 0 ? (
            <>
              <p className="text-3xl font-display font-bold text-text-primary">{recurringCount}</p>
              <p className="text-xs text-text-secondary mt-1">active recurring series</p>
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
        </DashboardCard>

        {/* Discord Sync */}
        <DashboardCard
          title="Discord Sync"
          icon={<Link2 size={13} />}
          accentColor={discordConnected ? 'teal' : undefined}
        >
          {discordConnected ? (
            <div className="flex items-start gap-2.5">
              <IconMedallion icon={<CheckCircle size={14} />} color="teal" size="sm" />
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {discordLinked && settings?.discordGuildName ? settings.discordGuildName : 'Connected'}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">Reminders and events synced</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5">
              <IconMedallion icon={<XCircle size={14} />} color="neutral" size="sm" />
              <div>
                <p className="text-sm text-text-secondary">Not connected</p>
                <p className="text-xs text-text-muted mt-0.5">Link Discord to sync reminders</p>
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
        </DashboardCard>
      </div>

      {/* Add session shortcut if canManage */}
      {canManage && (
        <button
          onClick={onSwitchToCalendar}
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <Plus size={14} />
          Add a session
        </button>
      )}
    </div>
  );
}
