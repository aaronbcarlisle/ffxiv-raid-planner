/**
 * The session modal's Discord Delivery summary, built in one place for both
 * shells (W0 DEL-1, R-D1-5). Legacy `ScheduleTab` and V2 `Schedule` pass its
 * output to `CreateSessionModal`; the logic is the former inline `useMemo`
 * body of `ScheduleTab`, unchanged.
 */
import { useMemo } from 'react';
import type { ScheduleSettings } from '../../types';

export interface DiscordDeliverySummary {
  serverLabel: string;
  mirrorEnabled: boolean;
  remindersEnabled: boolean;
  reminderLabels: string[];
  pingLabel: string;
}

export function buildDiscordDeliverySummary(settings: ScheduleSettings | null): DiscordDeliverySummary {
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
}

/** Memoised on the settings object, as the inline `useMemo` was. */
export function useDiscordDeliverySummary(settings: ScheduleSettings | null): DiscordDeliverySummary {
  return useMemo(() => buildDiscordDeliverySummary(settings), [settings]);
}
