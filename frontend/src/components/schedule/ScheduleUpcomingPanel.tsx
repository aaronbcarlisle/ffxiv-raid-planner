/* eslint-disable design-system/no-raw-button */
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Clock, Repeat, Link2, ChevronRight, CheckCircle, XCircle, Plus, PlugZap } from 'lucide-react';
import { useScheduleStore } from '../../stores/scheduleStore';
import { DashboardCard, IconMedallion } from '../ui/DashboardCard';
import { EmptyState } from '../ui/EmptyState';

interface ScheduleUpcomingPanelProps {
  groupId: string;
  canManage: boolean;
  onSwitchToCalendar: () => void;
  onCreateSession?: () => void;
  onOpenPlugin?: () => void;
}

function getUiLocale(language: string): string {
  return language.startsWith('ja') ? 'ja-JP' : 'en-US';
}

function fmtDate(iso: string, tz: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: tz,
  }).format(new Date(iso));
}

function fmtTimeRange(start: string, end: string, tz: string, locale: string): string {
  const s = new Intl.DateTimeFormat(locale, {
    hour: 'numeric', minute: '2-digit', timeZone: tz,
  }).format(new Date(start));
  const e = new Intl.DateTimeFormat(locale, {
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: tz,
  }).format(new Date(end));
  return `${s} – ${e}`;
}

function fmtDuration(start: string, end: string, locale: string): string {
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (locale.startsWith('ja')) {
    if (h === 0) return `${m}分`;
    return m ? `${h}時間${m}分` : `${h}時間`;
  }
  if (h === 0) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function fmtRelative(iso: string, locale: string, startingNowLabel: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (Math.abs(diff) < 60000) return startingNowLabel;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 60) return rtf.format(mins, 'minute');
  const hours = Math.round(diff / 3600000);
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  const days = Math.round(diff / 86400000);
  return rtf.format(days, 'day');
}

function fmtShortDate(iso: string, tz: string, locale: string): string {
  const date = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: tz }).format(new Date(iso));
  const md = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: tz }).format(new Date(iso));
  return `${date} ${md}`;
}

