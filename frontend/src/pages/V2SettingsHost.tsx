/**
 * V2SettingsHost — mounts the existing `StaticSettingsHost` inside `NewShell`
 * (the v2 `?shell=v2` chrome) so the v2 `SettingsGear` + command-palette
 * "Open Settings" controls (which toggle `settingsPanelStore`) actually open a
 * panel. Pure reuse: `StaticSettingsHost` is unchanged; the legacy `GroupView`
 * keeps its own `ConnectedSettingsHost`.
 *
 * Must be rendered inside `<GroupActionModals>` because it calls
 * `useGroupAddToRoster()` (the accepted-join-request → roster handler).
 */
import { StaticSettingsHost } from '../components/settings';
import { useGroupAddToRoster } from './groupActionsContext';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import { useCurrentTier } from '../stores/tierStore';
import { useAuthStore } from '../stores/authStore';
import { useSortedMainRosterPlayers } from '../hooks/useSortedMainRosterPlayers';

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
    />
  );
}
