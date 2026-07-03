/**
 * @vitest-environment jsdom
 *
 * Characterization tests for `ScheduleIntegrationsPanel` — the Discord/calendar
 * integrations block extracted verbatim from `ScheduleTab`. These pin the
 * load-bearing anatomy of the panel so the promote-and-repoint (and the later
 * legacy deletion) can't silently regress it. The block is too large to
 * snapshot, so we assert the contract: settings reflection, the assembled save
 * payload, the action wiring (test reminder / calendar / Discord connect), the
 * standalone mount-fetch, the manager gate, and the `!userRole` membership gate
 * on the Discord-mirror poll.
 *
 * Convention (matches Schedule.test.tsx): drive via `fireEvent`, stub every
 * store fetch action so mount effects never fall through to the real api client.
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScheduleIntegrationsPanel } from './ScheduleIntegrationsPanel';
import { useScheduleStore } from '../../stores/scheduleStore';
import type { ScheduleSettings, ScheduleSession } from '../../types';

function makeSettings(overrides: Partial<ScheduleSettings> = {}): ScheduleSettings {
  return {
    staticGroupId: 'g1',
    webhookConfigured: false,
    mentionTarget: 'none',
    enable24hReminder: false,
    enable1hReminder: false,
    enableMissingRsvpReminder: false,
    calendarEnabled: false,
    canManage: true,
    ...overrides,
  };
}

function makeSession(overrides: Partial<ScheduleSession> = {}): ScheduleSession {
  return {
    id: 's1',
    staticGroupId: 'g1',
    createdById: 'u1',
    title: 'Session',
    description: null,
    startTime: '2026-07-01T20:00:00Z',
    endTime: '2026-07-01T22:00:00Z',
    timezone: 'UTC',
    isRecurring: false,
    recurrenceRule: null,
    trackAvailability: true,
    category: null,
    contentId: null,
    contentName: null,
    bannerUrl: null,
    createdAt: '',
    updatedAt: '',
    rsvps: [],
    ...overrides,
  };
}

function seedStore(over: Record<string, unknown> = {}) {
  useScheduleStore.setState({
    sessions: [],
    settings: makeSettings(),
    isLoadingSettings: false,
    error: null,
    fetchSettings: vi.fn(async () => {}),
    fetchSessions: vi.fn(async () => {}),
    updateSettings: vi.fn(async () => {}),
    sendTestReminder: vi.fn(async () => {}),
    postSessionPreview: vi.fn(async () => {}),
    regenerateCalendar: vi.fn(async () => {}),
    revokeCalendar: vi.fn(async () => {}),
    syncAllDiscordMirrors: vi.fn(async () => []),
    fetchDiscordMirrors: vi.fn(async () => []),
    createDiscordInstallClaim: vi.fn(async () => ({ claimCode: 'ABC123', expiresAt: '2026-07-01T21:00:00Z' })),
    fetchDiscordLink: vi.fn(async () => null),
    disconnectDiscordLink: vi.fn(async () => {}),
    ...over,
  } as never);
}

beforeEach(() => {
  seedStore();
});

describe('ScheduleIntegrationsPanel', () => {
  it('reflects saved settings in the webhook card', () => {
    seedStore({
      settings: makeSettings({
        webhookConfigured: true,
        webhookUrlMasked: 'https://discord.com/api/webhooks/***masked***',
        reminderChannelLabel: 'raid-reminders',
        enable24hReminder: true,
      }),
    });
    render(<ScheduleIntegrationsPanel groupId="g1" canManage userRole="owner" />);
    expect(screen.getByTestId('schedule-integrations-panel')).toBeInTheDocument();
    // Masked webhook (never the raw URL) surfaces read-only.
    expect(screen.getByText('https://discord.com/api/webhooks/***masked***')).toBeInTheDocument();
    // The channel-label input hydrates from settings via the settings-sync effect.
    expect(screen.getByPlaceholderText('Channel label (e.g. raid-reminders)')).toHaveValue('raid-reminders');
  });

  it('save calls updateSettings with the assembled payload', async () => {
    const updateSettings = vi.fn(async () => {});
    seedStore({
      settings: makeSettings({
        reminderChannelLabel: 'raid',
        enable24hReminder: true,
        enable1hReminder: true,
        enableMissingRsvpReminder: true,
      }),
      updateSettings,
    });
    render(<ScheduleIntegrationsPanel groupId="g1" canManage userRole="owner" />);
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1));
    // Pin the full assembled shape (not a subset) so a regression that drops
    // or mis-derives any field — webhookUrl/mentionRoleId included — is caught.
    expect(updateSettings).toHaveBeenCalledWith('g1', {
      webhookUrl: undefined,
      reminderChannelLabel: 'raid',
      mentionTarget: 'none',
      mentionRoleId: null,
      enableAtStartReminder: false,
      enable15mReminder: false,
      enable24hReminder: true,
      enable1hReminder: true,
      enable6hReminder: false,
      enable12hReminder: false,
      enableMissingRsvpReminder: true,
    });
  });

  it('does not save and sets a mention error when mentionTarget is role with an invalid role ID', async () => {
    const updateSettings = vi.fn(async () => {});
    seedStore({ settings: makeSettings(), updateSettings });
    render(<ScheduleIntegrationsPanel groupId="g1" canManage userRole="owner" />);
    fireEvent.click(screen.getByText('Role'));
    fireEvent.change(screen.getByTestId('schedule-webhook-role-id-input'), {
      target: { value: 'not-a-role-id' },
    });
    fireEvent.click(screen.getByText('Save'));
    expect(await screen.findByText('Enter a valid Discord role ID or <@&ROLE_ID> mention.')).toBeInTheDocument();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('send test calls sendTestReminder', async () => {
    const sendTestReminder = vi.fn(async () => {});
    seedStore({ settings: makeSettings({ webhookConfigured: true }), sendTestReminder });
    render(<ScheduleIntegrationsPanel groupId="g1" canManage userRole="owner" />);
    fireEvent.click(screen.getByText('Send test'));
    await waitFor(() => expect(sendTestReminder).toHaveBeenCalledWith('g1'));
  });

  it('regenerate calls regenerateCalendar', () => {
    const regenerateCalendar = vi.fn(async () => {});
    seedStore({
      settings: makeSettings({ calendarUrl: 'https://x/cal.ics', calendarEnabled: true }),
      regenerateCalendar,
    });
    render(<ScheduleIntegrationsPanel groupId="g1" canManage userRole="owner" />);
    fireEvent.click(screen.getByText('Regenerate'));
    expect(regenerateCalendar).toHaveBeenCalledWith('g1');
  });

  it('revoke calls revokeCalendar', () => {
    const revokeCalendar = vi.fn(async () => {});
    seedStore({
      settings: makeSettings({ calendarUrl: 'https://x/cal.ics', calendarEnabled: true }),
      revokeCalendar,
    });
    render(<ScheduleIntegrationsPanel groupId="g1" canManage userRole="owner" />);
    fireEvent.click(screen.getByText('Revoke'));
    expect(revokeCalendar).toHaveBeenCalledWith('g1');
  });

  it('connect Discord calls createDiscordInstallClaim', async () => {
    const createDiscordInstallClaim = vi.fn(async () => ({ claimCode: 'ABC123', expiresAt: '2026-07-01T21:00:00Z' }));
    seedStore({ settings: makeSettings({ discordOfficialBotAvailable: true }), createDiscordInstallClaim });
    render(<ScheduleIntegrationsPanel groupId="g1" canManage userRole="owner" />);
    fireEvent.click(screen.getByText('Connect Discord'));
    await waitFor(() => expect(createDiscordInstallClaim).toHaveBeenCalledWith('g1'));
  });

  it('fetches settings on mount when they are absent (works standalone from Settings)', async () => {
    const fetchSettings = vi.fn(async () => {});
    seedStore({ settings: null, fetchSettings });
    render(<ScheduleIntegrationsPanel groupId="g1" canManage userRole="owner" />);
    await waitFor(() => expect(fetchSettings).toHaveBeenCalledWith('g1'));
  });

  it('does not refetch settings on mount when they are already loaded for the same static', () => {
    const fetchSettings = vi.fn(async () => {});
    seedStore({ settings: makeSettings({ staticGroupId: 'g1' }), fetchSettings });
    render(<ScheduleIntegrationsPanel groupId="g1" canManage userRole="owner" />);
    expect(fetchSettings).not.toHaveBeenCalled();
  });

  it('refetches settings when the loaded settings belong to a different static (cross-static stale guard)', async () => {
    // Regression for: scheduleStore.settings persists across static switches
    // (v2 Schedule never clears it). A manager who previously opened static
    // A's Integrations, then switches to static B, must not see A's stale
    // settings reused for B — the mismatch must trigger a refetch.
    const fetchSettings = vi.fn(async () => {});
    seedStore({ settings: makeSettings({ staticGroupId: 'other-static' }), fetchSettings });
    render(<ScheduleIntegrationsPanel groupId="g1" canManage userRole="owner" />);
    await waitFor(() => expect(fetchSettings).toHaveBeenCalledWith('g1'));
  });

  it('does not fetch settings on mount for a role-less viewer (no 403 error-toast loop)', () => {
    // Regression for legacy ScheduleTab's `if (userRole)` guard — a share-code
    // viewer with no role must never trigger a settings fetch (403 -> error
    // toast -> re-fires on every remount).
    const fetchSettings = vi.fn(async () => {});
    seedStore({ settings: null, fetchSettings });
    render(<ScheduleIntegrationsPanel groupId="g1" canManage={false} userRole={null} />);
    expect(fetchSettings).not.toHaveBeenCalled();
  });

  it('fetches settings on mount for an admin non-member (userRole undefined, canManage true)', async () => {
    // The Settings host derives `canManage` from `isManager(role, isAdmin)`,
    // so an admin who isn't a member of the static gets `userRole=undefined`
    // with `canManage=true`. The fetch must still fire for them.
    const fetchSettings = vi.fn(async () => {});
    seedStore({ settings: null, fetchSettings });
    render(<ScheduleIntegrationsPanel groupId="g1" canManage userRole={undefined} />);
    await waitFor(() => expect(fetchSettings).toHaveBeenCalledWith('g1'));
  });

  it('hides management controls for non-managers', () => {
    seedStore({ settings: makeSettings({ webhookConfigured: true }) });
    render(<ScheduleIntegrationsPanel groupId="g1" canManage={false} userRole="member" />);
    expect(screen.getByText('Only Leads and Owners can manage integrations.')).toBeInTheDocument();
    expect(screen.queryByTestId('schedule-webhook-url-input')).not.toBeInTheDocument();
  });

  it('does not fetch discord mirrors when the user has no role (membership gate, not a manager gate)', () => {
    const fetchDiscordMirrors = vi.fn(async () => []);
    seedStore({ sessions: [makeSession()], settings: makeSettings(), fetchDiscordMirrors });
    render(<ScheduleIntegrationsPanel groupId="g1" canManage={false} userRole={null} />);
    expect(fetchDiscordMirrors).not.toHaveBeenCalled();
  });

  it('fetches discord mirrors for each session when the user has a role', async () => {
    const fetchDiscordMirrors = vi.fn(async () => []);
    seedStore({ sessions: [makeSession({ id: 'sX' })], settings: makeSettings(), fetchDiscordMirrors });
    render(<ScheduleIntegrationsPanel groupId="g1" canManage userRole="owner" />);
    await waitFor(() => expect(fetchDiscordMirrors).toHaveBeenCalledWith('g1', 'sX'));
  });

  // ── Cross-static settings-sync guard (PR-bot fix: cursor HIGH) ────────────
  // Regression for: the settings-sync effect hydrated the form from
  // WHATEVER `settings` the store held, without checking it belonged to
  // this panel's `groupId`. During a cross-static open (manager viewed
  // static A, switches to B, opens B's Integrations before the mount-fetch
  // for B resolves), the store still holds A's settings — the effect must
  // not hydrate the form with A's data in that window.
  it('does not hydrate the form from stale cross-static settings, and hydrates once matching settings arrive', async () => {
    const fetchSettings = vi.fn(async () => {});
    seedStore({
      settings: makeSettings({ staticGroupId: 'A', reminderChannelLabel: 'a-static-channel' }),
      fetchSettings,
    });
    render(<ScheduleIntegrationsPanel groupId="B" canManage userRole="owner" />);

    // Mount-fetch fires for B (existing stale-group guard) …
    await waitFor(() => expect(fetchSettings).toHaveBeenCalledWith('B'));
    // … but until it resolves, the form must NOT show A's cross-static data.
    expect(screen.getByPlaceholderText('Channel label (e.g. raid-reminders)')).toHaveValue('');

    // B's settings resolve — NOW the form hydrates.
    act(() => {
      useScheduleStore.setState({
        settings: makeSettings({ staticGroupId: 'B', reminderChannelLabel: 'b-static-channel' }),
      } as never);
    });
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Channel label (e.g. raid-reminders)')).toHaveValue('b-static-channel')
    );
  });

  it('does not call updateSettings on Save while the loaded settings belong to a different static (cross-static Save guard)', () => {
    const updateSettings = vi.fn(async () => {});
    seedStore({
      settings: makeSettings({ staticGroupId: 'A' }),
      updateSettings,
    });
    render(<ScheduleIntegrationsPanel groupId="B" canManage userRole="owner" />);
    fireEvent.click(screen.getByText('Save'));
    expect(updateSettings).not.toHaveBeenCalled();
  });

  // ── Standalone sessions mount-fetch (PR-bot fix: cursor MEDIUM) ───────────
  // Regression for: mounted from Settings (ScheduleTab never runs), nothing
  // fetched sessions for this panel — the Discord-mirror summary would stay
  // empty forever, or (cross-static) reflect a previously viewed static.
  it('fetches sessions on mount when none are loaded yet (standalone Settings mount)', async () => {
    const fetchSessions = vi.fn(async () => {});
    seedStore({ sessions: [], fetchSessions });
    render(<ScheduleIntegrationsPanel groupId="g1" canManage userRole="owner" />);
    await waitFor(() => expect(fetchSessions).toHaveBeenCalledWith('g1'));
    // No infinite loop: the mock never mutates `sessions`, so a naive
    // `sessions.length === 0` guard (without a per-group latch) would refire
    // on every store update. Give effects a tick, then assert exactly one call.
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchSessions).toHaveBeenCalledTimes(1);
  });

  it('does not refetch sessions on mount when the loaded sessions already belong to this static', async () => {
    const fetchSessions = vi.fn(async () => {});
    seedStore({ sessions: [makeSession({ staticGroupId: 'g1' })], fetchSessions });
    render(<ScheduleIntegrationsPanel groupId="g1" canManage userRole="owner" />);
    // Settle the (unrelated) discord-mirror poll — sessions being non-empty
    // with a role also triggers that effect — before asserting, so the
    // assertion isn't racing a pending act() outside this test.
    await waitFor(() => expect(useScheduleStore.getState().fetchDiscordMirrors).toHaveBeenCalled());
    expect(fetchSessions).not.toHaveBeenCalled();
  });

  it('refetches sessions when the loaded sessions belong to a different static (cross-static stale guard)', async () => {
    const fetchSessions = vi.fn(async () => {});
    seedStore({ sessions: [makeSession({ staticGroupId: 'other-static' })], fetchSessions });
    render(<ScheduleIntegrationsPanel groupId="g1" canManage userRole="owner" />);
    await waitFor(() => expect(fetchSessions).toHaveBeenCalledWith('g1'));
  });
});
