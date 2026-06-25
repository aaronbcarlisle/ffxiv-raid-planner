/* eslint-disable design-system/no-raw-button */
import { useMemo, useRef, useState, useEffect } from 'react';
import {
  CheckCircle, AlertCircle, AlertTriangle, Clock, BarChart3,
  Wifi, Target, Shield, UserX, Activity, PlugZap,
  Download, Search, KeyRound, Gamepad2, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { SnapshotPlayer, RaidPosition } from '../../types';
import { DashboardCard, IconMedallion, SectionLabel } from '../ui/DashboardCard';
import { ApiKeyManager } from '../settings/ApiKeyManager';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const STALE_MS = 3 * 24 * 60 * 60 * 1000;

interface GearSyncDashboardProps {
  players: SnapshotPlayer[];
  onViewStats?: () => void;
}

const INSTALL_STEPS = [
  {
    icon: Download,
    title: 'Install the Dalamud launcher',
    desc: 'XIVLauncher with Dalamud is required. If you already use Dalamud plugins in FFXIV, you can skip this step.',
  },
  {
    icon: Search,
    title: 'Find XIVRaidPlanner in the plugin list',
    desc: 'Open the Dalamud Plugin Installer in-game (/xlplugins), search for "XIVRaidPlanner", and install it.',
  },
  {
    icon: KeyRound,
    title: 'Generate an API key',
    desc: 'Create a key below. It authenticates the plugin to your account — keep it private.',
  },
  {
    icon: Gamepad2,
    title: 'Connect in FFXIV',
    desc: 'Open the plugin window in-game, paste your API key, and select your static to start syncing.',
  },
] as const;

export const PLUGIN_GUIDE_EVENT = 'plugin:open-guide';

function PluginInstallGuide() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => {
      setOpen(true);
      setTimeout(() => {
        containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    };
    window.addEventListener(PLUGIN_GUIDE_EVENT, handler);
    return () => window.removeEventListener(PLUGIN_GUIDE_EVENT, handler);
  }, []);

  return (
    <div
      ref={containerRef}
      className="rounded-xl border border-border-subtle overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, rgba(14,14,22,0.95) 0%, rgba(10,10,16,0.98) 100%)',
        boxShadow: 'inset 0 0 60px rgba(20,184,166,0.025)',
      }}
    >
      {/* Header row — always visible */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: 'rgba(20,184,166,0.12)',
            boxShadow: '0 0 0 1px rgba(20,184,166,0.22), inset 0 0 20px rgba(20,184,166,0.07)',
          }}
        >
          <PlugZap size={16} className="text-accent" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary font-display">
            Dalamud Plugin Setup
          </p>
          <p className="text-xs text-text-secondary mt-0.5">
            Sync gear, jobs &amp; character data automatically from inside FFXIV
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-accent font-medium hidden sm:inline">
            {open ? 'Hide guide' : 'Setup guide'}
          </span>
          {open
            ? <ChevronUp size={14} className="text-text-muted" />
            : <ChevronDown size={14} className="text-text-muted" />
          }
        </div>
      </button>

      {/* Divider visible only when open */}
      {open && (
        <div className="h-px mx-5" style={{ background: 'linear-gradient(90deg, rgba(20,184,166,0.3) 0%, rgba(20,184,166,0.06) 60%, transparent 100%)' }} />
      )}

      {/* Expandable body */}
      {open && (
        <div className="p-5 pt-6 grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Steps */}
          <div className="space-y-5">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-[0.14em]">Installation steps</p>
            {INSTALL_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="flex gap-3.5">
                  <div className="flex-shrink-0 flex flex-col items-center">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{
                        background: 'rgba(20,184,166,0.1)',
                        boxShadow: '0 0 0 1px rgba(20,184,166,0.18)',
                      }}
                    >
                      <Icon size={13} className="text-accent" />
                    </div>
                    {i < INSTALL_STEPS.length - 1 && (
                      <div
                        className="w-px flex-1 mt-1.5"
                        style={{ background: 'linear-gradient(180deg, rgba(20,184,166,0.25) 0%, rgba(20,184,166,0.04) 100%)', minHeight: 16 }}
                      />
                    )}
                  </div>
                  <div className="pb-1">
                    <div className="flex items-baseline gap-2">
                      <span
                        className="text-[10px] font-bold text-accent/60 uppercase tracking-widest flex-shrink-0"
                        style={{ letterSpacing: '0.14em' }}
                      >
                        {i + 1}
                      </span>
                      <p className="text-sm font-semibold text-text-primary leading-snug">{step.title}</p>
                    </div>
                    <p className="text-xs text-text-secondary mt-1 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* API Key Manager */}
          <div>
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-[0.14em] mb-4">
              Your API keys
            </p>
            <div
              className="rounded-lg border border-border-subtle p-4"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              <ApiKeyManager />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function GearSyncDashboard({ players, onViewStats }: GearSyncDashboardProps) {
  const configured = useMemo(() => players.filter(p => p.configured), [players]);

  const syncStats = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity -- Date.now() intentional: staleness computed at data-change time, not on a clock tick
    const now = Date.now();
    const withSync = configured.filter(p => p.lastSync);
    const sorted = [...withSync].sort(
      (a, b) => new Date(b.lastSync!).getTime() - new Date(a.lastSync!).getTime(),
    );
    const recent = withSync.filter(p => now - new Date(p.lastSync!).getTime() < STALE_MS);
    const stale = configured.filter(
      p => !p.lastSync || now - new Date(p.lastSync).getTime() >= STALE_MS,
    );
    const pct = configured.length > 0 ? Math.round((recent.length / configured.length) * 100) : 0;
    const health: 'healthy' | 'warning' | 'stale' | 'no-data' =
      configured.length === 0 ? 'no-data'
      : pct >= 75 ? 'healthy'
      : pct >= 40 ? 'warning'
      : 'stale';

    return { recent, stale, mostRecent: sorted[0] ?? null, pct, health, total: configured.length, recentActivity: sorted.slice(0, 5) };
  }, [configured]);

  const bisStats = useMemo(() => {
    let targeted = 0, obtained = 0;
    for (const p of configured) {
      for (const slot of p.gear) {
        if (!slot.bisSource) continue;
        targeted++;
        if (slot.hasItem) obtained++;
      }
    }
    const pct = targeted > 0 ? Math.round((obtained / targeted) * 100) : 0;
    return { targeted, obtained, missing: targeted - obtained, pct };
  }, [configured]);

  const roleCoverage = useMemo(() => {
    const filled = new Set<RaidPosition>(
      configured.map(p => p.position).filter((p): p is RaidPosition => !!p),
    );
    return [
      { label: 'Tanks',   slots: ['T1', 'T2'] as RaidPosition[], color: 'text-role-tank' },
      { label: 'Healers', slots: ['H1', 'H2'] as RaidPosition[], color: 'text-role-healer' },
      { label: 'Melee',   slots: ['M1', 'M2'] as RaidPosition[], color: 'text-role-melee' },
      { label: 'Ranged',  slots: ['R1', 'R2'] as RaidPosition[], color: 'text-role-ranged' },
    ].map(r => ({ ...r, count: r.slots.filter(s => filled.has(s)).length }));
  }, [configured]);

  const topStale = syncStats.stale.slice(0, 3);

  const HEALTH_CFG = {
    healthy:   { Icon: CheckCircle,   color: 'text-status-success', bg: 'bg-status-success/10', border: 'border-status-success/20', label: 'Healthy',          sub: 'All data is up to date.' },
    warning:   { Icon: AlertTriangle, color: 'text-status-warning', bg: 'bg-status-warning/10', border: 'border-status-warning/20', label: 'Attention needed', sub: `${syncStats.stale.length} member${syncStats.stale.length !== 1 ? 's' : ''} need sync.` },
    stale:     { Icon: AlertCircle,   color: 'text-status-error',   bg: 'bg-status-error/10',   border: 'border-status-error/20',   label: 'Data stale',       sub: 'Multiple members are out of sync.' },
    'no-data': { Icon: Clock,         color: 'text-text-secondary', bg: 'bg-surface-raised',    border: 'border-border-subtle',     label: 'No data',          sub: 'Roster not configured yet.' },
  } as const;
  const healthCfg = HEALTH_CFG[syncStats.health];
  const { Icon: HealthIcon } = healthCfg;
  const healthAccent = syncStats.health === 'healthy' ? 'teal' : syncStats.health === 'stale' ? 'red' : syncStats.health === 'warning' ? 'yellow' : undefined;

  return (
    <div className="space-y-6">

      {/* ── Sync stats grid ── */}
      <div>
        <SectionLabel className="mb-3">Sync Overview</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Sync Health */}
          <DashboardCard title="Sync Health" icon={<Wifi size={13} />} accentColor={healthAccent}>
            <div className={`flex items-center gap-3 p-3 rounded-lg border ${healthCfg.bg} ${healthCfg.border} mb-4`}>
              <IconMedallion
                icon={<HealthIcon size={16} />}
                color={syncStats.health === 'healthy' ? 'teal' : syncStats.health === 'stale' ? 'red' : syncStats.health === 'warning' ? 'yellow' : 'neutral'}
                size="sm"
              />
              <div>
                <p className={`text-sm font-semibold ${healthCfg.color}`}>{healthCfg.label}</p>
                <p className="text-xs text-text-secondary">{healthCfg.sub}</p>
              </div>
            </div>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">Last sync</span>
                <span className="text-text-primary font-medium">
                  {syncStats.mostRecent?.lastSync ? timeAgo(syncStats.mostRecent.lastSync) : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Members synced</span>
                <span className="text-text-primary font-medium">
                  {syncStats.total > 0 ? `${syncStats.recent.length} / ${syncStats.total} (${syncStats.pct}%)` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Data coverage</span>
                <span className={`font-medium ${syncStats.pct >= 75 ? 'text-status-success' : syncStats.pct >= 40 ? 'text-status-warning' : syncStats.total === 0 ? 'text-text-secondary' : 'text-status-error'}`}>
                  {syncStats.total === 0 ? '—' : syncStats.pct >= 75 ? 'High' : syncStats.pct >= 40 ? 'Medium' : 'Low'}
                </span>
              </div>
            </div>
          </DashboardCard>

          {/* BiS Progress */}
          <DashboardCard title="BiS Progress" icon={<Target size={13} />}>
            {bisStats.targeted === 0 ? (
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <IconMedallion icon={<Target size={18} />} color="neutral" />
                <p className="text-sm text-text-secondary mt-3 max-w-[160px]">
                  Import BiS sets to track gear progress.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-3">
                  <p className="text-3xl font-display font-bold text-text-primary">
                    {bisStats.pct}<span className="text-base text-text-secondary font-normal">%</span>
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">Overall BiS Complete</p>
                </div>
                <div className="w-full bg-surface-raised rounded-full h-1.5 mb-4 overflow-hidden">
                  <div
                    className="h-1.5 rounded-full transition-all duration-700"
                    style={{
                      width: `${bisStats.pct}%`,
                      background: 'linear-gradient(90deg, var(--color-accent-deep), var(--color-accent))',
                    }}
                  />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                      <span className="text-text-secondary">Obtained</span>
                    </div>
                    <span className="text-text-primary font-medium">
                      {bisStats.obtained}
                      <span className="text-text-secondary font-normal text-xs ml-1">
                        ({Math.round((bisStats.obtained / bisStats.targeted) * 100)}%)
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-400/60 flex-shrink-0" />
                      <span className="text-text-secondary">Missing</span>
                    </div>
                    <span className="text-text-primary font-medium">{bisStats.missing}</span>
                  </div>
                </div>
              </>
            )}
          </DashboardCard>

          {/* Role Coverage */}
          <DashboardCard title="Role Coverage" icon={<Shield size={13} />}>
            {configured.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <IconMedallion icon={<Shield size={18} />} color="neutral" />
                <p className="text-sm text-text-secondary mt-3">No players configured.</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {roleCoverage.map(role => {
                  const full = role.count === role.slots.length;
                  return (
                    <div key={role.label} className="flex items-center gap-3">
                      <span className="text-sm text-text-secondary w-16 flex-shrink-0">{role.label}</span>
                      <div className="flex-1 bg-surface-raised rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all ${full ? 'bg-status-success' : 'bg-status-warning'}`}
                          style={{ width: `${(role.count / role.slots.length) * 100}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium w-8 text-right ${full ? 'text-status-success' : role.color}`}>
                        {role.count}/{role.slots.length}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </DashboardCard>

          {/* Stale Members */}
          <DashboardCard
            title="Stale Members"
            icon={<UserX size={13} />}
            accentColor={topStale.length > 0 ? 'red' : undefined}
            badge={topStale.length > 0 ? (
              <span className="bg-status-error/20 text-status-error text-xs font-semibold px-1.5 py-0.5 rounded-full">
                {topStale.length}
              </span>
            ) : undefined}
          >
            {topStale.length === 0 ? (
              <div className="flex items-center gap-2.5 text-sm text-text-secondary">
                <CheckCircle size={15} className="text-status-success flex-shrink-0" />
                {configured.length === 0 ? 'No players configured.' : 'All members are up to date.'}
              </div>
            ) : (
              <div className="space-y-3">
                {topStale.map(p => (
                  <div key={p.id} className="flex items-center gap-3 min-w-0">
                    <IconMedallion icon={<span className="text-xs font-bold">{p.name[0]}</span>} color="red" size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate font-medium">{p.name}</p>
                      <p className="text-xs text-status-error">
                        {p.lastSync ? timeAgo(p.lastSync) : 'Never synced'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashboardCard>

          {/* Recent Sync Activity */}
          <DashboardCard title="Recent Sync Activity" icon={<Activity size={13} />}>
            {syncStats.recentActivity.length === 0 ? (
              <div className="flex flex-col items-center py-4 text-center">
                <IconMedallion icon={<Activity size={18} />} color="neutral" />
                <p className="text-sm text-text-secondary mt-3">No recent sync activity.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {syncStats.recentActivity.map(p => (
                  <div key={p.id} className="flex items-center gap-3 min-w-0">
                    <IconMedallion icon={<span className="text-xs font-bold">{p.name[0]}</span>} color="teal" size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate font-medium">{p.name}</p>
                      <p className="text-xs text-text-secondary capitalize">
                        {p.lastSyncSource ? `via ${p.lastSyncSource.replace('_', ' ')}` : 'Synced gear'}
                      </p>
                    </div>
                    <span className="text-xs text-text-secondary flex-shrink-0">{timeAgo(p.lastSync!)}</span>
                  </div>
                ))}
              </div>
            )}
          </DashboardCard>

          {/* Team Summary shortcut */}
          <DashboardCard
            title="Team Summary"
            icon={<BarChart3 size={13} />}
            onClick={onViewStats}
            accentColor="teal"
          >
            <p className="text-sm text-text-secondary mb-4 leading-relaxed">
              View job distribution, BiS gaps by slot, and overall progress across all roster members.
            </p>
            <div className="flex items-center gap-1.5 text-accent text-sm font-medium">
              <span>Open Team Summary</span>
              <span className="text-xs">→</span>
            </div>
          </DashboardCard>

        </div>
      </div>

      {/* ── Plugin setup guide ── */}
      <div>
        <SectionLabel className="mb-3">Plugin Integration</SectionLabel>
        <PluginInstallGuide />
      </div>

    </div>
  );
}
