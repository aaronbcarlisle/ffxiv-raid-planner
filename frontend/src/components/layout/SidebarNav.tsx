import { LayoutDashboard, Calendar, Users, Trophy, Shield, MoreHorizontal, PlugZap } from 'lucide-react';
import type { PageMode } from '../../types';
import { analytics } from '../../services/analytics';
import { UserMenu } from '../auth';
import { AppRail } from './AppRail';
import type { RailNavItem } from './railTypes';

interface SidebarNavProps {
  activeTab: PageMode;
  onTabChange: (tab: PageMode) => void;
  staticName?: string;
}

const NAV_DEFS: Array<{ id: PageMode; label: string; description: string; shortcut?: string; icon: RailNavItem['icon'] }> = [
  { id: 'overview', label: 'Overview',      description: 'Static overview, next raid, and pending applications', shortcut: '`', icon: LayoutDashboard },
  { id: 'schedule', label: 'Schedule',      description: 'Upcoming sessions, availability, and Discord sync',    shortcut: '1', icon: Calendar },
  { id: 'roster',   label: 'Roster',        description: 'Member list, roles, and join requests',                shortcut: '2', icon: Users },
  { id: 'goals',    label: 'Goals & Farms', description: 'Farm goals, mount drops, and clear tracking',          shortcut: '3', icon: Trophy },
  { id: 'gear',     label: 'Gear & Sync',   description: 'BiS sets, gear sync, and loot history',                shortcut: '4', icon: Shield },
];

// Plugin sits directly before More so the two stay grouped at the end of the rail.
export function SidebarNav({ activeTab, onTabChange, staticName }: SidebarNavProps) {
  const select = (id: PageMode) => {
    analytics.track('navigation', 'sidebar_switch', { tab: id });
    onTabChange(id);
  };

  const items: RailNavItem[] = [
    ...NAV_DEFS.map(d => ({ ...d, isActive: activeTab === d.id, onSelect: () => select(d.id) })),
    {
      id: 'plugin', label: 'Plugin', description: 'Dalamud plugin: sync gear and character data',
      icon: PlugZap, isActive: false,
      onSelect: () => { analytics.track('navigation', 'sidebar_plugin'); onTabChange('more'); },
    },
    {
      id: 'more', label: 'More', description: 'Integrations, settings, and tools',
      icon: MoreHorizontal, isActive: activeTab === 'more', onSelect: () => select('more'),
    },
  ];

  return (
    <AppRail
      context="static"
      identity={{ icon: Shield, label: staticName ?? 'Static' }}
      collapseKey="sidebar-collapsed"
      items={items}
      footer={(collapsed) => <UserMenu variant="rail" collapsed={collapsed} />}
    />
  );
}
