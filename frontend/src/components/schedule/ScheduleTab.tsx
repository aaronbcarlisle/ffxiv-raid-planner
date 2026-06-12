import { useEffect, useMemo, useState } from 'react';
import { Bell, Calendar, CalendarClock, Copy, LayoutGrid, List, Link2, Plus, RotateCcw, Send, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
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
import type { ScheduleSession, ScheduleSessionCreate, RsvpStatus, MemberRole, Membership } from '../../types';
import { buildScheduleDraftFromContent, type ScheduleContentDraftRequest } from './sessionDrafts';

type SchedulerSubTab = 'sessions' | 'availability' | 'integrations';
type WebhookMentionTarget = 'none' | 'here' | 'role';

const DISCORD_ROLE_ID_PATTERN = /^(?:<@&)?(\d{17,20})>?$/;

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
    void fetchSessions(groupId).catch(() => undefined);
    void fetchSettings(groupId).catch(() => undefined);
    return () => {
      clearSessions();
    };
  }, [groupId, fetchSessions, fetchSettings, clearSessions]);

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
  }, [settings]);

  useEffect(() => {
    const saved = sessionStorage.getItem(`schedule-subtab-${groupId}`);
    if (saved === 'availability' || saved === 'integrations' || saved === 'sessions') {
      setActiveSubTab(saved);
    } else {
      setActiveSubTab('sessions');
    }
  }, [groupId]);

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get('sessionId');
    if (!sessionId || !sessions.some((session) => session.id === sessionId)) return;

    setActiveSubTab('sessions');
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
              <p className="text-lg">No raid sessions yet.</p>
              {canManage && (
                <p className="mt-1 text-sm">Create your first raid night and choose whether availability needs to be tracked.</p>
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
                    aria-label="Tile view"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  {/* design-system-ignore: View toggle requires specific styling */}
                  <button
                    onClick={() => { setSessionViewMode('list'); localStorage.setItem('schedule-session-view', 'list'); }}
                    className={`p-1.5 rounded-md transition-colors ${sessionViewMode === 'list' ? 'bg-accent/20 text-accent' : 'text-text-tertiary hover:text-text-primary'}`}
                    aria-label="List view"
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
        <div className="space-y-4" data-testid="schedule-integrations-panel">
          {isLoadingSettings && (
            <div className="flex items-center gap-2 rounded-xl border border-border-default bg-surface-card/80 p-4 text-sm text-text-secondary">
              <Spinner size="sm" />
              Checking static integrations...
            </div>
          )}
          {(integrationMessage || error) && (
            <div className={`rounded-xl border p-3 text-sm ${
              error
                ? 'border-status-error/30 bg-status-error/10 text-status-error'
                : 'border-status-success/30 bg-status-success/10 text-status-success'
            }`}>
              {error || integrationMessage}
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border-default bg-surface-card/80 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-lg border border-accent/20 bg-accent/10 p-2 text-accent">
                  <Bell className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg text-text-primary">Discord reminders</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Keep the static notified before raid night.
                  </p>
                  <div className="mt-3 inline-flex rounded-full border border-border-subtle bg-surface-elevated px-3 py-1 text-xs text-text-secondary">
                    {settings?.webhookConfigured ? 'Webhook saved' : 'Not configured'}
                  </div>
                  {canManage ? (
                    <div className="mt-4 space-y-3">
                      {settings?.webhookConfigured && (
                        <p className="rounded-lg border border-border-subtle bg-surface-elevated p-3 text-xs text-text-muted break-all">
                          Current webhook: {settings.webhookUrlMasked || 'Configured'}
                        </p>
                      )}
                      <Input
                        value={webhookUrl}
                        onChange={setWebhookUrl}
                        type="password"
                        placeholder={settings?.webhookConfigured ? 'Paste a new webhook URL to replace it' : 'Discord webhook URL'}
                        fullWidth
                        data-testid="schedule-webhook-url-input"
                      />
                      <Input
                        value={channelLabel}
                        onChange={setChannelLabel}
                        placeholder="Channel label, e.g. raid-reminders"
                        fullWidth
                      />
                      <div className="space-y-2">
                        <Label className="block text-xs font-medium uppercase tracking-[0.14em] text-text-muted">
                          Mention target
                        </Label>
                        <div className="grid grid-cols-3 gap-2">
                          {([
                            ['none', 'No ping'],
                            ['here', '@here'],
                            ['role', 'Role'],
                          ] as const).map(([value, label]) => (
                            <Button
                              key={value}
                              type="button"
                              size="sm"
                              variant={mentionTarget === value ? 'accent-subtle' : 'secondary'}
                              onClick={() => {
                                setMentionTarget(value);
                                setMentionError(null);
                              }}
                            >
                              {label}
                            </Button>
                          ))}
                        </div>
                        {mentionTarget === 'role' && (
                          <div className="space-y-2">
                            <Input
                              value={mentionRoleId}
                              onChange={(value) => {
                                setMentionRoleId(value);
                                setMentionError(null);
                              }}
                              placeholder="Discord role ID or <@&ROLE_ID>"
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
                        <p className="text-xs text-text-muted">
                          Use this to notify the raid channel when sessions are posted or reminders fire. Only enable pings for channels where your static expects them.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Checkbox checked={enableAtStart} onChange={setEnableAtStart} label="At start" />
                        <Checkbox checked={enable15m} onChange={setEnable15m} label="15 minutes before" />
                        <Checkbox checked={enable1h} onChange={setEnable1h} label="1 hour before" />
                        <Checkbox checked={enable6h} onChange={setEnable6h} label="6 hours before" />
                        <Checkbox checked={enable12h} onChange={setEnable12h} label="12 hours before" />
                        <Checkbox checked={enable24h} onChange={setEnable24h} label="24 hours before" />
                        <Checkbox checked={enableMissingRsvp} onChange={setEnableMissingRsvp} label="Missing RSVP reminder" />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" onClick={() => void handleSaveIntegrations()}>
                          Save reminders
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => void sendTestReminder(groupId).then(() => setIntegrationMessage('Test sent'))}
                          disabled={!settings?.webhookConfigured && !webhookUrl}
                        >
                          {integrationMessage === 'Test sent' ? 'Test sent' : 'Send test'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          leftIcon={<Send className="h-4 w-4" />}
                          onClick={() => {
                            if (postingPreview) return;
                            setPostingPreview(true);
                            void postSessionPreview(groupId)
                              .then(() => setIntegrationMessage('Session posted to Discord'))
                              .finally(() => setPostingPreview(false));
                          }}
                          disabled={!settings?.webhookConfigured || sessions.length === 0 || postingPreview}
                          title={sessions.length === 0 ? 'No upcoming sessions to post' : 'Post the next upcoming session to Discord'}
                        >
                          {postingPreview ? 'Posting…' : 'Post latest session'}
                        </Button>
                      </div>
                      <p className="text-xs text-text-muted">
                        Webhook posts planner announcements. Discord reactions and buttons require a future bot integration.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-lg border border-border-subtle bg-surface-elevated p-3 text-xs text-text-muted">
                      Only Leads and Owners can manage integrations. Members and viewers never see the webhook URL.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border-default bg-surface-card/80 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-lg border border-accent/20 bg-accent/10 p-2 text-accent">
                  <CalendarClock className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg text-text-primary">Private calendar feed</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Let members subscribe from Google Calendar, Apple Calendar, or Outlook.
                  </p>
                  <div className="mt-3 inline-flex rounded-full border border-border-subtle bg-surface-elevated px-3 py-1 text-xs text-text-secondary">
                    {settings?.calendarUrl ? 'Token active' : 'Not configured'}
                  </div>
                  <div className="mt-4 space-y-3">
                    {settings?.calendarUrl ? (
                      <div className="rounded-lg border border-border-subtle bg-surface-elevated p-3">
                        <p className="break-all text-xs text-text-secondary">{settings.calendarUrl}</p>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-border-subtle bg-surface-elevated p-3 text-xs text-text-muted">
                        Calendar link is not enabled yet.
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        leftIcon={<Copy className="h-4 w-4" />}
                        onClick={() => void handleCopyCalendarUrl()}
                        disabled={!settings?.calendarUrl}
                      >
                        {integrationMessage === 'Copied!' ? 'Copied!' : 'Copy iCal URL'}
                      </Button>
                      {settings?.calendarUrl && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          leftIcon={<Calendar className="h-4 w-4" />}
                          onClick={() => window.open(`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(settings.calendarUrl || '')}`, '_blank', 'noopener,noreferrer')}
                        >
                          Add to Google
                        </Button>
                      )}
                      {canManage && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            leftIcon={<RotateCcw className="h-4 w-4" />}
                            onClick={() => void regenerateCalendar(groupId)}
                          >
                            Regenerate
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            leftIcon={<Trash2 className="h-4 w-4" />}
                            onClick={() => void revokeCalendar(groupId)}
                            disabled={!settings?.calendarEnabled}
                          >
                            Revoke
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-status-info/30 bg-status-info/10 p-4 text-sm text-text-secondary">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-status-info" />
              <div className="space-y-1">
                <p className="font-medium text-text-primary">Private integration data is permission-checked.</p>
                <p>
                  Webhook URLs are never shown to members or viewers. Calendar links are private tokens that Owner/Lead
                  can regenerate or revoke when needed.
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
