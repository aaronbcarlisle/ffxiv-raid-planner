import { describe, expect, it } from 'vitest';
import { buildDiscordDeliverySummary } from './discordDeliverySummary';
import type { ScheduleSettings } from '../../types';

const base: ScheduleSettings = {
  staticGroupId: 'g1',
  webhookConfigured: false,
  mentionTarget: 'none',
  enable24hReminder: false,
  enable1hReminder: false,
  enableMissingRsvpReminder: false,
  calendarEnabled: false,
  canManage: true,
};

describe('buildDiscordDeliverySummary', () => {
  it('null settings: Discord, nothing enabled, no ping', () => {
    expect(buildDiscordDeliverySummary(null)).toStrictEqual({
      serverLabel: 'Discord',
      mirrorEnabled: false,
      remindersEnabled: false,
      reminderLabels: [],
      pingLabel: 'No ping',
    });
  });

  it('a connected link mirrors and names the server', () => {
    const summary = buildDiscordDeliverySummary({
      ...base,
      discordLinkStatus: 'connected',
      discordGuildName: 'Raid Guild',
      discordGuildId: '111',
    });
    expect(summary.mirrorEnabled).toBe(true);
    expect(summary.serverLabel).toBe('Raid Guild');
  });

  it('a bot plus a guild mirrors without a link', () => {
    const summary = buildDiscordDeliverySummary({
      ...base,
      discordLinkStatus: null,
      discordBotConfigured: true,
      discordGuildId: '222',
    });
    expect(summary.mirrorEnabled).toBe(true);
  });

  it('a bot without a guild, or a link that is not connected, does not mirror', () => {
    expect(buildDiscordDeliverySummary({ ...base, discordBotConfigured: true, discordGuildId: null }).mirrorEnabled).toBe(false);
    expect(buildDiscordDeliverySummary({ ...base, discordLinkStatus: 'permission_missing' }).mirrorEnabled).toBe(false);
  });

  it('a webhook with no reminder flags does not remind', () => {
    const summary = buildDiscordDeliverySummary({ ...base, webhookConfigured: true });
    expect(summary.remindersEnabled).toBe(false);
    expect(summary.reminderLabels).toStrictEqual([]);
  });

  it('a webhook plus 24h and Missing RSVP reminds with both labels', () => {
    const summary = buildDiscordDeliverySummary({
      ...base,
      webhookConfigured: true,
      enable24hReminder: true,
      enableMissingRsvpReminder: true,
    });
    expect(summary.remindersEnabled).toBe(true);
    expect(summary.reminderLabels).toStrictEqual(['24 hrs before', 'Missing RSVP']);
  });

  it('reminder flags without a webhook keep their labels but do not remind', () => {
    const summary = buildDiscordDeliverySummary({ ...base, enable1hReminder: true });
    expect(summary.remindersEnabled).toBe(false);
    expect(summary.reminderLabels).toStrictEqual(['1 hr before']);
  });

  it("mentionTarget 'here' pings @here", () => {
    expect(buildDiscordDeliverySummary({ ...base, mentionTarget: 'here' }).pingLabel).toBe('@here');
  });

  it('a role plus mentionRoleId pings the role; a role without an id pings nobody', () => {
    expect(buildDiscordDeliverySummary({ ...base, mentionTarget: 'role', mentionRoleId: '333' }).pingLabel).toBe('<@&333>');
    expect(buildDiscordDeliverySummary({ ...base, mentionTarget: 'role', mentionRoleId: null }).pingLabel).toBe('No ping');
  });

  it('a guild id without a name is labelled Guild <id>', () => {
    expect(buildDiscordDeliverySummary({ ...base, discordGuildId: '444', discordGuildName: null }).serverLabel).toBe('Guild 444');
  });
});
