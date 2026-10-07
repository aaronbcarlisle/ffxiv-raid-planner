/**
 * V1 contract pin (W0 DEL-1, R-D1-5): legacy `ScheduleTab` hands
 * `CreateSessionModal` the same Discord Delivery summary in every settings
 * state. The expected values are literal objects, never the builder's own
 * output, so a change to the shared summary logic fails here.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateSessionModalCalls: Array<Record<string, unknown>> = [];
vi.mock('./CreateSessionModal', () => ({
  CreateSessionModal: (props: Record<string, unknown>) => {
    mockCreateSessionModalCalls.push(props);
    return <div data-testid="create-session-modal-stub" />;
  },
}));

import { ScheduleTab } from './ScheduleTab';
import { useScheduleStore } from '../../stores/scheduleStore';
import { useAuthStore } from '../../stores/authStore';
import type { ScheduleSettings } from '../../types';

const baseSettings: ScheduleSettings = {
  staticGroupId: 'g1',
  webhookConfigured: false,
  mentionTarget: 'none',
  enable24hReminder: false,
  enable1hReminder: false,
  enableMissingRsvpReminder: false,
  calendarEnabled: false,
  canManage: true,
};

const STATES: Array<[string, ScheduleSettings | null, Record<string, unknown>]> = [
  [
    'null settings',
    null,
    { serverLabel: 'Discord', mirrorEnabled: false, remindersEnabled: false, reminderLabels: [], pingLabel: 'No ping' },
  ],
  [
    'connected',
    {
      ...baseSettings,
      discordLinkStatus: 'connected',
      discordGuildName: 'Raid Guild',
      discordGuildId: '111',
      webhookConfigured: true,
      enable24hReminder: true,
      enableMissingRsvpReminder: true,
      mentionTarget: 'here',
    },
    {
      serverLabel: 'Raid Guild',
      mirrorEnabled: true,
      remindersEnabled: true,
      reminderLabels: ['24 hrs before', 'Missing RSVP'],
      pingLabel: '@here',
    },
  ],
  [
    'bot-only',
    {
      ...baseSettings,
      discordBotConfigured: true,
      discordGuildId: '222',
      discordLinkStatus: null,
      discordGuildName: null,
      webhookConfigured: true,
    },
    { serverLabel: 'Guild 222', mirrorEnabled: true, remindersEnabled: false, reminderLabels: [], pingLabel: 'No ping' },
  ],
  [
    'no webhook',
    {
      ...baseSettings,
      discordLinkStatus: 'disconnected',
      discordBotConfigured: true,
      discordGuildId: null,
      webhookConfigured: false,
      enable24hReminder: true,
      enable12hReminder: true,
      enable6hReminder: true,
      enable1hReminder: true,
      enable15mReminder: true,
      enableAtStartReminder: true,
      enableMissingRsvpReminder: true,
    },
    {
      serverLabel: 'Discord',
      mirrorEnabled: false,
      remindersEnabled: false,
      reminderLabels: [
        '24 hrs before',
        '12 hrs before',
        '6 hrs before',
        '1 hr before',
        '15 min before',
        'At start',
        'Missing RSVP',
      ],
      pingLabel: 'No ping',
    },
  ],
  [
    'role mention',
    {
      ...baseSettings,
      discordLinkStatus: 'permission_missing',
      discordGuildName: 'Perm Guild',
      webhookConfigured: true,
      enable1hReminder: true,
      mentionTarget: 'role',
      mentionRoleId: '333',
    },
    {
      serverLabel: 'Perm Guild',
      mirrorEnabled: false,
      remindersEnabled: true,
      reminderLabels: ['1 hr before'],
      pingLabel: '<@&333>',
    },
  ],
];

beforeEach(() => {
  mockCreateSessionModalCalls.length = 0;
  useAuthStore.setState({ user: { id: 'u1', isAdmin: false } } as never);
});

describe('ScheduleTab — Discord Delivery summary (V1 contract)', () => {
  it.each(STATES)('passes the %s summary to the session modal', (_label, settings, expected) => {
    useScheduleStore.setState({
      sessions: [],
      settings,
      isLoading: false,
      error: null,
      fetchSessions: vi.fn(async () => {}),
      fetchSettings: vi.fn(async () => {}),
      fetchDiscordMirrors: vi.fn(async () => []),
      clearSessions: vi.fn(),
    } as never);

    render(
      <MemoryRouter>
        <ScheduleTab groupId="g1" staticName="Test Static" shareCode="DEVTST" members={[]} userRole="owner" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('add-session-btn'));

    const openCall = mockCreateSessionModalCalls.filter((props) => props.isOpen === true).at(-1);
    expect(openCall).toBeDefined();
    expect(openCall?.discordDeliverySummary).toStrictEqual(expected);
  });
});
