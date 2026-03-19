/**
 * Admin Usage Analytics Page
 *
 * Displays event distribution charts, tab visit breakdown,
 * and top events table. Fetches data from admin analytics endpoints.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { api } from '../../services/api';
import { Skeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/primitives/Button';

// --- Types ---

interface UsageEvent {
  eventName: string;
  category: string;
  count: number;
  uniqueUsers: number;
}

interface UsageData {
  events: UsageEvent[];
  totalEvents: number;
}

type TimeRange = '7d' | '30d' | '90d' | 'all';

type SortField = 'count' | 'uniqueUsers';

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'all', label: 'All' },
];

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  all: 'All time',
};

// Recharts requires inline hex colors for SVG elements (no Tailwind class support)
const CHART_ACCENT = '#14b8a6'; // design-system-ignore: Recharts SVG fill/stroke
const CHART_GRID = '#1e293b'; // design-system-ignore: Recharts SVG grid
const CHART_TICK = '#64748b'; // design-system-ignore: Recharts SVG tick
const CHART_TOOLTIP_BG = '#111827'; // design-system-ignore: Recharts tooltip
const CHART_TOOLTIP_BORDER = '1px solid #1e293b'; // design-system-ignore: Recharts tooltip
const CHART_TOOLTIP_TEXT = '#e2e8f0'; // design-system-ignore: Recharts tooltip

const TAB_COLORS = ['#14b8a6', '#5a9fd4', '#d45a5a', '#d4a05a', '#b45ad4', '#5ad490']; // design-system-ignore: Recharts SVG fill colors

// --- Component ---

export function AdminUsage() {
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('count');

  const fetchUsage = useCallback(async (range: TimeRange) => {
    setLoading(true);
    try {
      const data = await api.get<UsageData>(`/api/admin/analytics/usage?range=${range}`);
      setUsageData(data);
    } catch {
      // Data stays in loading state on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage(timeRange);
  }, [timeRange, fetchUsage]);

  // Derive category data for bar chart (exclude tab_switch events)
  const categoryData = useMemo(() => {
    if (!usageData) return [];
    const categoryMap = new Map<string, number>();
    for (const event of usageData.events) {
      if (event.eventName === 'tab_switch') continue;
      const current = categoryMap.get(event.category) ?? 0;
      categoryMap.set(event.category, current + event.count);
    }
    return Array.from(categoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }, [usageData]);

  // Derive top event names for pie chart.
  // NOTE: Tab-level breakdown (which tab was switched to) would require per-event-data
  // aggregation in the backend, which isn't available yet. Instead, show top event names
  // distribution which gives a useful overview of feature usage.
  const topEventData = useMemo(() => {
    if (!usageData || usageData.events.length === 0) return [];
    return usageData.events
      .slice(0, 6) // Top 6 event names (already sorted by count from backend)
      .map((e) => ({
        name: e.eventName,
        value: e.count,
      }));
  }, [usageData]);

  // Sorted events for the top events table
  const sortedEvents = useMemo(() => {
    if (!usageData) return [];
    return [...usageData.events]
      .sort((a, b) => b[sortField] - a[sortField])
      .slice(0, 20);
  }, [usageData, sortField]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display text-status-warning">Usage Analytics</h1>
          <p className="text-text-muted mt-1">{TIME_RANGE_LABELS[timeRange]}</p>
        </div>
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Event Distribution Bar Chart */}
        <div className="bg-surface-card border border-border-default rounded-lg p-4">
          <h2 className="text-lg font-display font-semibold text-text-primary mb-4">
            Event Distribution
          </h2>
          {loading || !usageData ? (
            <Skeleton className="h-[300px] w-full" />
          ) : categoryData.length === 0 ? (
            <p className="text-text-muted text-center py-12">No event data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis
                  type="number"
                  tick={{ fill: CHART_TICK, fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  tick={{ fill: CHART_TICK, fontSize: 11 }}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    background: CHART_TOOLTIP_BG,
                    border: CHART_TOOLTIP_BORDER,
                    borderRadius: 8,
                    color: CHART_TOOLTIP_TEXT,
                  }}
                />
                <Bar dataKey="count" fill={CHART_ACCENT} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top Events Pie Chart */}
        <div className="bg-surface-card border border-border-default rounded-lg p-4">
          <h2 className="text-lg font-display font-semibold text-text-primary mb-4">
            Top Events
          </h2>
          {loading || !usageData ? (
            <Skeleton className="h-[300px] w-full" />
          ) : topEventData.length === 0 ? (
            <p className="text-text-muted text-center py-12">No event data available</p>
          ) : (
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={topEventData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={110}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                  >
                    {topEventData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={TAB_COLORS[index % TAB_COLORS.length]}  // design-system-ignore: Recharts SVG fill
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: CHART_TOOLTIP_BG,
                      border: CHART_TOOLTIP_BORDER,
                      borderRadius: 8,
                      color: CHART_TOOLTIP_TEXT,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Top Events Table */}
      <div className="bg-surface-card border border-border-default rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
          <h2 className="text-lg font-display font-semibold text-text-primary">
            Top Events
            {usageData && (
              <span className="text-text-muted text-sm font-normal ml-2">
                ({usageData.totalEvents.toLocaleString()} total)
              </span>
            )}
          </h2>
          <div className="flex gap-1">
            <Button
              variant={sortField === 'count' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setSortField('count')}
              className="!px-2 !py-1 !text-xs !min-h-0"
            >
              By Count
            </Button>
            <Button
              variant={sortField === 'uniqueUsers' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setSortField('uniqueUsers')}
              className="!px-2 !py-1 !text-xs !min-h-0"
            >
              By Users
            </Button>
          </div>
        </div>
        {loading || !usageData ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-40 flex-1" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : sortedEvents.length === 0 ? (
          <p className="text-text-muted text-center py-8">No event data available</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-elevated">
                <th className="text-left px-4 py-2 text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Event Name
                </th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Category
                </th>
                <th className="text-right px-4 py-2 text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Count
                </th>
                <th className="text-right px-4 py-2 text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Unique Users
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {sortedEvents.map((event) => (
                <tr
                  key={`${event.category}-${event.eventName}`}
                  className="hover:bg-surface-elevated transition-colors"
                >
                  <td className="px-4 py-2 text-sm text-text-primary font-mono">
                    {event.eventName}
                  </td>
                  <td className="px-4 py-2 text-sm text-text-secondary">
                    {event.category}
                  </td>
                  <td className="px-4 py-2 text-sm text-text-secondary text-right tabular-nums">
                    {event.count.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-sm text-text-secondary text-right tabular-nums">
                    {event.uniqueUsers.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
