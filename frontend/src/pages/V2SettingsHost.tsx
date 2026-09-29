/**
 * V2SettingsHost — mounts the existing `StaticSettingsHost` inside `NewShell`
 * (the v2 `?shell=v2` chrome) so the v2 `SettingsGear` + command-palette
 * "Open Settings" controls (which toggle `settingsPanelStore`) actually open a
 * panel. Pure reuse: `StaticSettingsHost` is unchanged; the legacy `GroupView`
 * keeps its own `ConnectedSettingsHost`.
 *
 * `hiddenTabs={RECRUITMENT_HIDDEN}` (R-RH-J, RH1d): the Recruiting route
 * (`/group/:shareCode/recruit`) is now the only place a V2 manager edits the
 * listing and invitations, so the dock's own Recruitment tab is hidden here —
 * a stale `tab: 'recruitment'` (e.g. the header bell) falls back to General,
 * while `settingsPanelStore`'s registered redirect (R-RH-I) sends every
 * Recruitment opener to the route before the dock would ever open. Declared
 * at module scope, not inline: `SettingsPanel` uses it as a `useMemo` dep, and
 * a fresh array literal on every render would defeat that memo. V1's
 * `StaticSettingsHost` caller passes nothing, so its dock keeps Recruitment.
 */
import { StaticSettingsHost, type SettingsTab } from '../components/settings';
import { useGroupAddToRoster } from './groupActionsContext';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import { useCurrentTier } from '../stores/tierStore';
import { useAuthStore } from '../stores/authStore';
import { useSortedMainRosterPlayers } from '../hooks/useSortedMainRosterPlayers';

const RECRUITMENT_HIDDEN: SettingsTab[] = ['recruitment'];

export function V2SettingsHost() {
  const group = useStaticGroupStore((s) => s.currentGroup);
  const tier = useCurrentTier();
  const user = useAuthStore((s) => s.user);
  const onAddToRoster = useGroupAddToRoster();
  const players = useSortedMainRosterPlayers(tier);
  if (!group) return null;
  return (
    <StaticSettingsHost
      group={group}
      players={players}
      tierId={tier?.tierId}
      isAdmin={user?.isAdmin ?? false}
      onAddToRoster={onAddToRoster}
      hiddenTabs={RECRUITMENT_HIDDEN}
    />
  );
}
