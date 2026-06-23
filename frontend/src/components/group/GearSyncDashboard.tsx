/* eslint-disable design-system/no-raw-button */
import { useMemo } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Clock, BarChart3 } from 'lucide-react';
import type { SnapshotPlayer, RaidPosition } from '../../types';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const STALE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

interface GearSyncDashboardProps {
  players: SnapshotPlayer[];
  onViewStats?: () => void;
}

export function GearSyncDashboard({ players, onViewStats }: GearSyncDashboardProps) {
  const configured = useMemo(() => players.filter(p => p.configured), [players]);

  const syncStats = useMemo(() => {
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

    return {
      recent,
      stale,
      mostRecent: sorted[0] ?? null,
      pct,
      health,
      total: configured.length,
      recentActivity: sorted.slice(0, 5),
    };
  }, [configured]);

  const bisStats = useMemo(() => {
    let targeted = 0;
    let obtained = 0;
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
      { label: 'Tanks', slots: ['T1', 'T2'] as RaidPosition[] },
      { label: 'Healers', slots: ['H1', 'H2'] as RaidPosition[] },
      { label: 'Melee', slots: ['M1', 'M2'] as RaidPosition[] },
      { label: 'Ranged', slots: ['R1', 'R2'] as RaidPosition[] },
    ].map(r => ({ ...r, count: r.slots.filter(s => filled.has(s)).length }));
  }, [configured]);

  const topStale = syncStats.stale.slice(0, 3);

  const HEALTH_CFG = {
    healthy: { Icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-400/10', label: 'Healthy', sub: 'All data is up to date.' },
    warning: { Icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-400/10', label: 'Attention needed', sub: `${syncStats.stale.length} member${syncStats.stale.length !== 1 ? 's' : ''} need sync.` },
    stale: { Icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-400/10', label: 'Data stale', sub: 'Multiple members are out of sync.' },
    'no-data': { Icon: Clock, color: 'text-text-secondary', bg: 'bg-surface-raised', label: 'No data', sub: 'Roster not configured yet.' },
  } as const;
  const healthCfg = HEALTH_CFG[syncStats.health];
  const { Icon: HealthIcon } = healthCfg;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

      {/* Sync Health */}
      <div className="bg-surface-card border border-border-default rounded-xl p-5">
        <p className="text-xs font-semibold text-[#c9a84c] uppercase tracking-widest mb-4">Sync Health</p>
        <div className={`flex items-center gap-3 p-3 rounded-lg ${healthCfg.bg} mb-4`}>
          <HealthIcon size={22} className={healthCfg.color} />
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
            <span className={`font-medium ${syncStats.pct >= 75 ? 'text-accent' : syncStats.pct >= 40 ? 'text-yellow-400' : syncStats.total === 0 ? 'text-text-secondary' : 'text-red-400'}`}>
              {syncStats.total === 0 ? '—' : syncStats.pct >= 75 ? 'High' : syncStats.pct >= 40 ? 'Medium' : 'Low'}
            </span>
          </div>
        </div>
      </div>

      {/* BiS Progress */}
      <div className="bg-surface-card border border-border-default rounded-xl p-5">
        <p className="text-xs font-semibold text-[#c9a84c] uppercase tracking-widest mb-4">BiS Progress</p>
        {bisStats.targeted === 0 ? (
          <p className="text-sm text-text-secondary">No BiS targets set. Import BiS sets to track progress.</p>
        ) : (
          <>
            <div className="mb-3">
              <p className="text-3xl font-bold text-text-primary">{bisStats.pct}<span className="text-lg text-text-secondary">%</span></p>
              <p className="text-xs text-text-secondary mt-0.5">Overall BiS Complete</p>
            </div>
            <div className="w-full bg-surface-raised rounded-full h-2 mb-4">
              <div className="bg-accent h-2 rounded-full transition-all duration-500" style={{ width: `${bisStats.pct}%` }} />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                  <span className="text-text-secondary">Obtained</span>
                </div>
                <span className="text-text-primary font-medium">{bisStats.obtained} <span className="text-text-secondary font-normal">({Math.round(bisStats.obtained / bisStats.targeted * 100)}%)</span></span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-400/60 flex-shrink-0" />
                  <span className="text-text-secondary">Missing</span>
                </div>
                <span className="text-text-primary font-medium">{bisStats.missing}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Role Coverage */}
      <div className="bg-surface-card border border-border-default rounded-xl p-5">
        <p className="text-xs font-semibold text-[#c9a84c] uppercase tracking-widest mb-4">Role Coverage</p>
        {configured.length === 0 ? (
          <p className="text-sm text-text-secondary">No players configured.</p>
        ) : (
          <div className="space-y-3">
            {roleCoverage.map(role => (
              <div key={role.label} className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">{role.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">{role.count} / {role.slots.length}</span>
                  {role.count === role.slots.length ? (
                    <CheckCircle size={14} className="text-green-400" />
                  ) : (
                    <AlertTriangle size={14} className="text-yellow-400" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stale Members */}
      <div className="bg-surface-card border border-border-default rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <p className="text-xs font-semibold text-[#c9a84c] uppercase tracking-widest">Stale Members</p>
          {topStale.length > 0 && (
            <span className="bg-red-500/20 text-red-400 text-xs font-semibold px-1.5 py-0.5 rounded-full">{topStale.length}</span>
          )}
        </div>
        {topStale.length === 0 ? (
          <p className="text-sm text-text-secondary">{configured.length === 0 ? 'No players configured.' : 'All members are up to date.'}</p>
        ) : (
          <div className="space-y-3">
            {topStale.map(p => (
              <div key={p.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-surface-raised flex items-center justify-center text-xs font-semibold text-text-secondary flex-shrink-0">
                    {p.name[0]}
                  </div>
                  <span className="text-sm text-text-primary truncate">{p.name}</span>
                </div>
                <span className="text-xs text-red-400 flex-shrink-0 ml-2">
                  {p.lastSync ? timeAgo(p.lastSync) : 'Never synced'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Sync Activity */}
      <div className="bg-surface-card border border-border-default rounded-xl p-5">
        <p className="text-xs font-semibold text-[#c9a84c] uppercase tracking-widest mb-3">Recent Sync Activity</p>
        {syncStats.recentActivity.length === 0 ? (
          <p className="text-sm text-text-secondary">No recent sync activity.</p>
        ) : (
          <div className="space-y-3">
            {syncStats.recentActivity.map(p => (
              <div key={p.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center text-xs font-semibold text-accent flex-shrink-0">
                    {p.name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-text-primary truncate">{p.name}</p>
                    <p className="text-xs text-text-secondary capitalize">
                      {p.lastSyncSource ? `via ${p.lastSyncSource.replace('_', ' ')}` : 'Synced gear'}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-text-secondary flex-shrink-0 ml-2">{timeAgo(p.lastSync!)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team Summary shortcut */}
      <button
        onClick={onViewStats}
        className="bg-surface-card border border-border-default rounded-xl p-5 text-left hover:border-accent/50 hover:bg-surface-raised transition-colors group"
      >
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={16} className="text-accent" />
          <p className="text-xs font-semibold text-[#c9a84c] uppercase tracking-widest">Team Summary</p>
        </div>
        <p className="text-sm text-text-secondary mb-4">
          View job distribution, BiS gaps by slot, and overall progress across all roster members.
        </p>
        <span className="text-sm font-medium text-accent group-hover:underline">View summary →</span>
      </button>

    </div>
  );
}
