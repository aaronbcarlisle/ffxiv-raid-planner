/* eslint-disable design-system/no-raw-button */
import {
  Users, Settings, Link2, Book, Sword, Download, Activity,
  AlertTriangle, ChevronRight, Clock, ExternalLink, CheckCircle, XCircle, PlugZap,
} from 'lucide-react';
import type { MemberRole, PageMode, GearSubTab } from '../../types';
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import { useScheduleStore } from '../../stores/scheduleStore';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';
import { DashboardCard, IconMedallion, SectionLabel } from '../ui/DashboardCard';

interface MorePageProps {
  onOpenSettings: (tab?: string) => void;
  onNavigate: (tab: PageMode) => void;
  onSetGearSubTab: (sub: GearSubTab) => void;
  onOpenSplitPlanner: () => void;
  onOpenIntegrations: () => void;
  onOpenPlugin: () => void;
  canManage: boolean;
  userRole: MemberRole | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function MorePage({
  onOpenSettings,
  onNavigate,
  onSetGearSubTab,
  onOpenSplitPlanner,
  onOpenIntegrations,
  onOpenPlugin,
  canManage,
  userRole,
}: MorePageProps) {
  const pendingCount = useJoinRequestStore(s => s.pendingCount);
  const groupRequests = useJoinRequestStore(s => s.groupRequests);
  const recentApps = groupRequests.filter(r => r.status !== 'pending').length;

  const scheduleSettings = useScheduleStore(s => s.settings);
  const discordLinked = scheduleSettings?.discordLinkStatus === 'connected';
  const discordGuild = scheduleSettings?.discordGuildName;
  const webhookOk = scheduleSettings?.webhookConfigured ?? false;

  const lootLog = useLootTrackingStore(s => s.lootLog);
  const lootCount = lootLog.length;
  const lastLootAt = lootLog.length > 0
    ? lootLog.reduce((latest, e) => e.createdAt > latest ? e.createdAt : latest, lootLog[0].createdAt)
    : null;

  const isOwner = userRole === 'owner';
  const isMember = !!userRole && userRole !== 'viewer';

  return (
    <div className="flex flex-col gap-8">

      {/* Tools & Management */}
      <section>
        <SectionLabel className="mb-3">Tools & Management</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Requests */}
          {canManage && (
            <DashboardCard
              title="Requests"
              icon={<Users size={13} />}
              accentColor={pendingCount > 0 ? 'teal' : undefined}
              badge={pendingCount > 0 ? (
                <span className="bg-accent/20 text-accent text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              ) : undefined}
              onClick={() => onOpenSettings('recruitment')}
            >
              <p className="text-xs text-text-secondary mb-4">
                Review and manage join requests from prospective members.
              </p>
              <div className="space-y-1.5 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Pending</span>
                  <span className={`font-semibold ${pendingCount > 0 ? 'text-accent' : 'text-text-primary'}`}>
                    {pendingCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Recent applications</span>
                  <span className="text-text-primary font-medium">{recentApps}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-accent text-xs font-medium">
                Review requests <ChevronRight size={12} />
              </div>
            </DashboardCard>
          )}

          {/* Lead Tools */}
          {canManage && (
            <DashboardCard
              title="Lead Tools"
              icon={<Settings size={13} />}
              onClick={() => onOpenSettings('general')}
            >
              <p className="text-xs text-text-secondary mb-4">
                Manage static details, roles, permissions, and membership settings.
              </p>
              <div className="space-y-1.5 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Settings</span>
                  <span className="text-accent font-medium">Configure</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Permissions</span>
                  <span className="text-accent font-medium">Manage</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-accent text-xs font-medium">
                Open lead tools <ChevronRight size={12} />
              </div>
            </DashboardCard>
          )}

          {/* Loot History */}
          <DashboardCard
            title="Loot History"
            icon={<Book size={13} />}
            onClick={() => { onSetGearSubTab('history'); onNavigate('gear'); }}
          >
            <p className="text-xs text-text-secondary mb-4">
              Track and review loot entries logged across all raid sessions.
            </p>
            <div className="space-y-1.5 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-text-secondary">Items logged</span>
                <span className="text-text-primary font-medium">{lootCount > 0 ? lootCount : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Last entry</span>
                <span className="text-text-primary font-medium">
                  {lastLootAt ? formatDate(lastLootAt) : '—'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-accent text-xs font-medium">
              View loot history <ChevronRight size={12} />
            </div>
          </DashboardCard>

          {/* Split Planner — live shortcut */}
          <DashboardCard
            title="Split Planner"
            icon={<Sword size={13} />}
            accentColor="teal"
            onClick={onOpenSplitPlanner}
            badge={<ExternalLink size={11} className="text-text-muted" />}
          >
            <p className="text-xs text-text-secondary mb-4">
              Plan loot splits and assign roles for split clears.
            </p>
            <div className="flex items-center gap-1 text-accent text-xs font-medium">
              Open Split Planner <ChevronRight size={12} />
            </div>
          </DashboardCard>

          {/* Integrations */}
          <DashboardCard
            title="Integrations"
            icon={<Link2 size={13} />}
            accentColor={discordLinked || webhookOk ? 'teal' : undefined}
            onClick={onOpenIntegrations}
          >
            <p className="text-xs text-text-secondary mb-4">
              Connect Discord and other services to enhance scheduling and reminders.
            </p>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Discord</span>
                {discordLinked || webhookOk ? (
                  <div className="flex items-center gap-1 text-status-success">
                    <CheckCircle size={12} />
                    <span className="text-xs font-medium">
                      {discordLinked && discordGuild ? discordGuild : 'Connected'}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-text-muted">
                    <XCircle size={12} />
                    <span className="text-xs">Not connected</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Plugin sync</span>
                <span className="text-text-secondary text-xs">Via API key</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-accent text-xs font-medium">
              Manage integrations <ChevronRight size={12} />
            </div>
          </DashboardCard>

          {/* Plugin */}
          <DashboardCard
            title="Dalamud Plugin"
            icon={<PlugZap size={13} />}
            accentColor="teal"
            onClick={onOpenPlugin}
          >
            <p className="text-xs text-text-secondary mb-4">
              Sync gear scores, jobs, and character data directly from FFXIV with the XIVRaidPlanner plugin.
            </p>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Sync method</span>
                <span className="text-xs text-text-muted">API key</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Auto-syncs</span>
                <span className="text-xs text-text-muted">Gear & jobs</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-accent text-xs font-medium">
              Setup & manage <ChevronRight size={12} />
            </div>
          </DashboardCard>

          {/* Settings */}
          <DashboardCard
            title="Settings"
            icon={<Settings size={13} />}
            onClick={() => onOpenSettings('general')}
          >
            <p className="text-xs text-text-secondary mb-4">
              Configure your static details, visibility, and member notifications.
            </p>
            <div className="space-y-1.5 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-text-secondary">General settings</span>
                <span className="text-accent font-medium">Open</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Notifications</span>
                <span className="text-accent font-medium">Configure</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-accent text-xs font-medium">
              Open settings <ChevronRight size={12} />
            </div>
          </DashboardCard>

        </div>
      </section>

      {/* Data & History */}
      <section>
        <SectionLabel className="mb-3">Data & History</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Exports — coming soon */}
          <DashboardCard
            title="Exports"
            icon={<Download size={13} />}
            badge={<span className="text-xs bg-surface-raised text-text-secondary border border-border-subtle px-2 py-0.5 rounded-full">Coming soon</span>}
            className="opacity-60"
          >
            <p className="text-xs text-text-secondary">
              Export roster data, loot history, and gear snapshots for backups or external tools.
            </p>
          </DashboardCard>

          {/* Activity Log — coming soon */}
          <DashboardCard
            title="Activity Log"
            icon={<Activity size={13} />}
            badge={<span className="text-xs bg-surface-raised text-text-secondary border border-border-subtle px-2 py-0.5 rounded-full">Coming soon</span>}
            className="opacity-60"
          >
            <p className="text-xs text-text-secondary">
              View important changes and recent activity across your static.
            </p>
          </DashboardCard>

          {/* Session History */}
          <DashboardCard
            title="Session History"
            icon={<Clock size={13} />}
            onClick={() => onNavigate('schedule')}
          >
            <p className="text-xs text-text-secondary mb-4">
              View past sessions, attendance records, and recurring event history.
            </p>
            <div className="flex items-center gap-1 text-accent text-xs font-medium">
              View schedule <ChevronRight size={12} />
            </div>
          </DashboardCard>

        </div>
      </section>

      {/* Danger Zone */}
      {isMember && (
        <section>
          <SectionLabel color="red" className="mb-3">Danger Zone</SectionLabel>
          <div
            className="rounded-xl p-5 border"
            style={{
              background: 'linear-gradient(160deg, rgba(14,8,8,1) 0%, rgba(10,6,6,0.95) 100%)',
              borderColor: 'rgba(239,68,68,0.25)',
            }}
          >
            <div className="flex items-start gap-3 mb-5">
              <IconMedallion icon={<AlertTriangle size={16} />} color="red" size="sm" />
              <div>
                <p className="text-sm font-semibold text-text-primary">Irreversible actions</p>
                <p className="text-xs text-text-secondary mt-0.5">
                  These actions cannot be undone. Proceed with caution.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {!isOwner && (
                <button
                  onClick={() => onOpenSettings('danger')}
                  className="px-3 py-1.5 text-sm border border-status-error/40 text-status-error rounded-lg hover:bg-status-error/10 transition-colors"
                >
                  Leave Static
                </button>
              )}
              {isOwner && (
                <>
                  <button
                    onClick={() => onOpenSettings('danger')}
                    className="px-3 py-1.5 text-sm border border-status-error/40 text-status-error rounded-lg hover:bg-status-error/10 transition-colors"
                  >
                    Archive Static
                  </button>
                  <button
                    onClick={() => onOpenSettings('danger')}
                    className="px-3 py-1.5 text-sm border border-status-error/40 text-status-error rounded-lg hover:bg-status-error/10 transition-colors"
                  >
                    Delete Static
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      )}

    </div>
  );
}
