import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUrlTabState } from '../../hooks/useUrlTabState';
import { AlertTriangle, Bell, Calendar, CalendarClock, CalendarDays, CheckCircle, Copy, ExternalLink, LayoutGrid, List, Link2, Plus, RefreshCw, RotateCcw, Send, ShieldCheck, Trash2, Unlink } from 'lucide-react';
import { XivIcon } from '../ui/XivIcon';
import { useScheduleStore } from '../../stores/scheduleStore';
import { useAuthStore } from '../../stores/authStore';
import { canManageRoster } from '../../utils/permissions';
import { useModal } from '../../hooks/useModal';
import { useEventBus, Events } from '../../lib/eventBus';
import { Button } from '../primitives';
import { Checkbox, Input, Label, Spinner } from '../ui';
import { SessionCard } from './SessionCard';
import { CreateSessionModal } from './CreateSessionModal';
import { AvailabilityGrid } from './AvailabilityGrid';
import type { DiscordMirrorStatus, ScheduleSession, ScheduleSessionCreate, RsvpStatus, MemberRole, Membership } from '../../types';
import { buildScheduleDraftFromContent, type ScheduleContentDraftRequest } from './sessionDrafts';

type SchedulerSubTab = 'sessions' | 'availability' | 'integrations';
type WebhookMentionTarget = 'none' | 'here' | 'role';

const DISCORD_ROLE_ID_PATTERN = /^(?:<@&)?(\d{17,20})>?$/;
const DISCORD_SCHEDULE_EVENT_PERMISSIONS = '17600775979008';
const DISCORD_INSTALL_SCOPES = 'bot applications.commands';

