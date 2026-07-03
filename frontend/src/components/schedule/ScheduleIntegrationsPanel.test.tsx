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
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    expect(updateSettings).toHaveBeenCalledWith(
      'g1',
      expect.objectContaining({
        reminderChannelLabel: 'raid',
        mentionTarget: 'none',
        enable24hReminder: true,
        enable1hReminder: true,
        enableMissingRsvpReminder: true,
      }),
    );
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

  it('does not refetch settings on mount when they are already loaded', () => {
    const fetchSettings = vi.fn(async () => {});
    seedStore({ settings: makeSettings(), fetchSettings });
    render(<ScheduleIntegrationsPanel groupId="g1" canManage userRole="owner" />);
    expect(fetchSettings).not.toHaveBeenCalled();
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
});
