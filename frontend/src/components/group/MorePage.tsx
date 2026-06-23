/* eslint-disable design-system/no-raw-button */
import {
  Users, Settings, Link2, Book, Sword, Download, Activity,
  AlertTriangle, ChevronRight, Clock,
} from 'lucide-react';
import type { MemberRole, PageMode, GearSubTab } from '../../types';
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import { useScheduleStore } from '../../stores/scheduleStore';
import { useLootTrackingStore } from '../../stores/lootTrackingStore';

interface MorePageProps {
  onOpenSettings: (tab?: string) => void;
  onNavigate: (tab: PageMode) => void;
  onSetGearSubTab: (sub: GearSubTab) => void;
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

      {/* Primary tools */}
      <section>
        <h2 className="text-xs font-semibold text-[#c9a84c] uppercase tracking-widest mb-3">
          Tools & Management
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Requests */}
          {canManage && (
            <button
              onClick={() => onOpenSettings('recruitment')}
              className="group text-left bg-surface-card border border-border-default rounded-xl p-5 hover:border-accent/50 hover:bg-surface-raised transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <Users size={16} className="text-accent" />
                <span className="text-sm font-semibold text-text-primary">Requests</span>
              </div>
              <p className="text-xs text-text-secondary mb-4">Review and manage join requests.</p>
              <div className="space-y-1.5 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Pending requests</span>
                  <span className={`font-semibold ${pendingCount > 0 ? 'text-accent' : 'text-text-primary'}`}>
                    {pendingCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Recent applications</span>
                  <span className="text-text-primary font-medium">{recentApps}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-accent text-sm font-medium">
                Review requests <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          )}

          {/* Lead Tools / Settings */}
          {canManage && (
            <button
              onClick={() => onOpenSettings('general')}
              className="group text-left bg-surface-card border border-border-default rounded-xl p-5 hover:border-accent/50 hover:bg-surface-raised transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <Settings size={16} className="text-accent" />
                <span className="text-sm font-semibold text-text-primary">Lead Tools</span>
              </div>
              <p className="text-xs text-text-secondary mb-4">
                Manage static details, roles, permissions, and membership.
              </p>
              <div className="space-y-1.5 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Static settings</span>
                  <span className="text-accent font-medium">Configure</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Permissions</span>
                  <span className="text-accent font-medium">Manage</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-accent text-sm font-medium">
                Open lead tools <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          )}

          {/* Loot Log */}
          <button
            onClick={() => { onSetGearSubTab('history'); onNavigate('gear'); }}
            className="group text-left bg-surface-card border border-border-default rounded-xl p-5 hover:border-accent/50 hover:bg-surface-raised transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <Book size={16} className="text-accent" />
              <span className="text-sm font-semibold text-text-primary">Loot Log</span>
            </div>
            <p className="text-xs text-text-secondary mb-4">
              Track loot history and drops across raids.
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
            <div className="flex items-center gap-1 text-accent text-sm font-medium">
              View loot log <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

          {/* Split Planner — Coming Soon */}
          <div className="text-left bg-surface-card border border-border-subtle rounded-xl p-5 opacity-70">
            <div className="flex items-center gap-2 mb-2">
              <Sword size={16} className="text-text-tertiary" />
              <span className="text-sm font-semibold text-text-secondary">Split Planner</span>
              <span className="ml-auto text-xs bg-surface-raised text-text-secondary border border-border-subtle px-2 py-0.5 rounded-full">
                Coming Soon
              </span>
            </div>
            <p className="text-xs text-text-secondary mb-4">
              Plan loot splits for your static with ease.
            </p>
            <p className="text-xs text-text-tertiary">Advanced split planning and templates.</p>
          </div>

          {/* Integrations */}
          <button
            onClick={() => onOpenSettings('integrations')}
            className="group text-left bg-surface-card border border-border-default rounded-xl p-5 hover:border-accent/50 hover:bg-surface-raised transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <Link2 size={16} className="text-accent" />
              <span className="text-sm font-semibold text-text-primary">Integrations</span>
            </div>
            <p className="text-xs text-text-secondary mb-4">
              Connect with other services to enhance your workflow.
            </p>
            <div className="space-y-1.5 text-sm mb-4">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Discord</span>
                {discordLinked || webhookOk ? (
                  <span className="text-accent font-medium">
                    {discordLinked && discordGuild ? discordGuild : 'Connected'}
                  </span>
                ) : (
                  <span className="text-text-tertiary">Not connected</span>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Plugin sync</span>
                <span className="text-text-secondary font-medium">Via API key</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-accent text-sm font-medium">
              Manage integrations <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

          {/* Settings */}
          <button
            onClick={() => onOpenSettings('general')}
            className="group text-left bg-surface-card border border-border-default rounded-xl p-5 hover:border-accent/50 hover:bg-surface-raised transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <Settings size={16} className="text-accent" />
              <span className="text-sm font-semibold text-text-primary">Settings</span>
            </div>
            <p className="text-xs text-text-secondary mb-4">
              Configure your static, notifications, and preferences.
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
            <div className="flex items-center gap-1 text-accent text-sm font-medium">
              Open settings <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

        </div>
      </section>

      {/* Data & History */}
      <section>
        <h2 className="text-xs font-semibold text-[#c9a84c] uppercase tracking-widest mb-3">
          Data & History
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Exports */}
          <div className="text-left bg-surface-card border border-border-subtle rounded-xl p-5 opacity-70">
            <div className="flex items-center gap-2 mb-2">
              <Download size={16} className="text-text-tertiary" />
              <span className="text-sm font-semibold text-text-secondary">Exports</span>
              <span className="ml-auto text-xs bg-surface-raised text-text-secondary border border-border-subtle px-2 py-0.5 rounded-full">
                Coming Soon
              </span>
            </div>
            <p className="text-xs text-text-secondary">Export data for backups or external tools.</p>
          </div>

          {/* Activity Log */}
          <div className="text-left bg-surface-card border border-border-subtle rounded-xl p-5 opacity-70">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={16} className="text-text-tertiary" />
              <span className="text-sm font-semibold text-text-secondary">Activity Log</span>
              <span className="ml-auto text-xs bg-surface-raised text-text-secondary border border-border-subtle px-2 py-0.5 rounded-full">
                Coming Soon
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              View important changes and recent activity across your static.
            </p>
          </div>

          {/* Schedule history shortcut */}
          <button
            onClick={() => onNavigate('schedule')}
            className="group text-left bg-surface-card border border-border-default rounded-xl p-5 hover:border-accent/50 hover:bg-surface-raised transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <Clock size={16} className="text-accent" />
              <span className="text-sm font-semibold text-text-primary">Session History</span>
            </div>
            <p className="text-xs text-text-secondary mb-3">
              View past sessions, attendance records, and recurring event history.
            </p>
            <div className="flex items-center gap-1 text-accent text-sm font-medium">
              View schedule <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

        </div>
      </section>

      {/* Danger Zone */}
      {isMember && (
        <section>
          <h2 className="text-xs font-semibold text-red-400 uppercase tracking-widest mb-3">
            Danger Zone
          </h2>
          <div className="bg-surface-card border border-red-500/30 rounded-xl p-5">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
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
                  className="px-3 py-1.5 text-sm border border-red-500/40 text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                >
                  Leave Static
                </button>
              )}
              {isOwner && (
                <>
                  <button
                    onClick={() => onOpenSettings('danger')}
                    className="px-3 py-1.5 text-sm border border-red-500/40 text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                  >
                    Archive Static
                  </button>
                  <button
                    onClick={() => onOpenSettings('danger')}
                    className="px-3 py-1.5 text-sm border border-red-500/40 text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
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