function buildDiscordInstallUrl(clientId?: string | null): string {
  const params = new URLSearchParams({
    client_id: clientId ?? '',
    permissions: DISCORD_SCHEDULE_EVENT_PERMISSIONS,
    integration_type: '0',
    scope: DISCORD_INSTALL_SCOPES,
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

function normalizeDiscordRoleId(value: string): string {
  const match = value.trim().match(DISCORD_ROLE_ID_PATTERN);
  return match?.[1] ?? '';
}

interface ScheduleTabProps {
  groupId: string;
  staticName: string;
  shareCode: string;
  members: Membership[];
  userRole: MemberRole | null | undefined;
}

export function ScheduleTab({ groupId, staticName, shareCode, members, userRole }: ScheduleTabProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const {
    sessions,
    settings,
    isLoading,
    isLoadingSettings,
    error,
    fetchSessions,
    fetchSettings,
    updateSettings,
    sendTestReminder,
    postSessionPreview,
    regenerateCalendar,
    revokeCalendar,
    createSession,
    updateSession,
    deleteSession,
    submitRsvp,
    syncAllDiscordMirrors,
    fetchDiscordMirrors,
    createDiscordInstallClaim,
    fetchDiscordLink,
    disconnectDiscordLink,
    clearSessions,
  } = useScheduleStore();
  const createModal = useModal();
  const [editSession, setEditSession] = useState<ScheduleSession | null>(null);
  const [createDraft, setCreateDraft] = useState<ScheduleSessionCreate | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channelLabel, setChannelLabel] = useState('');
  const [enableAtStart, setEnableAtStart] = useState(false);
  const [enable15m, setEnable15m] = useState(false);
  const [enable24h, setEnable24h] = useState(false);
  const [enable1h, setEnable1h] = useState(false);
  const [enable6h, setEnable6h] = useState(false);
  const [enable12h, setEnable12h] = useState(false);
  const [enableMissingRsvp, setEnableMissingRsvp] = useState(false);
  const [mentionTarget, setMentionTarget] = useState<WebhookMentionTarget>('none');
  const [mentionRoleId, setMentionRoleId] = useState('');
  const [mentionError, setMentionError] = useState<string | null>(null);
  const [highlightedSessionId, setHighlightedSessionId] = useState<string | null>(null);
  const [integrationMessage, setIntegrationMessage] = useState<string | null>(null);
  const [postingPreview, setPostingPreview] = useState(false);
  const [syncingDiscord, setSyncingDiscord] = useState(false);
  const [discordMirrors, setDiscordMirrors] = useState<DiscordMirrorStatus[]>([]);
  const [loadingMirrorStatus, setLoadingMirrorStatus] = useState(false);
  // Discord install-claim flow state
  const [discordClaimCode, setDiscordClaimCode] = useState<string | null>(null);
  const [discordClaimExpiry, setDiscordClaimExpiry] = useState<string | null>(null);
  const [discordClaimLoading, setDiscordClaimLoading] = useState(false);
  const [discordCheckLoading, setDiscordCheckLoading] = useState(false);
  const [sessionViewMode, setSessionViewMode] = useState<'list' | 'tiles'>(() => {
    const saved = localStorage.getItem('schedule-session-view');
    return saved === 'tiles' ? 'tiles' : 'list';
  });
  const [activeSubTab, setActiveSubTab] = useState<SchedulerSubTab>(() => {
    const saved = sessionStorage.getItem(`schedule-subtab-${groupId}`);
    return saved === 'availability' || saved === 'integrations' || saved === 'sessions'
      ? saved
      : 'sessions';
  });

  // Listen for content schedule requests from farm/reward views.
  useEventBus<ScheduleContentDraftRequest>(
    Events.MOUNT_FARM_SCHEDULE,
    (request) => {
      setCreateDraft(buildScheduleDraftFromContent(request));
      setActiveSubTab('sessions');
      createModal.open();
    }
  );

  useEffect(() => {
    // Only fetch member-only endpoints when the user has a role in this group.
    // Applicants / non-members get a 403 from the backend; skipping the fetch
    // prevents repeated error toasts on the Schedule tab.
    if (userRole) {
      void fetchSessions(groupId).catch(() => undefined);
      void fetchSettings(groupId).catch(() => undefined);
    }
    return () => {
      clearSessions();
    };
  }, [groupId, userRole, fetchSessions, fetchSettings, clearSessions]);

  useEffect(() => {
    if (!settings) return;
    setWebhookUrl('');
    setChannelLabel(settings.reminderChannelLabel || '');
    setEnableAtStart(Boolean(settings.enableAtStartReminder));
    setEnable15m(Boolean(settings.enable15mReminder));
    setEnable24h(Boolean(settings.enable24hReminder));
    setEnable1h(Boolean(settings.enable1hReminder));
    setEnable6h(Boolean(settings.enable6hReminder));
    setEnable12h(Boolean(settings.enable12hReminder));
    setEnableMissingRsvp(Boolean(settings.enableMissingRsvpReminder));
    setMentionTarget(settings.mentionTarget || 'none');
    setMentionRoleId(settings.mentionRoleId || '');
    setMentionError(null);
    // Clear any pending claim state when settings reload
    if (settings.discordLinkStatus === 'connected') {
      setDiscordClaimCode(null);
      setDiscordClaimExpiry(null);
    }
  }, [settings]);

  // Tracks the sessionId we've already jumped to, so the effect below acts once
  // per deep-linked session rather than on every `sessions` refetch.
  const handledSessionRef = useRef<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('sessionId');
    if (!sessionId || !sessions.some((session) => session.id === sessionId)) return;
    // Only act the first time this sessionId becomes resolvable. Without this,
    // a `sessions` refetch (e.g. after an RSVP) would re-run the jump and yank
    // the user back to Sessions if they'd navigated away.
    if (handledSessionRef.current === sessionId) return;
    handledSessionRef.current = sessionId;

    // Jump to the Sessions sub-tab, but only if not already there. `stab` omits
    // its default ('sessions') from the URL, so a missing param means we're
    // already on Sessions — treat it as such to avoid a redundant navigation.
    if ((params.get('stab') ?? 'sessions') !== 'sessions') setActiveSubTab('sessions');
    setHighlightedSessionId(sessionId);
    window.setTimeout(() => {
      document.getElementById(`schedule-session-${sessionId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 50);

    const clearHighlight = window.setTimeout(() => setHighlightedSessionId(null), 5000);
    return () => window.clearTimeout(clearHighlight);
  }, [sessions]);

  useEffect(() => {
    if (!userRole || sessions.length === 0) {
      setDiscordMirrors([]);
      return;
    }

    let cancelled = false;
    setLoadingMirrorStatus(true);
    Promise.all(
      sessions.map((session) =>
        fetchDiscordMirrors(groupId, session.id).catch(() => [] as DiscordMirrorStatus[])
      )
    )
      .then((rows) => {
        if (!cancelled) {
          setDiscordMirrors(rows.flat());
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingMirrorStatus(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchDiscordMirrors, groupId, sessions, userRole]);

  const hasAuthenticatedUser = !!user;
  const canManage = hasAuthenticatedUser && canManageRoster(userRole, user?.isAdmin).allowed;
  const canRsvp = hasAuthenticatedUser && !!userRole && userRole !== 'viewer';
  const upcomingSessionCount = sessions.length;
  const trackedMemberCount = useMemo(
    () => members.filter((member) => member.role !== 'viewer').length,
    [members]
  );
  const discordMirrorSummary = useMemo(() => {
    const synced = discordMirrors.filter((mirror) => mirror.syncStatus === 'synced').length;
    const failed = discordMirrors.filter((mirror) => mirror.syncStatus === 'failed' || mirror.syncStatus === 'manual_action_needed').length;
    const pending = discordMirrors.filter((mirror) => mirror.syncStatus === 'pending' || mirror.syncStatus === 'not_synced').length;
    const lastSyncedAt = discordMirrors
      .map((mirror) => mirror.lastSyncedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;
    const latestError = discordMirrors.find((mirror) => mirror.lastError)?.lastError ?? null;
    return { synced, failed, pending, lastSyncedAt, latestError, total: discordMirrors.length };
  }, [discordMirrors]);
  const discordDeliverySummary = useMemo(() => {
    const reminderLabels = [
      settings?.enable24hReminder ? '24 hrs before' : '',
      settings?.enable12hReminder ? '12 hrs before' : '',
      settings?.enable6hReminder ? '6 hrs before' : '',
      settings?.enable1hReminder ? '1 hr before' : '',
      settings?.enable15mReminder ? '15 min before' : '',
      settings?.enableAtStartReminder ? 'At start' : '',
      settings?.enableMissingRsvpReminder ? 'Missing RSVP' : '',
    ].filter(Boolean);
    const rolePreview = settings?.mentionTarget === 'role' && settings.mentionRoleId
      ? `<@&${settings.mentionRoleId}>`
      : null;
    return {
      serverLabel: settings?.discordGuildName ?? (settings?.discordGuildId ? `Guild ${settings.discordGuildId}` : 'Discord'),
      mirrorEnabled: settings?.discordLinkStatus === 'connected' || Boolean(settings?.discordBotConfigured && settings?.discordGuildId),
      remindersEnabled: Boolean(settings?.webhookConfigured && reminderLabels.length > 0),
      reminderLabels,
      pingLabel: settings?.mentionTarget === 'here' ? '@here' : rolePreview ?? 'No ping',
    };
  }, [settings]);
  const sessionDeliveryStatus = useMemo(() => {
    const reminders = discordDeliverySummary.remindersEnabled
      ? discordDeliverySummary.reminderLabels
          .filter((label) => label !== 'Missing RSVP')
          .map((label) => label.replace(' before', ''))
          .join(' + ') || 'active'
      : null;

    return Object.fromEntries(sessions.map((session) => {
      const mirrors = discordMirrors.filter((mirror) => mirror.sessionId === session.id);
      let mirrorState: 'synced' | 'failed' | 'pending' | 'disabled' = discordDeliverySummary.mirrorEnabled ? 'pending' : 'disabled';
      if (mirrors.some((mirror) => mirror.syncStatus === 'failed' || mirror.syncStatus === 'manual_action_needed')) {
        mirrorState = 'failed';
      } else if (mirrors.some((mirror) => mirror.syncStatus === 'synced')) {
        mirrorState = 'synced';
      }
      return [session.id, { mirrorState, reminderLabel: reminders }];
    }));
  }, [discordDeliverySummary, discordMirrors, sessions]);

  const handleCreate = async (data: ScheduleSessionCreate) => {
    await createSession(groupId, data);
    setCreateDraft(null);
  };

  const handleUpdate = async (data: ScheduleSessionCreate) => {
    if (!editSession) return;
    await updateSession(groupId, editSession.id, data);
    await fetchSessions(groupId);
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

  const handleSaveIntegrations = async () => {
    const normalizedRoleId = normalizeDiscordRoleId(mentionRoleId);
    if (mentionTarget === 'role' && !normalizedRoleId) {
      setMentionError('Enter a valid Discord role ID or <@&ROLE_ID> mention.');
      return;
    }
    setMentionError(null);

    await updateSettings(groupId, {
      webhookUrl: webhookUrl || undefined,
      reminderChannelLabel: channelLabel || null,
      mentionTarget,
      mentionRoleId: mentionTarget === 'role' ? normalizedRoleId : null,
      enableAtStartReminder: enableAtStart,
      enable15mReminder: enable15m,
      enable24hReminder: enable24h,
      enable1hReminder: enable1h,
      enable6hReminder: enable6h,
      enable12hReminder: enable12h,
      enableMissingRsvpReminder: enableMissingRsvp,
    });
    setWebhookUrl('');
    setIntegrationMessage('Webhook saved.');
  };

  const handleConnectDiscord = async () => {
    setDiscordClaimLoading(true);
    try {
      const claim = await createDiscordInstallClaim(groupId);
      setDiscordClaimCode(claim.claimCode);
      setDiscordClaimExpiry(claim.expiresAt);
    } catch {
      setIntegrationMessage('Failed to start Discord connection. Please try again.');
    } finally {
      setDiscordClaimLoading(false);
    }
  };

  const handleRefreshLink = async () => {
    setDiscordCheckLoading(true);
    try {
      const link = await fetchDiscordLink(groupId);
      if (link && link.status === 'connected') {
        setDiscordClaimCode(null);
        setDiscordClaimExpiry(null);
        await fetchSettings(groupId);
        setIntegrationMessage('Discord server connected successfully!');
      } else {
        setIntegrationMessage('Not linked yet — run /xrp link <code> in your Discord server first.');
      }
    } finally {
      setDiscordCheckLoading(false);
    }
  };

  const handleDisconnectDiscord = async () => {
    try {
      await disconnectDiscordLink(groupId);
      setDiscordClaimCode(null);
      setDiscordClaimExpiry(null);
      setIntegrationMessage('Discord server disconnected.');
    } catch {
      setIntegrationMessage('Failed to disconnect. Please try again.');
    }
  };

  const handleSyncAllDiscord = async () => {
    setSyncingDiscord(true);
    setIntegrationMessage(null);
    try {
      if (sessions.length === 0) {
        const actions = await syncAllDiscordMirrors(groupId);
        setIntegrationMessage(`Discord sync: ${actions.join('; ')}`);
        return;
      }
      const allLogs = await syncAllDiscordMirrors(groupId);
      const mirrorRows = await Promise.all(
        sessions.map((s) => fetchDiscordMirrors(groupId, s.id).catch(() => [] as DiscordMirrorStatus[]))
      );
      setDiscordMirrors(mirrorRows.flat());
      const created = allLogs.filter(a => a.includes('created') && a.endsWith('ok'));
      const updated = allLogs.filter(a => a.includes('updated') && a.endsWith('ok'));
      const noChange = allLogs.filter(a => a.includes('no change'));
      const deleted = allLogs.filter(a => a.startsWith('deleted'));
      const failed = allLogs.filter(
        a => !created.includes(a) && !updated.includes(a) && !noChange.includes(a) && !deleted.includes(a)
      );
      const parts = [
        created.length ? `${created.length} created` : '',
        updated.length ? `${updated.length} updated` : '',
        noChange.length ? `${noChange.length} unchanged` : '',
        failed.length ? `${failed.length} failed` : '',
      ].filter(Boolean).join(', ');
      if (failed.length > 0) {
        setIntegrationMessage(`Discord sync: ${parts || 'done'}. Errors: ${failed.slice(0, 2).join('; ')}`);
      } else {
        setIntegrationMessage(`Discord sync complete — ${parts || `${allLogs.length} action(s)`}.`);
      }
    } catch {
      setIntegrationMessage('Discord sync failed. Check bot token and guild ID.');
    } finally {
      setSyncingDiscord(false);
    }
  };

  const handleCopyCalendarUrl = async () => {
    if (!settings?.calendarUrl) return;
    await navigator.clipboard.writeText(settings.calendarUrl);
    setIntegrationMessage('Copied!');
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
      label: t('schedule.tabSessions'),
      badge: String(upcomingSessionCount),
      icon: CalendarClock,
    },
    {
      id: 'availability',
      label: t('schedule.tabAvailability'),
      badge: `${trackedMemberCount} tracked`,
      icon: Sparkles,
    },
    {
      id: 'integrations',
      label: t('schedule.tabIntegrations'),
      badge: canManage ? 'Setup' : 'View',
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
            {t('schedule.raidSchedule')}
          </h2>
          <p className="text-sm text-text-secondary">
            {t('schedule.timezoneNote', { tz: Intl.DateTimeFormat().resolvedOptions().timeZone })}
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
                // The active variant carries a 1px border; reserve the same
                // border (transparent) on the inactive tabs so switching tabs
                // only changes the border *color*, never the box size. Without
                // this the tabs grow/shrink ~2px and the label visibly pops.
                className={isActive ? '' : 'border border-transparent'}
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
            {t('schedule.addSession')}
          </Button>
        )}
      </div>

      {activeSubTab === 'sessions' && (
        <div className="space-y-4" data-testid="schedule-sessions-panel">
          {nextSession && (
            <div className="flex flex-col gap-3 rounded-xl border border-border-default bg-surface-card/80 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-text-muted">
                  {t('schedule.nextScheduledRaid')}
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
                {t('schedule.viewBestOverlap')}
              </Button>
            </div>
          )}

          {sessions.length === 0 ? (
            <div className="py-12 text-center text-text-muted">
              <Calendar className="mx-auto mb-3 h-12 w-12 opacity-40" />
              <p className="text-lg">{t('schedule.noRaidSessions')}</p>
              {canManage && (
                <p className="mt-1 text-sm">{t('schedule.createFirstRaidNight')}</p>
              )}
            </div>
          ) : (
            <>
              {/* View toggle — tiles or list */}
              <div className="hidden sm:flex justify-end">
                <div className="flex bg-surface-raised rounded-lg p-0.5 gap-0.5">
                  {/* design-system-ignore: View toggle requires specific styling */}
                  <button
                    onClick={() => { setSessionViewMode('tiles'); localStorage.setItem('schedule-session-view', 'tiles'); }}
                    className={`p-1.5 rounded-md transition-colors ${sessionViewMode === 'tiles' ? 'bg-accent/20 text-accent' : 'text-text-tertiary hover:text-text-primary'}`}
                    aria-label={t('schedule.tileView')}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  {/* design-system-ignore: View toggle requires specific styling */}
                  <button
                    onClick={() => { setSessionViewMode('list'); localStorage.setItem('schedule-session-view', 'list'); }}
                    className={`p-1.5 rounded-md transition-colors ${sessionViewMode === 'list' ? 'bg-accent/20 text-accent' : 'text-text-tertiary hover:text-text-primary'}`}
                    aria-label={t('schedule.listView')}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className={sessionViewMode === 'tiles'
                ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3'
                : 'space-y-3'
              }>
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    id={`schedule-session-${session.id}`}
                    className={highlightedSessionId === session.id ? 'rounded-xl ring-2 ring-accent/70 ring-offset-2 ring-offset-background' : undefined}
                  >
                    <SessionCard
                      session={session}
                      currentUserId={user?.id}
                      shareCode={shareCode}
                      staticName={staticName}
                      canManage={canManage}
                      canRsvp={canRsvp}
                      compact={sessionViewMode === 'tiles'}
                      groupId={groupId}
                      deliveryStatus={sessionDeliveryStatus[session.id]}
                      onRsvp={handleRsvp}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  </div>
                ))}
              </div>
            </>
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
        <div className="space-y-5" data-testid="schedule-integrations-panel">
          {isLoadingSettings && (
            <div className="flex items-center gap-2 rounded-xl border border-border-default bg-surface-card/80 p-4 text-sm text-text-secondary">
              <Spinner size="sm" />
              Checking static integrations…
            </div>
          )}

          {(integrationMessage || error) && (
            <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
              error
                ? 'border-status-error/30 bg-status-error/10 text-status-error'
                : 'border-status-success/30 bg-status-success/10 text-status-success'
            }`}>
              {error
                ? <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                : <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
              }
              <span>{error || integrationMessage}</span>
            </div>
          )}

          <div className="rounded-xl border border-border-default bg-surface-card/80 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-display text-sm font-semibold text-text-primary">{t('schedule.discordIntegration')}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {t('schedule.discordSharedSource')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-text-secondary">
                <span className="rounded-full border border-border-subtle bg-surface-elevated px-2.5 py-1">
                  {t('schedule.discordConnectedTo', { server: settings?.discordGuildName ?? settings?.reminderChannelLabel ?? t('common.notConnected') })}
                </span>
                <span className="rounded-full border border-border-subtle bg-surface-elevated px-2.5 py-1">
                  {t('schedule.discordSharedSourceLabel')}
                </span>
              </div>
            </div>
          </div>

          {/* ── Three integration cards ─────────────────────────────────── */}
          <div className="grid gap-5 grid-cols-1 lg:grid-cols-3">

            {/* ── Card 1: Discord Reminders (webhook) ─────────────────── */}
            <div className="flex flex-col rounded-xl border border-border-default bg-surface-card/80 overflow-hidden">
              {/* Card header */}
              <div className="flex items-center gap-3 border-b border-border-subtle px-5 py-4">
                <div className="rounded-lg border border-purple-400/25 bg-purple-400/10 p-2">
                  <Bell className="h-4 w-4 text-purple-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold text-text-primary leading-tight">{t('schedule.discordReminders')}</p>
                  <p className="text-xs text-text-muted mt-0.5">{t('schedule.discordWebhookPings')}</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium shrink-0 ${
                  settings?.webhookConfigured
                    ? 'bg-status-success/15 text-status-success border border-status-success/25'
                    : 'bg-surface-elevated text-text-muted border border-border-subtle'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${settings?.webhookConfigured ? 'bg-status-success' : 'bg-text-muted/50'}`} />
                  {settings?.webhookConfigured ? t('schedule.discordActive') : t('schedule.discordNotSetUp')}
                </span>
              </div>

              {/* Card body */}
              <div className="flex flex-col flex-1 gap-4 p-5">
                {canManage && settings?.webhookLastDeliveryStatus != null && settings.webhookLastDeliveryStatus >= 400 && (
                  <div className="flex items-start gap-2 rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-xs text-status-error">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    <span>
                      Last delivery failed (HTTP {settings.webhookLastDeliveryStatus})
                      {settings.webhookLastDeliveryError ? `: ${settings.webhookLastDeliveryError}` : ''}
                    </span>
                  </div>
                )}

                {canManage ? (
                  <>
                    <div className="space-y-2">
                      {settings?.webhookConfigured && (
                        <p className="rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2 text-xs text-text-muted break-all">
                          {settings.webhookUrlMasked || 'Webhook configured'}
                        </p>
                      )}
                      <Input
                        value={webhookUrl}
                        onChange={setWebhookUrl}
                        type="password"
                        placeholder={settings?.webhookConfigured ? 'Paste new URL to replace' : 'Discord webhook URL'}
                        fullWidth
                        data-testid="schedule-webhook-url-input"
                      />
                      <Input
                        value={channelLabel}
                        onChange={setChannelLabel}
                        placeholder="Channel label (e.g. raid-reminders)"
                        fullWidth
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="block text-xs font-medium uppercase tracking-[0.14em] text-text-muted">
                        {t('schedule.discordPingTarget')}
                      </Label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {([
                          ['none', t('schedule.discordNoPing')],
                          ['here', t('schedule.discordAtHere')],
                          ['role', t('schedule.discordRole')],
                        ] as const).map(([value, label]) => (
                          <Button
                            key={value}
                            type="button"
                            size="sm"
                            variant={mentionTarget === value ? 'accent-subtle' : 'secondary'}
                            onClick={() => { setMentionTarget(value); setMentionError(null); }}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                      {mentionTarget === 'role' && (
                        <div className="space-y-1.5">
                          <Input
                            value={mentionRoleId}
                            onChange={(value) => { setMentionRoleId(value); setMentionError(null); }}
                            placeholder="Role ID or <@&ROLE_ID>"
                            fullWidth
                            data-testid="schedule-webhook-role-id-input"
                          />
                          {normalizeDiscordRoleId(mentionRoleId) && (
                            <p className="text-xs text-text-secondary">
                              Preview: <code className="rounded bg-surface-sunken px-1.5 py-0.5">{`<@&${normalizeDiscordRoleId(mentionRoleId)}>`}</code>
                            </p>
                          )}
                        </div>
                      )}
                      {mentionError && <p className="text-xs text-status-error">{mentionError}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="block text-xs font-medium uppercase tracking-[0.14em] text-text-muted">
                        {t('schedule.discordSendReminders')}
                      </Label>
                      <p className="text-[11px] text-text-muted">
                        {t('schedule.discordRecommendedDefaults')}
                      </p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                        <Checkbox checked={enableAtStart} onChange={setEnableAtStart} label={t('schedule.discordAtStart')} />
                        <Checkbox checked={enable15m} onChange={setEnable15m} label={t('schedule.discord15MinBefore')} />
                        <Checkbox checked={enable1h} onChange={setEnable1h} label={t('schedule.discord1HrBefore')} />
                        <Checkbox checked={enable6h} onChange={setEnable6h} label={t('schedule.discord6HrsBefore')} />
                        <Checkbox checked={enable12h} onChange={setEnable12h} label={t('schedule.discord12HrsBefore')} />
                        <Checkbox checked={enable24h} onChange={setEnable24h} label={t('schedule.discord24HrsBefore')} />
                        <Checkbox checked={enableMissingRsvp} onChange={setEnableMissingRsvp} label={t('schedule.discordMissingRsvp')} />
                      </div>
                    </div>

                    <div className="mt-auto flex flex-wrap gap-2 pt-1">
                      <Button type="button" size="sm" onClick={() => void handleSaveIntegrations()}>
                        {t('common.save')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => void sendTestReminder(groupId).then(() => setIntegrationMessage('Test reminder sent!'))}
                        disabled={!settings?.webhookConfigured && !webhookUrl}
                      >
                        {t('schedule.discordSendTest')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        leftIcon={<Send className="h-3.5 w-3.5" />}
                        onClick={() => {
                          if (postingPreview) return;
                          setPostingPreview(true);
                          void postSessionPreview(groupId)
                            .then(() => setIntegrationMessage('Session posted to Discord.'))
                            .finally(() => setPostingPreview(false));
                        }}
                        disabled={!settings?.webhookConfigured || sessions.length === 0 || postingPreview}
                        title={sessions.length === 0 ? 'No upcoming sessions to post' : 'Post the next session to Discord'}
                      >
                        {postingPreview ? t('schedule.discordPosting') : t('schedule.discordPostSession')}
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-text-muted">
                    {t('schedule.discordOnlyLeadsOwners')}
                  </p>
                )}
              </div>
            </div>

            {/* ── Card 2: Discord Guild Events (official bot) ─────────── */}
            {(() => {
              const linkStatus = settings?.discordLinkStatus;
              // Legacy path: old per-static bot token still works for sync
              const isLegacy = !linkStatus && Boolean(settings?.discordBotConfigured) && Boolean(settings?.discordGuildId);
              const isConnected = linkStatus === 'connected' || linkStatus === 'permission_missing' || isLegacy;
              const isPending = !isConnected && discordClaimCode !== null;

              let statusBadge;
              if (isConnected && linkStatus === 'permission_missing') {
                statusBadge = (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-status-warning/30 bg-status-warning/15 px-2.5 py-1 text-[11px] font-medium text-status-warning shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-status-warning" />
                    {t('schedule.discordNeedsPermission')}
                  </span>
                );
              } else if (isConnected && isLegacy) {
                statusBadge = (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-status-success/25 bg-status-success/15 px-2.5 py-1 text-[11px] font-medium text-status-success shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-status-success" />
                    {t('schedule.discordActive')}
                  </span>
                );
              } else if (isConnected) {
                statusBadge = (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-status-success/25 bg-status-success/15 px-2.5 py-1 text-[11px] font-medium text-status-success shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-status-success" />
                    {t('schedule.discordConnected')}
                  </span>
                );
              } else if (isPending) {
                statusBadge = (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-status-info/25 bg-status-info/15 px-2.5 py-1 text-[11px] font-medium text-status-info shrink-0">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-status-info" />
                    {t('schedule.discordPending')}
                  </span>
                );
              } else {
                statusBadge = (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-elevated px-2.5 py-1 text-[11px] font-medium text-text-muted shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-text-muted/50" />
                    {t('schedule.discordNotConnected')}
                  </span>
                );
              }

              return (
                <div className="flex flex-col rounded-xl border border-border-default bg-surface-card/80 overflow-hidden">
                  {/* Card header */}
                  <div className="flex items-center gap-3 border-b border-border-subtle px-5 py-4">
                    <div className="rounded-lg border border-blue-400/25 bg-blue-400/10 p-2">
                      <CalendarDays className="h-4 w-4 text-blue-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-display font-semibold text-text-primary leading-tight">{t('schedule.discordGuildEvents')}</p>
                      <p className="text-xs text-text-muted mt-0.5">{t('schedule.discordNativeEvents')}</p>
                    </div>
                    {statusBadge}
                  </div>

                  {/* Card body */}
                  <div className="flex flex-col flex-1 gap-4 p-5">
                    {!canManage ? (
                      <p className="text-xs text-text-muted">
                        {t('schedule.discordOnlyLeadsOwnersEvents')}
                      </p>
                    ) : isConnected ? (
                      /* ── Connected state ─────────────────────────── */
                      <>
                        <div className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2.5">
                          <CheckCircle className="h-4 w-4 shrink-0 text-status-success" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-text-primary truncate">
                              {settings?.discordGuildName ?? (isLegacy ? `Guild ${settings?.discordGuildId}` : 'Discord Server')}
                            </p>
                            {isLegacy && (
                              <p className="mt-0.5 text-[11px] text-text-muted">
                                Using legacy bot token —{' '}
                                <Button
                                  type="button"
                                  variant="link"
                                  onClick={() => void handleConnectDiscord()}
                                  className="align-baseline text-[11px] font-normal text-text-muted hover:text-text-secondary"
                                >
                                  upgrade to official bot
                                </Button>
                              </p>
                            )}
                            {linkStatus === 'permission_missing' && (
                              <p className="mt-0.5 text-[11px] text-status-warning">
                                Missing <code className="rounded bg-surface-sunken px-1 py-0.5">Manage Events</code> permission
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2">
                            <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">{t('schedule.discordRollingWindow')}</p>
                            <p className="mt-1 font-medium text-text-primary">{t('schedule.discordNextFourWeeks')}</p>
                          </div>
                          <div className="rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2">
                            <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">{t('schedule.discordMirrorStatus')}</p>
                            <p className="mt-1 font-medium text-text-primary">
                              {loadingMirrorStatus
                                ? t('common.checking')
                                : `${discordMirrorSummary.synced} ${t('schedule.discordSynced')}${discordMirrorSummary.failed ? ` / ${discordMirrorSummary.failed} ${t('schedule.discordFailed')}` : ''}${discordMirrorSummary.pending ? ` / ${discordMirrorSummary.pending} ${t('common.pending')}` : ''}`}
                            </p>
                          </div>
                          <div className="rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2">
                            <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">{t('schedule.discordLastSync')}</p>
                            <p className="mt-1 font-medium text-text-primary">
                              {discordMirrorSummary.lastSyncedAt
                                ? new Date(discordMirrorSummary.lastSyncedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
                                : t('schedule.discordNotSyncedYet')}
                            </p>
                          </div>
                          <div className="rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2">
                            <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">{t('schedule.discordRetry')}</p>
                            <p className="mt-1 font-medium text-text-primary">
                              {discordMirrorSummary.failed ? 'Sync failed rows' : t('schedule.discordSyncAll')}
                            </p>
                          </div>
                        </div>

                        {discordMirrorSummary.latestError && (
                          <div className="flex items-start gap-2 rounded-lg border border-status-error/30 bg-status-error/10 px-3 py-2 text-xs text-status-error">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                            <span>{t('schedule.discordLastEventSyncError', { error: discordMirrorSummary.latestError })}</span>
                          </div>
                        )}

                        {linkStatus === 'permission_missing' ? (
                          /* ── Permission fix instructions ─────────────── */
                          <div className="rounded-lg border border-status-warning/30 bg-status-warning/8 px-3 py-2.5 space-y-2">
                            <p className="text-xs font-medium text-status-warning">{t('schedule.discordFixOneOfTwoWays')}</p>
                            <ol className="space-y-1.5 text-[11px] text-text-muted list-decimal list-inside">
                              <li>
                                <span className="font-medium text-text-secondary">{t('schedule.discordReinviteBot')}</span>{' '}
                                — {t('schedule.discordReinviteBotDesc')}
                              </li>
                              <li>
                                <span className="font-medium text-text-secondary">{t('schedule.discordGrantManually')}</span>{' '}
                                — {t('schedule.discordGrantManuallyDesc')}
                              </li>
                            </ol>
                            <div className="flex flex-wrap gap-2 pt-0.5">
                              <Button
                                type="button"
                                size="sm"
                                leftIcon={<ExternalLink className="h-3 w-3" />}
                                onClick={() => window.open(buildDiscordInstallUrl(settings?.discordClientId), '_blank', 'noopener,noreferrer')}
                                disabled={!settings?.discordClientId}
                              >
                                {t('schedule.discordReinviteBotButton')}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                leftIcon={<CheckCircle className={`h-3 w-3 ${discordCheckLoading ? 'animate-pulse' : ''}`} />}
                                onClick={() => void handleRefreshLink()}
                                disabled={discordCheckLoading}
                              >
                                {discordCheckLoading ? t('schedule.discordChecking') : t('schedule.discordCheckNow')}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-text-muted leading-relaxed">
                            {t('schedule.discordUpcomingOccurrences')}
                          </p>
                        )}

                        <div className="mt-auto flex flex-wrap gap-2 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${syncingDiscord ? 'animate-spin' : ''}`} />}
                            onClick={() => void handleSyncAllDiscord()}
                            disabled={syncingDiscord}
                          >
                            {syncingDiscord ? t('schedule.discordSyncing') : t('schedule.discordSyncNow')}
                          </Button>
                          {!isLegacy && (
                            <Button
                              type="button"
                              size="sm"
                              variant="danger"
                              leftIcon={<Unlink className="h-3.5 w-3.5" />}
                              onClick={() => void handleDisconnectDiscord()}
                            >
                              {t('schedule.discordDisconnect')}
                            </Button>
                          )}
                        </div>
                      </>
                    ) : isPending ? (
                      /* ── Pending / claim code state ──────────────── */
                      <>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-text-secondary">{t('schedule.discordYourLinkCode')}</p>
                          <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-sunken px-3 py-2">
                            <code className="flex-1 font-mono text-sm font-semibold tracking-widest text-accent">
                              {discordClaimCode}
                            </code>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              leftIcon={<Copy className="h-3 w-3" />}
                              onClick={() => void navigator.clipboard.writeText(discordClaimCode ?? '').then(() => setIntegrationMessage('Copied!'))}
                            >
                              Copy
                            </Button>
                          </div>
                          {discordClaimExpiry && (
                            <p className="text-[11px] text-text-muted">
                              {t('schedule.discordExpires', { time: new Date(discordClaimExpiry).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}
                            </p>
                          )}
                        </div>

                        <ol className="space-y-2 text-xs text-text-muted">
                          <li className="flex items-start gap-2">
                            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface-elevated text-[10px] font-semibold text-text-secondary">1</span>
                            <span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                rightIcon={<ExternalLink className="h-3 w-3" />}
                                onClick={() => window.open(buildDiscordInstallUrl(settings?.discordClientId), '_blank', 'noopener,noreferrer')}
                                disabled={!settings?.discordClientId}
                                className="inline-flex"
                              >
                                {t('schedule.discordInviteBot')}
                              </Button>{' '}
                              {t('schedule.discordToYourServer')}
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface-elevated text-[10px] font-semibold text-text-secondary">2</span>
                            <span>
                              {t('schedule.discordRunInChannel', { code: `/xrp link ${discordClaimCode}` })}
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface-elevated text-[10px] font-semibold text-text-secondary">3</span>
                            <span>{t('schedule.discordReturnAndClick')}</span>
                          </li>
                        </ol>

                        <div className="mt-auto flex flex-wrap gap-2 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            leftIcon={<CheckCircle className={`h-3.5 w-3.5 ${discordCheckLoading ? 'animate-pulse' : ''}`} />}
                            onClick={() => void handleRefreshLink()}
                            disabled={discordCheckLoading}
                          >
                            {discordCheckLoading ? t('schedule.discordChecking') : t('schedule.discordCheckNow')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => { setDiscordClaimCode(null); setDiscordClaimExpiry(null); }}
                          >
                            {t('common.cancel')}
                          </Button>
                        </div>
                      </>
                    ) : (
                      /* ── Disconnected state ──────────────────────── */
                      <>
                        <p className="text-xs text-text-muted leading-relaxed">
                          {t('schedule.discordConnectBotDesc')}
                        </p>

                        <div className="rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2.5 text-xs text-text-muted space-y-1">
                          <p className="font-medium text-text-secondary">{t('schedule.discordWhatYouGet')}</p>
                          <ul className="space-y-0.5 list-disc list-inside">
                            <li>{t('schedule.discordSessionsInEventsTab')}</li>
                            <li>{t('schedule.discordMembersCanRsvp')}</li>
                            <li>{t('schedule.discordAutoSync')}</li>
                          </ul>
                        </div>

                        <p className="text-[11px] text-text-muted">
                          {t('schedule.discordRequiresPermission')}
                        </p>

                        <div className="mt-auto pt-1">
                          {settings?.discordOfficialBotAvailable === false ? (
                            <p className="text-[11px] text-text-muted">
                              {t('schedule.discordNotConfigured')}
                            </p>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              leftIcon={discordClaimLoading ? <Spinner size="sm" /> : <ExternalLink className="h-3.5 w-3.5" />}
                              onClick={() => void handleConnectDiscord()}
                              disabled={discordClaimLoading}
                            >
                              {discordClaimLoading ? t('schedule.discordStarting') : t('schedule.discordConnect')}
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── Card 3: Private iCal feed ────────────────────────────── */}
            <div className="flex flex-col rounded-xl border border-border-default bg-surface-card/80 overflow-hidden">
              {/* Card header */}
              <div className="flex items-center gap-3 border-b border-border-subtle px-5 py-4">
                <div className="rounded-lg border border-accent/25 bg-accent/10 p-2">
                  <CalendarClock className="h-4 w-4 text-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold text-text-primary leading-tight">{t('schedule.calendarFeed')}</p>
                  <p className="text-xs text-text-muted mt-0.5">{t('schedule.calendarSubscribeVia')}</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium shrink-0 ${
                  settings?.calendarUrl
                    ? 'bg-status-success/15 text-status-success border border-status-success/25'
                    : 'bg-surface-elevated text-text-muted border border-border-subtle'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${settings?.calendarUrl ? 'bg-status-success' : 'bg-text-muted/50'}`} />
                  {settings?.calendarUrl ? 'Active' : 'Not enabled'}
                </span>
              </div>

              {/* Card body */}
              <div className="flex flex-col flex-1 gap-4 p-5">
                {settings?.calendarUrl ? (
                  <div className="rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2.5">
                    <p className="break-all text-xs text-text-secondary leading-relaxed">{settings.calendarUrl}</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2.5 text-xs text-text-muted">
                    {t('schedule.calendarGenerateFeedLink')}
                  </div>
                )}

                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    leftIcon={<Copy className="h-3.5 w-3.5" />}
                    onClick={() => void handleCopyCalendarUrl()}
                    disabled={!settings?.calendarUrl}
                  >
                    {integrationMessage === 'Copied!' ? t('schedule.calendarCopied') : t('schedule.calendarCopyUrl')}
                  </Button>
                  {settings?.calendarUrl && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      leftIcon={<Calendar className="h-3.5 w-3.5" />}
                      onClick={() => window.open(`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(settings.calendarUrl || '')}`, '_blank', 'noopener,noreferrer')}
                    >
                      {t('schedule.calendarAddToGoogle')}
                    </Button>
                  )}
                  {canManage && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                        onClick={() => void regenerateCalendar(groupId)}
                      >
                        {t('schedule.calendarRegenerate')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                        onClick={() => void revokeCalendar(groupId)}
                        disabled={!settings?.calendarEnabled}
                      >
                        {t('schedule.calendarRevoke')}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Privacy footer note ─────────────────────────────────────── */}
          <div className="rounded-xl border border-border-subtle bg-surface-elevated/60 px-4 py-3 text-xs text-text-muted">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-text-secondary flex-shrink-0" />
              <p>
                {t('schedule.integrationSecrets')}
              </p>
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
        discordDeliverySummary={discordDeliverySummary}
      />

      {editSession && (
        <CreateSessionModal
          isOpen={true}
          onClose={() => setEditSession(null)}
          onSubmit={handleUpdate}
          editSession={editSession}
          discordDeliverySummary={discordDeliverySummary}
        />
      )}
    </div>
  );
}