export function ScheduleUpcomingPanel({
  groupId,
  canManage,
  onSwitchToCalendar,
  onCreateSession,
  onOpenPlugin,
}: ScheduleUpcomingPanelProps) {
  const { t, i18n } = useTranslation();
  const { sessions, settings, isLoading, fetchSessions, fetchSettings } = useScheduleStore();
  const uiLocale = getUiLocale(i18n.resolvedLanguage ?? i18n.language ?? 'en');
  const categoryStyles: Record<string, { bg: string; text: string; label: string }> = {
    progression: { bg: 'bg-role-melee/15', text: 'text-role-melee', label: t('session.categoryProg') },
    farm:        { bg: 'bg-role-healer/15', text: 'text-role-healer', label: t('session.categoryFarm') },
    mount_farm:  { bg: 'bg-role-ranged/15', text: 'text-role-ranged', label: t('session.categoryMountFarm') },
    ultimate:    { bg: 'bg-role-caster/15', text: 'text-role-caster', label: t('session.categoryUltimate') },
    social:      { bg: 'bg-role-tank/15', text: 'text-role-tank', label: t('session.categorySocial') },
  };

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
        {t('scheduleUpcoming.loading')}
      </div>
    );
  }

  if (!isLoading && upcoming.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={<Calendar size={28} />}
          heading={t('scheduleUpcoming.noSessionsTitle')}
          description={t('scheduleUpcoming.noSessionsDesc')}
          action={canManage && onCreateSession ? { label: t('schedule.addSession'), onClick: onCreateSession } : undefined}
          className="py-8"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <DashboardCard title={t('scheduleUpcoming.recurringSeries')} icon={<Repeat size={13} />} onClick={onSwitchToCalendar}>
            <p className="text-sm text-text-secondary mb-3">
              {t('scheduleUpcoming.noRecurringSessions')}
            </p>
            <div className="flex items-center gap-1 text-accent text-xs font-medium">
              {t('scheduleUpcoming.goToCalendar')} <ChevronRight size={12} />
            </div>
          </DashboardCard>
          <DashboardCard
            title={t('scheduleUpcoming.discordSync')}
            icon={<Link2 size={13} />}
            accentColor={discordConnected ? 'teal' : undefined}
            onClick={canManage ? onSwitchToCalendar : undefined}
          >
            {discordConnected ? (
              <div className="flex items-center gap-2 text-sm mb-3">
                <CheckCircle size={14} className="text-status-success" />
                <span className="text-text-primary font-medium">
                  {discordLinked && settings?.discordGuildName ? settings.discordGuildName : t('common.connected')}
                </span>
              </div>
            ) : (
              <p className="text-sm text-text-secondary mb-3">
                {t('scheduleUpcoming.discordEmptyDesc')}
              </p>
            )}
            {canManage && (
              <div className="flex items-center gap-1 text-accent text-xs font-medium">
                {discordConnected ? t('scheduleUpcoming.manageIntegration') : t('scheduleUpcoming.configureIntegration')} <ChevronRight size={12} />
              </div>
            )}
          </DashboardCard>
          <DashboardCard title={t('nav.dalamudPlugin')} icon={<PlugZap size={13} />} onClick={onOpenPlugin}>
            <p className="text-sm text-text-secondary mb-3">
              {t('scheduleUpcoming.pluginSetupDesc')}
            </p>
            <div className="flex items-center gap-1 text-accent text-xs font-medium">
              {t('scheduleUpcoming.setupPlugin')} <ChevronRight size={12} />
            </div>
          </DashboardCard>
        </div>
        <button
          onClick={onSwitchToCalendar}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <Calendar size={14} />
          {t('scheduleUpcoming.viewCalendarAvailability')}
        </button>
      </div>
    );
  }

  const catStyle = nextSession?.category ? (categoryStyles[nextSession.category] ?? null) : null;

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
              <span className="text-xs font-semibold text-accent uppercase tracking-widest">{t('scheduleUpcoming.nextSession')}</span>
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
              {fmtDate(nextSession.startTime, nextSession.timezone, uiLocale)}
              {' · '}
              {fmtTimeRange(nextSession.startTime, nextSession.endTime, nextSession.timezone, uiLocale)}
            </p>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1 text-text-secondary">
                <Clock size={11} />
                {fmtDuration(nextSession.startTime, nextSession.endTime, uiLocale)}
              </span>
              {nextSession.isRecurring && (
                <span className="flex items-center gap-1 text-text-secondary">
                  <Repeat size={11} />
                  {t('session.recurring')}
                </span>
              )}
              <span className="text-accent font-semibold">{fmtRelative(nextSession.startTime, uiLocale, t('scheduleUpcoming.startingNow'))}</span>
            </div>
            <div className="mt-4 flex items-center gap-1 text-accent text-xs font-medium">
              {t('scheduleUpcoming.viewFullSchedule')} <ChevronRight size={12} />
            </div>
          </DashboardCard>
        )}

        {/* Upcoming mini-list */}
        <DashboardCard
          title={t('scheduleUpcoming.upcoming')}
          badge={<span className="text-xs text-text-secondary">{t('scheduleUpcoming.sessionsCount', { count: upcoming.length })}</span>}
        >
          {laterSessions.length === 0 ? (
            <p className="text-sm text-text-secondary">{t('scheduleUpcoming.onlyOneSession')}</p>
          ) : (
            <div className="space-y-2.5">
              {laterSessions.map(s => (
                <div key={s.id} className="flex items-center gap-2 text-sm min-w-0">
                  <span className="text-text-secondary text-xs flex-shrink-0 w-16 truncate">
                    {fmtShortDate(s.startTime, s.timezone, uiLocale)}
                  </span>
                  <span className="text-text-primary flex-1 truncate font-medium">{s.title}</span>
                  <span className="text-text-secondary text-xs flex-shrink-0">
                    {fmtDuration(s.startTime, s.endTime, uiLocale)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={onSwitchToCalendar}
            className="mt-3 flex items-center gap-1 text-xs text-accent font-medium hover:underline"
          >
            {t('common.viewAll')} <ChevronRight size={12} />
          </button>
        </DashboardCard>
      </div>

      {/* Row 2: Recurring + Discord Sync + Plugin */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Recurring Series */}
        <DashboardCard title={t('scheduleUpcoming.recurringSeries')} icon={<Repeat size={13} />} onClick={onSwitchToCalendar}>
          {recurringCount > 0 ? (
            <>
              <p className="text-3xl font-display font-bold text-text-primary">{recurringCount}</p>
              <p className="text-xs text-text-secondary mt-1 mb-3">{t('scheduleUpcoming.activeRecurringSeries', { count: recurringCount })}</p>
            </>
          ) : (
            <p className="text-sm text-text-secondary mb-3">
              {t('scheduleUpcoming.noRecurringSessionsShort')}
            </p>
          )}
          <div className="flex items-center gap-1 text-accent text-xs font-medium">
            {t('scheduleUpcoming.manageSeries')} <ChevronRight size={12} />
          </div>
        </DashboardCard>

        {/* Discord Sync */}
        <DashboardCard
          title={t('scheduleUpcoming.discordSync')}
          icon={<Link2 size={13} />}
          accentColor={discordConnected ? 'teal' : undefined}
          onClick={canManage ? onSwitchToCalendar : undefined}
        >
          {discordConnected ? (
            <div className="flex items-start gap-2.5 mb-3">
              <IconMedallion icon={<CheckCircle size={14} />} color="teal" size="sm" />
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {discordLinked && settings?.discordGuildName ? settings.discordGuildName : t('common.connected')}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">{t('scheduleUpcoming.remindersAndEventsSynced')}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 mb-3">
              <IconMedallion icon={<XCircle size={14} />} color="neutral" size="sm" />
              <div>
                <p className="text-sm text-text-secondary">{t('common.notConnected')}</p>
                <p className="text-xs text-text-muted mt-0.5">{t('scheduleUpcoming.linkDiscordToSyncReminders')}</p>
              </div>
            </div>
          )}
          {canManage && (
            <div className="flex items-center gap-1 text-accent text-xs font-medium">
              {discordConnected ? t('scheduleUpcoming.manageIntegration') : t('scheduleUpcoming.configureIntegration')} <ChevronRight size={12} />
            </div>
          )}
        </DashboardCard>

        {/* Dalamud Plugin */}
        <DashboardCard title={t('nav.dalamudPlugin')} icon={<PlugZap size={13} />} onClick={onOpenPlugin}>
          <div className="flex items-start gap-2.5 mb-3">
            <IconMedallion icon={<PlugZap size={14} />} color="neutral" size="sm" />
            <div>
              <p className="text-sm text-text-secondary">{t('scheduleUpcoming.pluginRealtimeDesc')}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-accent text-xs font-medium">
            {t('scheduleUpcoming.setupPlugin')} <ChevronRight size={12} />
          </div>
        </DashboardCard>
      </div>

      {/* Add session shortcut if canManage */}
      {canManage && (
        <button
          onClick={onSwitchToCalendar}
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <Plus size={14} />
          {t('scheduleUpcoming.addSessionShortcut')}
        </button>
      )}
    </div>
  );
}
