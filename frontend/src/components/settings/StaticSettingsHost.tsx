/**
 * StaticSettingsHost — renders the in-static Settings panel, subscribing to the
 * settings store for open-state so GroupView (and therefore the roster) never
 * re-renders when the panel toggles. GroupView passes only referentially stable
 * props; this small component is the sole thing that re-renders on a toggle.
 */
import { Settings } from 'lucide-react';
import { useDevice } from '../../hooks/useDevice';
import { useSettingsPanelStore } from '../../stores/settingsPanelStore';
import { RightDockPanel } from '../ui/RightDockPanel';
import { SettingsPanel } from './SettingsPanel';
import { SETTINGS_PANEL_WIDTH } from './settingsLayout';
import type { StaticGroup, SnapshotPlayer, JoinRequest } from '../../types';

interface StaticSettingsHostProps {
  group: StaticGroup;
  players: SnapshotPlayer[];
  tierId?: string;
  isAdmin?: boolean;
  onAddToRoster?: (request: JoinRequest) => void;
}

export function StaticSettingsHost({ group, players, tierId, isAdmin, onAddToRoster }: StaticSettingsHostProps) {
  const isOpen = useSettingsPanelStore((s) => s.isOpen);
  const close = useSettingsPanelStore((s) => s.close);
  const { isSmallScreen } = useDevice();

  const panel = (
    <SettingsPanel
      container={isSmallScreen ? 'slideout' : 'dock'}
      isOpen={isOpen}
      onClose={close}
      group={group}
      players={players}
      tierId={tierId}
      isAdmin={isAdmin}
      onAddToRoster={onAddToRoster}
    />
  );

  // Mobile keeps the full overlay (SettingsPanel owns its chrome).
  if (isSmallScreen) return panel;

  // Desktop docks it to the right edge, below the header band.
  return (
    <RightDockPanel
      isOpen={isOpen}
      onClose={close}
      width={SETTINGS_PANEL_WIDTH}
      title={<span className="flex items-center gap-2"><Settings className="w-5 h-5" />Settings</span>}
    >
      {panel}
    </RightDockPanel>
  );
}
