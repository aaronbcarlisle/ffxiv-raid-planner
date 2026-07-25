import { useEffect, useMemo, useRef, useState } from 'react';
import { useUrlTabState } from '../../hooks/useUrlTabState';
import { Calendar, CalendarClock, LayoutGrid, List, Link2, Plus, Sparkles } from 'lucide-react';
import { useScheduleStore } from '../../stores/scheduleStore';
import { useAuthStore } from '../../stores/authStore';
import { canManageRoster } from '../../utils/permissions';
import { useModal } from '../../hooks/useModal';
import { useEventBus, Events } from '../../lib/eventBus';
import { Button } from '../primitives';
import { Spinner } from '../ui';
import { SessionCard } from './SessionCard';
import { CreateSessionModal } from './CreateSessionModal';
import { AvailabilityGrid } from './AvailabilityGrid';
import { ScheduleIntegrationsPanel } from './ScheduleIntegrationsPanel';
import type { DiscordMirrorStatus, ScheduleSession, ScheduleSessionCreate, RsvpStatus, MemberRole, Membership } from '../../types';
import { buildScheduleDraftFromContent, type ScheduleContentDraftRequest } from './sessionDrafts';

const SCHED_SUB_TABS = ['sessions', 'availability', 'integrations'] as const;
type SchedulerSubTab = (typeof SCHED_SUB_TABS)[number];

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
    fetchSessions,
    fetchSettings,
    createSession,
    updateSession,
    deleteSession,
    submitRsvp,
    fetchDiscordMirrors,
    clearSessions,
  } = useScheduleStore();
  const createModal = useModal();
  const [editSession, setEditSession] = useState<ScheduleSession | null>(null);
  const [createDraft, setCreateDraft] = useState<ScheduleSessionCreate | null>(null);
  const [highlightedSessionId, setHighlightedSessionId] = useState<string | null>(null);
  // Discord-mirror status still feeds the per-session delivery badges in the
  // Sessions sub-tab (via `sessionDeliveryStatus`). The Integrations UI itself
  // moved to `ScheduleIntegrationsPanel`, which owns its own copy of this poll.
  const [discordMirrors, setDiscordMirrors] = useState<DiscordMirrorStatus[]>([]);
  const [sessionViewMode, setSessionViewMode] = useState<'list' | 'tiles'>(() => {
    const saved = localStorage.getItem('schedule-session-view');
    return saved === 'tiles' ? 'tiles' : 'list';
  });
  // Sub-tab in the URL (?stab=sessions|availability|integrations) — deep-linkable,
  // reload-safe, back/forward-aware. Replaces the old per-group sessionStorage key.
  const [activeSubTab, setActiveSubTab] = useUrlTabState('stab', SCHED_SUB_TABS, 'sessions');

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
  }, [sessions, setActiveSubTab]);

  // Discord-mirror poll retained here (trimmed of the Integrations-only loading
  // flag) because `sessionDeliveryStatus` — which drives the Sessions sub-tab's
  // per-session delivery badges — reads `discordMirrors`. The Integrations panel
  // keeps its own copy for the mirror-status summary. Gate is a MEMBERSHIP check
  // (`!userRole`), not a manager check.
  useEffect(() => {
    if (!userRole || sessions.length === 0) {
      setDiscordMirrors([]);
      return;
    }

    let cancelled = false;
    Promise.all(
      sessions.map((session) =>
        fetchDiscordMirrors(groupId, session.id).catch(() => [] as DiscordMirrorStatus[])
      )
    )
      .then((rows) => {
        if (!cancelled) {
          setDiscordMirrors(rows.flat());
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
        <ScheduleIntegrationsPanel groupId={groupId} canManage={canManage} userRole={userRole} />
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
