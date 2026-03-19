/**
 * Admin Error Log Page
 *
 * Displays grouped error entries with filtering, sorting, pagination,
 * and expandable detail panels with individual occurrences.
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { Skeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/primitives/Button';
import { Badge } from '../../components/primitives/Badge';

// --- Types ---

interface ErrorGroup {
  fingerprint: string;
  message: string;
  errorType: string;
  severity: string;
  source: string;
  count: number;
  affectedUsers: number;
  firstSeen: string;
  lastSeen: string;
  isReviewed: boolean;
}

interface ErrorListData {
  errors: ErrorGroup[];
  total: number;
  page: number;
  pageSize: number;
}

interface ErrorOccurrence {
  id: number;
  userId: string | null;
  sessionId: string | null;
  message: string;
  stackTrace: string | null;
  context: Record<string, unknown>;
  severity: string;
  source: string;
  createdAt: string;
}

interface ErrorDetailData {
  fingerprint: string;
  message: string;
  errorType: string;
  count: number;
  affectedUsers: number;
  firstSeen: string;
  lastSeen: string;
  isReviewed: boolean;
  occurrences: ErrorOccurrence[];
}

type SourceFilter = 'all' | 'frontend' | 'backend';
type SeverityFilter = 'all' | 'warning' | 'error' | 'critical';
type StatusFilter = 'all' | 'unreviewed' | 'reviewed';
type SortField = 'count' | 'lastSeen' | 'severity';

const SOURCE_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'frontend', label: 'Frontend' },
  { value: 'backend', label: 'Backend' },
];

const SEVERITY_OPTIONS: { value: SeverityFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Error' },
  { value: 'critical', label: 'Critical' },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unreviewed', label: 'Unreviewed' },
  { value: 'reviewed', label: 'Reviewed' },
];

const SEVERITY_ORDER: Record<string, number> = {
  critical: 3,
  error: 2,
  warning: 1,
};

const PAGE_SIZE = 20;

// --- Helpers ---

function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function severityBadgeVariant(severity: string): 'warning' | 'error' | 'default' {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'error';
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    default:
      return 'default';
  }
}

function sourceBadgeVariant(source: string): 'info' | 'default' {
  switch (source.toLowerCase()) {
    case 'frontend':
      return 'info';
    case 'backend':
      return 'default';
    default:
      return 'default';
  }
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

// --- Component ---

export function AdminErrors() {
  const [errorList, setErrorList] = useState<ErrorListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<SortField>('count');

  // Expanded row state
  const [expandedFingerprint, setExpandedFingerprint] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<ErrorDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [markingReviewed, setMarkingReviewed] = useState(false);

  // Collapsible stack traces in occurrences
  const [expandedStackTraces, setExpandedStackTraces] = useState<Set<number>>(new Set());

  const fetchErrors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(PAGE_SIZE),
      });
      if (sourceFilter !== 'all') params.set('source', sourceFilter);
      if (severityFilter !== 'all') params.set('severity', severityFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const data = await api.get<ErrorListData>(`/api/admin/analytics/errors?${params.toString()}`);
      setErrorList(data);
    } catch {
      // Table stays in loading state on error
    } finally {
      setLoading(false);
    }
  }, [page, sourceFilter, severityFilter, statusFilter]);

  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [sourceFilter, severityFilter, statusFilter]);

  // Fetch detail when expanding a row
  const handleExpand = useCallback(async (fingerprint: string) => {
    if (expandedFingerprint === fingerprint) {
      setExpandedFingerprint(null);
      setDetailData(null);
      setExpandedStackTraces(new Set());
      return;
    }

    setExpandedFingerprint(fingerprint);
    setDetailLoading(true);
    setDetailData(null);
    setExpandedStackTraces(new Set());

    try {
      const data = await api.get<ErrorDetailData>(
        `/api/admin/analytics/errors/${encodeURIComponent(fingerprint)}`
      );
      setDetailData(data);
    } catch {
      // Detail panel will show loading state
    } finally {
      setDetailLoading(false);
    }
  }, [expandedFingerprint]);

  // Mark error as reviewed
  const handleMarkReviewed = useCallback(async (fingerprint: string) => {
    setMarkingReviewed(true);
    try {
      await api.post(`/api/admin/analytics/errors/${encodeURIComponent(fingerprint)}/review`);
      // Update local state
      if (detailData && detailData.fingerprint === fingerprint) {
        setDetailData({ ...detailData, isReviewed: true });
      }
      if (errorList) {
        setErrorList({
          ...errorList,
          errors: errorList.errors.map((e) =>
            e.fingerprint === fingerprint ? { ...e, isReviewed: true } : e
          ),
        });
      }
    } catch {
      // Silently fail - button stays enabled for retry
    } finally {
      setMarkingReviewed(false);
    }
  }, [detailData, errorList]);

  // Toggle stack trace visibility
  const toggleStackTrace = useCallback((occurrenceId: number) => {
    setExpandedStackTraces((prev) => {
      const next = new Set(prev);
      if (next.has(occurrenceId)) {
        next.delete(occurrenceId);
      } else {
        next.add(occurrenceId);
      }
      return next;
    });
  }, []);

  // Sort errors client-side
  const sortedErrors = errorList
    ? [...errorList.errors].sort((a, b) => {
        switch (sortField) {
          case 'count':
            return b.count - a.count;
          case 'lastSeen':
            return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
          case 'severity':
            return (SEVERITY_ORDER[b.severity.toLowerCase()] ?? 0) -
              (SEVERITY_ORDER[a.severity.toLowerCase()] ?? 0);
          default:
            return 0;
        }
      })
    : [];

  // Count unreviewed for the header badge
  const unreviewedCount = errorList
    ? errorList.errors.filter((e) => !e.isReviewed).length
    : 0;

  const totalPages = errorList ? Math.ceil(errorList.total / PAGE_SIZE) : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-display text-status-warning">Error Log</h1>
          {!loading && unreviewedCount > 0 && (
            <Badge variant="error" size="lg">
              {unreviewedCount} unreviewed
            </Badge>
          )}
        </div>
        <p className="text-text-muted mt-1">
          {errorList
            ? `${errorList.total} error group${errorList.total !== 1 ? 's' : ''} found`
            : 'Loading errors...'}
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Source Filter */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-text-muted uppercase tracking-wider mr-1">Source:</span>
          {SOURCE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={sourceFilter === opt.value ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setSourceFilter(opt.value)}
              className="!px-2 !py-1 !text-xs !min-h-0"
            >
              {opt.label}
            </Button>
          ))}
        </div>

        {/* Severity Filter */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-text-muted uppercase tracking-wider mr-1">Severity:</span>
          {SEVERITY_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={severityFilter === opt.value ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setSeverityFilter(opt.value)}
              className="!px-2 !py-1 !text-xs !min-h-0"
            >
              {opt.label}
            </Button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-text-muted uppercase tracking-wider mr-1">Status:</span>
          {STATUS_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={statusFilter === opt.value ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter(opt.value)}
              className="!px-2 !py-1 !text-xs !min-h-0"
            >
              {opt.label}
            </Button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-xs text-text-muted uppercase tracking-wider mr-1">Sort:</span>
          <Button
            variant={sortField === 'count' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setSortField('count')}
            className="!px-2 !py-1 !text-xs !min-h-0"
          >
            Count
          </Button>
          <Button
            variant={sortField === 'lastSeen' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setSortField('lastSeen')}
            className="!px-2 !py-1 !text-xs !min-h-0"
          >
            Last Seen
          </Button>
          <Button
            variant={sortField === 'severity' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setSortField('severity')}
            className="!px-2 !py-1 !text-xs !min-h-0"
          >
            Severity
          </Button>
        </div>
      </div>

      {/* Error Groups Table */}
      <div className="bg-surface-card border border-border-default rounded-lg overflow-hidden">
        {loading || !errorList ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-64 flex-1" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : sortedErrors.length === 0 ? (
          <p className="text-text-muted text-center py-8">No errors match the current filters</p>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-elevated">
                  <th className="text-left px-4 py-2 text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Message
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Source
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Count
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Users
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Last Seen
                  </th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {sortedErrors.map((error) => (
                  <ErrorRow
                    key={error.fingerprint}
                    error={error}
                    isExpanded={expandedFingerprint === error.fingerprint}
                    onToggle={() => handleExpand(error.fingerprint)}
                    detailData={
                      expandedFingerprint === error.fingerprint ? detailData : null
                    }
                    detailLoading={
                      expandedFingerprint === error.fingerprint && detailLoading
                    }
                    markingReviewed={markingReviewed}
                    onMarkReviewed={handleMarkReviewed}
                    expandedStackTraces={expandedStackTraces}
                    onToggleStackTrace={toggleStackTrace}
                  />
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border-subtle">
                <p className="text-sm text-text-muted">
                  Page {page} of {totalPages} ({errorList.total} total)
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="!px-3 !py-1 !text-xs !min-h-0"
                  >
                    Prev
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="!px-3 !py-1 !text-xs !min-h-0"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// --- Error Row Sub-component ---

interface ErrorRowProps {
  error: ErrorGroup;
  isExpanded: boolean;
  onToggle: () => void;
  detailData: ErrorDetailData | null;
  detailLoading: boolean;
  markingReviewed: boolean;
  onMarkReviewed: (fingerprint: string) => void;
  expandedStackTraces: Set<number>;
  onToggleStackTrace: (id: number) => void;
}

function ErrorRow({
  error,
  isExpanded,
  onToggle,
  detailData,
  detailLoading,
  markingReviewed,
  onMarkReviewed,
  expandedStackTraces,
  onToggleStackTrace,
}: ErrorRowProps) {
  return (
    <>
      {/* Summary Row */}
      <tr
        className={`cursor-pointer transition-colors ${
          isExpanded ? 'bg-surface-elevated' : 'hover:bg-surface-elevated'
        }`}
        onClick={onToggle}
      >
        <td className="px-4 py-2 text-sm text-text-primary max-w-xs">
          <span className="block truncate" title={error.message}>
            {truncate(error.message, 80)}
          </span>
        </td>
        <td className="px-4 py-2 text-sm text-text-secondary font-mono text-xs">
          {error.errorType}
        </td>
        <td className="px-4 py-2 text-center">
          <Badge variant={severityBadgeVariant(error.severity)} size="sm">
            {error.severity}
          </Badge>
        </td>
        <td className="px-4 py-2 text-center">
          <Badge variant={sourceBadgeVariant(error.source)} size="sm">
            {error.source}
          </Badge>
        </td>
        <td className="px-4 py-2 text-sm text-text-secondary text-right tabular-nums">
          {error.count.toLocaleString()}
        </td>
        <td className="px-4 py-2 text-sm text-text-secondary text-right tabular-nums">
          {error.affectedUsers}
        </td>
        <td className="px-4 py-2 text-sm text-text-muted text-right whitespace-nowrap">
          {relativeTime(error.lastSeen)}
        </td>
        <td className="px-4 py-2 text-center">
          {error.isReviewed ? (
            <span className="text-xs text-status-success">Reviewed</span>
          ) : (
            <span className="text-xs text-status-warning">Unreviewed</span>
          )}
        </td>
      </tr>

      {/* Detail Panel (expanded) */}
      {isExpanded && (
        <tr>
          <td colSpan={8} className="px-0 py-0">
            <div className="bg-surface-base border-t border-border-subtle p-4 space-y-4">
              {detailLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : detailData ? (
                <>
                  {/* Error Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div>
                        <span className="text-xs text-text-muted uppercase tracking-wider">Full Message</span>
                        <p className="text-sm text-text-primary mt-1 break-words">
                          {detailData.message}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-text-muted uppercase tracking-wider">Fingerprint</span>
                        <p className="text-xs text-text-secondary mt-1 font-mono truncate" title={detailData.fingerprint}>
                          {detailData.fingerprint}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex gap-6">
                        <div>
                          <span className="text-xs text-text-muted uppercase tracking-wider">First Seen</span>
                          <p className="text-sm text-text-secondary mt-1">
                            {new Date(detailData.firstSeen).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-text-muted uppercase tracking-wider">Last Seen</span>
                          <p className="text-sm text-text-secondary mt-1">
                            {new Date(detailData.lastSeen).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 pt-2">
                        {!detailData.isReviewed && (
                          <Button
                            variant="success"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMarkReviewed(detailData.fingerprint);
                            }}
                            loading={markingReviewed}
                            className="!min-h-0"
                          >
                            Mark Reviewed
                          </Button>
                        )}
                        {detailData.isReviewed && (
                          <Badge variant="success" size="lg">Reviewed</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Occurrences Sub-table */}
                  {detailData.occurrences.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary mb-2">
                        Recent Occurrences ({detailData.occurrences.length})
                      </h3>
                      <div className="border border-border-subtle rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-surface-elevated border-b border-border-subtle">
                              <th className="text-left px-3 py-1.5 text-xs font-medium text-text-secondary uppercase tracking-wider">
                                Time
                              </th>
                              <th className="text-left px-3 py-1.5 text-xs font-medium text-text-secondary uppercase tracking-wider">
                                User ID
                              </th>
                              <th className="text-center px-3 py-1.5 text-xs font-medium text-text-secondary uppercase tracking-wider">
                                Severity
                              </th>
                              <th className="text-left px-3 py-1.5 text-xs font-medium text-text-secondary uppercase tracking-wider">
                                Stack Trace
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-subtle">
                            {detailData.occurrences.map((occ) => (
                              <OccurrenceRow
                                key={occ.id}
                                occurrence={occ}
                                isStackExpanded={expandedStackTraces.has(occ.id)}
                                onToggleStack={() => onToggleStackTrace(occ.id)}
                              />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-text-muted text-sm">Failed to load error details</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// --- Occurrence Row Sub-component ---

interface OccurrenceRowProps {
  occurrence: ErrorOccurrence;
  isStackExpanded: boolean;
  onToggleStack: () => void;
}

function OccurrenceRow({ occurrence, isStackExpanded, onToggleStack }: OccurrenceRowProps) {
  return (
    <>
      <tr className="hover:bg-surface-elevated transition-colors">
        <td className="px-3 py-1.5 text-xs text-text-secondary whitespace-nowrap">
          {relativeTime(occurrence.createdAt)}
        </td>
        <td className="px-3 py-1.5 text-xs text-text-secondary font-mono">
          {occurrence.userId ? truncate(occurrence.userId, 12) : '-'}
        </td>
        <td className="px-3 py-1.5 text-center">
          <Badge variant={severityBadgeVariant(occurrence.severity)} size="sm">
            {occurrence.severity}
          </Badge>
        </td>
        <td className="px-3 py-1.5">
          {occurrence.stackTrace ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onToggleStack();
              }}
              className="!px-2 !py-0.5 !text-xs !min-h-0"
            >
              {isStackExpanded ? 'Hide' : 'Show'}
            </Button>
          ) : (
            <span className="text-xs text-text-muted">-</span>
          )}
        </td>
      </tr>
      {/* Stack trace expansion */}
      {isStackExpanded && occurrence.stackTrace && (
        <tr>
          <td colSpan={4} className="px-3 py-2 bg-surface-base">
            <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap break-words max-h-48 overflow-y-auto p-2 bg-surface-card rounded border border-border-subtle">
              {occurrence.stackTrace}
            </pre>
            {Object.keys(occurrence.context).length > 0 && (
              <div className="mt-2">
                <span className="text-xs text-text-muted uppercase tracking-wider">Context</span>
                <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap break-words mt-1 p-2 bg-surface-card rounded border border-border-subtle">
                  {JSON.stringify(occurrence.context, null, 2)}
                </pre>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
