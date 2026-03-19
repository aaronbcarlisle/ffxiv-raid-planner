/**
 * Admin Overview Page
 *
 * Dashboard view with KPI cards, growth charts (Recharts),
 * and top users/statics tables. Fetches data from admin analytics endpoints.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { api } from '../../services/api';
import { AdminKpiCard } from '../../components/admin/AdminKpiCard';
import { Skeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/primitives/Button';

// --- Types ---

interface OverviewData {
  totalUsers: number;
  totalUsersChange: number;
  activeStatics: number;
  activeStaticsChange: number;
  avgCardsPerStatic: number;
  errors24h: number;
}

interface GrowthPoint {
  date: string;
  count: number;
}

interface GrowthData {
  users: GrowthPoint[];
  statics: GrowthPoint[];
}

interface TopUser {
  id: string;
  discordUsername: string;
  displayName: string | null;
  avatarUrl: string | null;
  staticsCreated: number;
  staticsJoined: number;
}

interface TopStatic {
  id: string;
  name: string;
  memberCount: number;
  lootEntries: number;
  lastLogDate: string | null;
}

type TimeRange = '7d' | '30d' | '90d' | 'all';

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'all', label: 'All' },
];

// Recharts requires inline hex colors for SVG elements (no Tailwind class support)
const CHART_ACCENT = '#14b8a6'; // design-system-ignore: Recharts SVG fill/stroke
const CHART_GRID = '#1e293b'; // design-system-ignore: Recharts SVG grid
const CHART_TICK = '#64748b'; // design-system-ignore: Recharts SVG tick
const CHART_TOOLTIP_BG = '#111827'; // design-system-ignore: Recharts tooltip
const CHART_TOOLTIP_BORDER = '1px solid #1e293b'; // design-system-ignore: Recharts tooltip
const CHART_TOOLTIP_TEXT = '#e2e8f0'; // design-system-ignore: Recharts tooltip

// --- Component ---

export function AdminOverview() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [growthData, setGrowthData] = useState<GrowthData | null>(null);
  const [topUsers, setTopUsers] = useState<TopUser[] | null>(null);
  const [topStatics, setTopStatics] = useState<TopStatic[] | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingGrowth, setLoadingGrowth] = useState(true);
  const [loadingTables, setLoadingTables] = useState(true);

  // Fetch overview KPIs
  const fetchOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const data = await api.get<OverviewData>('/api/admin/analytics/overview');
      setOverview(data);
    } catch {
      // Silently handle - cards will show loading then empty
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // Fetch growth data when time range changes
  const fetchGrowth = useCallback(async (range: TimeRange) => {
    setLoadingGrowth(true);
    try {
      const data = await api.get<GrowthData>(`/api/admin/analytics/growth?range=${range}`);
      setGrowthData(data);
    } catch {
      // Charts stay in loading state
    } finally {
      setLoadingGrowth(false);
    }
  }, []);

  useEffect(() => {
    fetchGrowth(timeRange);
  }, [timeRange, fetchGrowth]);

  // Fetch top users and statics
  const fetchTables = useCallback(async () => {
    setLoadingTables(true);
    try {
      const [users, statics] = await Promise.all([
        api.get<TopUser[]>('/api/admin/analytics/top-users?limit=10'),
        api.get<TopStatic[]>('/api/admin/analytics/top-statics?limit=10'),
      ]);
      setTopUsers(users);
      setTopStatics(statics);
    } catch {
      // Tables stay in loading state
    } finally {
      setLoadingTables(false);
    }
  }, []);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const formatChange = (value: number): { text: string; direction: 'up' | 'down' | 'neutral' } => {
    if (value > 0) return { text: `+${value} this week`, direction: 'up' };
    if (value < 0) return { text: `${value} this week`, direction: 'down' };
    return { text: 'No change', direction: 'neutral' };
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-display text-status-warning">Admin Overview</h1>
        <p className="text-text-muted mt-1">System health and growth at a glance</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingOverview || !overview ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface-card border border-border-default rounded-lg p-4 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))
        ) : (
          <>
            <AdminKpiCard
              label="Total Users"
              value={overview.totalUsers}
              change={formatChange(overview.totalUsersChange).text}
              changeDirection={formatChange(overview.totalUsersChange).direction}
            />
            <AdminKpiCard
              label="Active Statics"
              value={overview.activeStatics}
              change={formatChange(overview.activeStaticsChange).text}
              changeDirection={formatChange(overview.activeStaticsChange).direction}
            />
            <AdminKpiCard
              label="Avg Cards/Static"
              value={overview.avgCardsPerStatic.toFixed(1)}
            />
            <AdminKpiCard
              label="Errors (24h)"
              value={overview.errors24h}
              changeDirection={overview.errors24h > 0 ? 'down' : 'neutral'}
              change={overview.errors24h > 0 ? 'Needs attention' : 'All clear'}
            />
          </>
        )}
      </div>

      {/* Growth Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <div className="bg-surface-card border border-border-default rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold text-text-primary">User Growth</h2>
            <div className="flex gap-1">
              {TIME_RANGES.map((r) => (
                <Button
                  key={r.value}
                  variant={timeRange === r.value ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setTimeRange(r.value)}
                  className="!px-2 !py-1 !text-xs !min-h-0"
                >
                  {r.label}
                </Button>
              ))}
            </div>
          </div>
          {loadingGrowth || !growthData ? (
            <Skeleton className="h-[200px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={growthData.users}>
                <defs>
                  <linearGradient id="tealGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_ACCENT} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_ACCENT} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="date" tick={{ fill: CHART_TICK, fontSize: 11 }} />
                <YAxis tick={{ fill: CHART_TICK, fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: CHART_TOOLTIP_BG,
                    border: CHART_TOOLTIP_BORDER,
                    borderRadius: 8,
                    color: CHART_TOOLTIP_TEXT,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke={CHART_ACCENT}
                  fill="url(#tealGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Static Creation Chart */}
        <div className="bg-surface-card border border-border-default rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold text-text-primary">Static Creation</h2>
            <div className="flex gap-1">
              {TIME_RANGES.map((r) => (
                <Button
                  key={r.value}
                  variant={timeRange === r.value ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setTimeRange(r.value)}
                  className="!px-2 !py-1 !text-xs !min-h-0"
                >
                  {r.label}
                </Button>
              ))}
            </div>
          </div>
          {loadingGrowth || !growthData ? (
            <Skeleton className="h-[200px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={growthData.statics}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="date" tick={{ fill: CHART_TICK, fontSize: 11 }} />
                <YAxis tick={{ fill: CHART_TICK, fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: CHART_TOOLTIP_BG,
                    border: CHART_TOOLTIP_BORDER,
                    borderRadius: 8,
                    color: CHART_TOOLTIP_TEXT,
                  }}
                />
                <Bar dataKey="count" fill={CHART_ACCENT} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top Users + Top Statics Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Users */}
        <div className="bg-surface-card border border-border-default rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle">
            <h2 className="text-lg font-display font-semibold text-text-primary">Top Users</h2>
          </div>
          {loadingTables || !topUsers ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <Skeleton className="h-4 w-24 flex-1" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          ) : topUsers.length === 0 ? (
            <p className="text-text-muted text-center py-8">No user data available</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-elevated">
                  <th className="text-left px-4 py-2 text-xs font-medium text-text-secondary uppercase tracking-wider">
                    User
                  </th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Created
                  </th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Joined
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {topUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-elevated transition-colors">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        {u.avatarUrl ? (
                          <img
                            src={u.avatarUrl}
                            alt=""
                            className="w-6 h-6 rounded-full"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-surface-elevated flex items-center justify-center text-xs text-text-muted">
                            {(u.displayName || u.discordUsername).charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm text-text-primary truncate">
                          {u.displayName || u.discordUsername}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center text-sm text-text-secondary">
                      {u.staticsCreated}
                    </td>
                    <td className="px-4 py-2 text-center text-sm text-text-secondary">
                      {u.staticsJoined}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Top Statics */}
        <div className="bg-surface-card border border-border-default rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle">
            <h2 className="text-lg font-display font-semibold text-text-primary">Top Statics</h2>
          </div>
          {loadingTables || !topStatics ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-32 flex-1" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : topStatics.length === 0 ? (
            <p className="text-text-muted text-center py-8">No static data available</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-elevated">
                  <th className="text-left px-4 py-2 text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Members
                  </th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Loot Entries
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Last Log
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {topStatics.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-elevated transition-colors">
                    <td className="px-4 py-2">
                      <span className="text-sm text-accent font-medium truncate">
                        {s.name}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center text-sm text-text-secondary">
                      {s.memberCount}
                    </td>
                    <td className="px-4 py-2 text-center text-sm text-text-secondary">
                      {s.lootEntries}
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-text-muted">
                      {s.lastLogDate
                        ? new Date(s.lastLogDate).toLocaleDateString()
                        : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
