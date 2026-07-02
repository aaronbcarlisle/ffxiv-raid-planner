/* eslint-disable design-system/no-raw-button */
import { useTranslation } from 'react-i18next';
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

function getUiLocale(language: string): string {
  return language.startsWith('ja') ? 'ja-JP' : 'en-US';
}

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
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
  const { t, i18n } = useTranslation();
  const uiLocale = getUiLocale(i18n.resolvedLanguage ?? i18n.language ?? 'en');
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
        <SectionLabel className="mb-3">{t('morePage.toolsAndManagement')}</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Requests */}
          {canManage && (
            <DashboardCard
              title={t('morePage.requests')}
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
                {t('morePage.requestsDesc')}
              </p>
              <div className="space-y-1.5 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-text-secondary">{t('morePage.pending')}</span>
                  <span className={`font-semibold ${pendingCount > 0 ? 'text-accent' : 'text-text-primary'}`}>
                    {pendingCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">{t('morePage.recentApplications')}</span>
                  <span className="text-text-primary font-medium">{recentApps}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-accent text-xs font-medium">
                {t('morePage.reviewRequests')} <ChevronRight size={12} />
              </div>
            </DashboardCard>
          )}

          {/* Lead Tools */}
          {canManage && (
            <DashboardCard
              title={t('morePage.leadTools')}
              icon={<Settings size={13} />}
              onClick={() => onOpenSettings('general')}
            >
              <p className="text-xs text-text-secondary mb-4">
                {t('morePage.leadToolsDesc')}
              </p>
              <div className="space-y-1.5 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-text-secondary">{t('common.settings')}</span>
                  <span className="text-accent font-medium">{t('common.configure')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">{t('morePage.permissions')}</span>
                  <span className="text-accent font-medium">{t('common.manage')}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-accent text-xs font-medium">
                {t('morePage.openLeadTools')} <ChevronRight size={12} />
              </div>
            </DashboardCard>
          )}

          {/* Loot History */}
          <DashboardCard
            title={t('morePage.lootHistory')}
            icon={<Book size={13} />}
            onClick={() => { onSetGearSubTab('history'); onNavigate('gear'); }}
          >
            <p className="text-xs text-text-secondary mb-4">
              {t('morePage.lootHistoryDesc')}
            </p>
            <div className="space-y-1.5 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-text-secondary">{t('morePage.itemsLogged')}</span>
                <span className="text-text-primary font-medium">{lootCount > 0 ? lootCount : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">{t('morePage.lastEntry')}</span>
                <span className="text-text-primary font-medium">
                  {lastLootAt ? formatDate(lastLootAt, uiLocale) : '—'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-accent text-xs font-medium">
              {t('morePage.viewLootHistory')} <ChevronRight size={12} />
            </div>
          </DashboardCard>

          {/* Split Planner — live shortcut */}
          <DashboardCard
            title={t('roster.splitPlanner')}
            icon={<Sword size={13} />}
            accentColor="teal"
            onClick={onOpenSplitPlanner}
            badge={<ExternalLink size={11} className="text-text-muted" />}
          >
            <p className="text-xs text-text-secondary mb-4">
              {t('morePage.splitPlannerDesc')}
            </p>
            <div className="flex items-center gap-1 text-accent text-xs font-medium">
              {t('overview.openSplitPlanner')} <ChevronRight size={12} />
            </div>
          </DashboardCard>

          {/* Integrations */}
          <DashboardCard
            title={t('morePage.integrations')}
            icon={<Link2 size={13} />}
            accentColor={discordLinked || webhookOk ? 'teal' : undefined}
            onClick={onOpenIntegrations}
          >
            <p className="text-xs text-text-secondary mb-4">
              {t('morePage.integrationsDesc')}
            </p>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">{t('morePage.discord')}</span>
                {discordLinked || webhookOk ? (
                  <div className="flex items-center gap-1 text-status-success">
                    <CheckCircle size={12} />
                    <span className="text-xs font-medium">
                      {discordLinked && discordGuild ? discordGuild : t('common.connected')}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-text-muted">
                    <XCircle size={12} />
                    <span className="text-xs">{t('common.notConnected')}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">{t('morePage.pluginSync')}</span>
                <span className="text-text-secondary text-xs">{t('morePage.viaApiKey')}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-accent text-xs font-medium">
              {t('morePage.manageIntegrations')} <ChevronRight size={12} />
            </div>
          </DashboardCard>

          {/* Plugin */}
          <DashboardCard
            title={t('nav.dalamudPlugin')}
            icon={<PlugZap size={13} />}
            accentColor="teal"
            onClick={onOpenPlugin}
          >
            <p className="text-xs text-text-secondary mb-4">
              {t('morePage.pluginDesc')}
            </p>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">{t('morePage.syncMethod')}</span>
                <span className="text-xs text-text-muted">{t('morePage.apiKey')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">{t('morePage.autoSyncs')}</span>
                <span className="text-xs text-text-muted">{t('morePage.gearAndJobs')}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-accent text-xs font-medium">
              {t('morePage.setupAndManage')} <ChevronRight size={12} />
            </div>
          </DashboardCard>

          {/* Settings */}
          <DashboardCard
            title={t('common.settings')}
            icon={<Settings size={13} />}
            onClick={() => onOpenSettings('general')}
          >
            <p className="text-xs text-text-secondary mb-4">
              {t('morePage.settingsDesc')}
            </p>
            <div className="space-y-1.5 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-text-secondary">{t('morePage.generalSettings')}</span>
                <span className="text-accent font-medium">{t('common.open')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">{t('auth.notifications')}</span>
                <span className="text-accent font-medium">{t('common.configure')}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-accent text-xs font-medium">
              {t('morePage.openSettings')} <ChevronRight size={12} />
            </div>
          </DashboardCard>

        </div>
      </section>

      {/* Data & History */}
      <section>
        <SectionLabel className="mb-3">{t('morePage.dataAndHistory')}</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Exports — coming soon */}
          <DashboardCard
            title={t('morePage.exports')}
            icon={<Download size={13} />}
            badge={<span className="text-xs bg-surface-raised text-text-secondary border border-border-subtle px-2 py-0.5 rounded-full">{t('common.comingSoon')}</span>}
            className="opacity-60"
          >
            <p className="text-xs text-text-secondary">
              {t('morePage.exportsDesc')}
            </p>
          </DashboardCard>

          {/* Activity Log — coming soon */}
          <DashboardCard
            title={t('morePage.activityLog')}
            icon={<Activity size={13} />}
            badge={<span className="text-xs bg-surface-raised text-text-secondary border border-border-subtle px-2 py-0.5 rounded-full">{t('common.comingSoon')}</span>}
            className="opacity-60"
          >
            <p className="text-xs text-text-secondary">
              {t('morePage.activityLogDesc')}
            </p>
          </DashboardCard>

          {/* Session History */}
          <DashboardCard
            title={t('morePage.sessionHistory')}
            icon={<Clock size={13} />}
            onClick={() => onNavigate('schedule')}
          >
            <p className="text-xs text-text-secondary mb-4">
              {t('morePage.sessionHistoryDesc')}
            </p>
            <div className="flex items-center gap-1 text-accent text-xs font-medium">
              {t('morePage.viewSchedule')} <ChevronRight size={12} />
            </div>
          </DashboardCard>

        </div>
      </section>

      {/* Danger Zone */}
      {isMember && (
        <section>
          <SectionLabel color="red" className="mb-3">{t('morePage.dangerZone')}</SectionLabel>
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
                <p className="text-sm font-semibold text-text-primary">{t('morePage.irreversibleActions')}</p>
                <p className="text-xs text-text-secondary mt-0.5">
                  {t('morePage.irreversibleActionsDesc')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {!isOwner && (
                <button
                  onClick={() => onOpenSettings('danger')}
                  className="px-3 py-1.5 text-sm border border-status-error/40 text-status-error rounded-lg hover:bg-status-error/10 transition-colors"
                >
                  {t('morePage.leaveStatic')}
                </button>
              )}
              {isOwner && (
                <>
                  <button
                    onClick={() => onOpenSettings('danger')}
                    className="px-3 py-1.5 text-sm border border-status-error/40 text-status-error rounded-lg hover:bg-status-error/10 transition-colors"
                  >
                    {t('morePage.archiveStatic')}
                  </button>
                  <button
                    onClick={() => onOpenSettings('danger')}
                    className="px-3 py-1.5 text-sm border border-status-error/40 text-status-error rounded-lg hover:bg-status-error/10 transition-colors"
                  >
                    {t('morePage.deleteStatic')}
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
