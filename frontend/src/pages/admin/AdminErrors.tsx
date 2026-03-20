/**
 * Admin Error Log Page
 *
 * Displays grouped error entries with filtering, sorting, pagination,
 * expandable detail panels with individual occurrences, multi-select
 * with batch right-click actions, and multi-expand with shift+click.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../services/api';
import { Skeleton } from '../../components/ui/Skeleton';
import { ContextMenu } from '../../components/ui/ContextMenu';
import { Button } from '../../components/primitives/Button';
import { Badge } from '../../components/primitives/Badge';
import { SortableHeader } from '../../components/admin/SortableHeader';
import { toggleSort } from '../../components/admin/sortUtils';
import type { SortDirection } from '../../components/admin/sortUtils';
import type { ContextMenuItem } from '../../components/ui/ContextMenu';

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
type ErrorSortField = 'message' | 'errorType' | 'caught' | 'severity' | 'source' | 'count' | 'affectedUsers' | 'lastSeen' | 'isReviewed';

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

const HANDLED_ERROR_TYPES = new Set(['api_error']);

function isHandledError(errorType: string): boolean {
  return HANDLED_ERROR_TYPES.has(errorType);
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
  const [sortField, setSortField] = useState<ErrorSortField>('count');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [fetchError, setFetchError] = useState(false);

  const handleSort = (field: ErrorSortField) => {
    const result = toggleSort(field, sortField, sortDir);
    setSortField(result.field);
    setSortDir(result.direction);
  };

  // Multi-expand state
  const [expandedFingerprints, setExpandedFingerprints] = useState<Set<string>>(new Set());
  const [detailDataMap, setDetailDataMap] = useState<Map<string, ErrorDetailData>>(new Map());
  const [loadingFingerprints, setLoadingFingerprints] = useState<Set<string>>(new Set());
  const [markingReviewed, setMarkingReviewed] = useState(false);

  // Multi-select state
  const [selectedFingerprints, setSelectedFingerprints] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Collapsible stack traces in occurrences
  const [expandedStackTraces, setExpandedStackTraces] = useState<Set<number>>(new Set());

  const fetchErrors = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
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
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [page, sourceFilter, severityFilter, statusFilter]);

  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  // Reset page and selection when filters or sort changes
  useEffect(() => {
    setPage(1);
    setSelectedFingerprints(new Set());
    setLastSelectedIndex(null);
  }, [sourceFilter, severityFilter, statusFilter]);

  // Clear selection when page changes
  useEffect(() => {
    setSelectedFingerprints(new Set());
    setLastSelectedIndex(null);
  }, [page, sortField, sortDir]);

  // Fetch detail data for a fingerprint if not already cached
  const fetchDetailData = useCallback(async (fingerprint: string) => {
    setLoadingFingerprints((prev) => {
      const next = new Set(prev);
      next.add(fingerprint);
      return next;
    });

    try {
      const data = await api.get<ErrorDetailData>(
        `/api/admin/analytics/errors/${encodeURIComponent(fingerprint)}`
      );
      setDetailDataMap((prev) => {
        const next = new Map(prev);
        next.set(fingerprint, data);
        return next;
      });
    } catch {
      // Detail panel will show failed state
    } finally {
      setLoadingFingerprints((prev) => {
        const next = new Set(prev);
        next.delete(fingerprint);
        return next;
      });
    }
  }, []);

  // Expand/collapse with shift-key support for multi-expand
  const handleExpand = useCallback((fingerprint: string, shiftKey: boolean) => {
    const wasExpanded = expandedFingerprints.has(fingerprint);

    if (!shiftKey) {
      // Single-expand mode
      if (wasExpanded && expandedFingerprints.size === 1) {
        // Already expanded and only one: collapse it
        setExpandedFingerprints(new Set());
        setDetailDataMap(new Map());
      } else {
        // Collapse all, expand only this one
        setExpandedFingerprints(new Set([fingerprint]));
        // Keep only this fingerprint's detail data
        const existing = detailDataMap.get(fingerprint);
        if (existing) {
          setDetailDataMap(new Map([[fingerprint, existing]]));
        } else {
          setDetailDataMap(new Map());
          // Fetch detail data for newly expanded row
          fetchDetailData(fingerprint);
        }
      }
      setExpandedStackTraces(new Set());
    } else {
      // Multi-expand mode (shift+click): toggle this fingerprint
      if (wasExpanded) {
        // Collapse this row
        setExpandedFingerprints((prev) => {
          const next = new Set(prev);
          next.delete(fingerprint);
          return next;
        });
        setDetailDataMap((prev) => {
          const next = new Map(prev);
          next.delete(fingerprint);
          return next;
        });
      } else {
        // Expand this row
        setExpandedFingerprints((prev) => {
          const next = new Set(prev);
          next.add(fingerprint);
          return next;
        });
        // Fetch if not already cached
        if (!detailDataMap.has(fingerprint)) {
          fetchDetailData(fingerprint);
        }
      }
    }
  }, [expandedFingerprints, detailDataMap, fetchDetailData]);

  // Mark error as reviewed
  const handleMarkReviewed = useCallback(async (fingerprint: string) => {
    setMarkingReviewed(true);
    try {
      await api.post(`/api/admin/analytics/errors/${encodeURIComponent(fingerprint)}/review`);
      // Update detail data map
      setDetailDataMap((prev) => {
        const existing = prev.get(fingerprint);
        if (existing) {
          const next = new Map(prev);
          next.set(fingerprint, { ...existing, isReviewed: true });
          return next;
        }
        return prev;
      });
      // Refetch to get updated state from server
      await fetchErrors();
    } catch {
      // Silently fail - button stays enabled for retry
    } finally {
      setMarkingReviewed(false);
    }
  }, [fetchErrors]);

  // Unreview (re-open) an error
  const handleUnreview = useCallback(async (fingerprint: string) => {
    try {
      await api.post(`/api/admin/analytics/errors/${encodeURIComponent(fingerprint)}/unreview`);
      // Update detail data map
      setDetailDataMap((prev) => {
        const existing = prev.get(fingerprint);
        if (existing) {
          const next = new Map(prev);
          next.set(fingerprint, { ...existing, isReviewed: false });
          return next;
        }
        return prev;
      });
      // Refetch to get updated state from server
      await fetchErrors();
    } catch {
      // Silently handle
    }
  }, [fetchErrors]);

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

  // Sort errors client-side (must be defined before handlers that reference it)
  const sortedErrors = useMemo(() => {
    if (!errorList) return [];
    const mult = sortDir === 'asc' ? 1 : -1;
    return [...errorList.errors].sort((a, b) => {
      switch (sortField) {
        case 'message':
          return mult * a.message.localeCompare(b.message);
        case 'errorType':
          return mult * a.errorType.localeCompare(b.errorType);
        case 'caught':
          return mult * (Number(isHandledError(a.errorType)) - Number(isHandledError(b.errorType)));
        case 'severity':
          return mult * ((SEVERITY_ORDER[a.severity.toLowerCase()] ?? 0) -
            (SEVERITY_ORDER[b.severity.toLowerCase()] ?? 0));
        case 'source':
          return mult * a.source.localeCompare(b.source);
        case 'count':
          return mult * (a.count - b.count);
        case 'affectedUsers':
          return mult * (a.affectedUsers - b.affectedUsers);
        case 'lastSeen':
          return mult * (new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime());
        case 'isReviewed':
          return mult * (Number(a.isReviewed) - Number(b.isReviewed));
        default:
          return 0;
      }
    });
  }, [errorList, sortField, sortDir]);

  // Batch review handler for context menu actions
  const handleBatchReview = useCallback(async (action: 'review' | 'unreview') => {
    const fingerprints = Array.from(selectedFingerprints);
    if (fingerprints.length === 0) return;
    try {
      await api.post('/api/admin/analytics/errors/batch-review', { fingerprints, action });
      setSelectedFingerprints(new Set());
      setContextMenu(null);
      // Refetch to get updated state from server
      await fetchErrors();
    } catch {
      // Silently fail
    }
  }, [selectedFingerprints, statusFilter, fetchErrors]);

  // Selection handler for checkbox clicks (supports ctrl+click and shift+click range)
  const handleSelect = useCallback((fingerprint: string, event: React.MouseEvent) => {
    const currentIndex = sortedErrors.findIndex(e => e.fingerprint === fingerprint);

    if (event.shiftKey && lastSelectedIndex !== null) {
      // Range select — clamp indices to current list bounds
      const clampedLast = Math.min(lastSelectedIndex, sortedErrors.length - 1);
      const start = Math.min(clampedLast, currentIndex);
      const end = Math.max(clampedLast, currentIndex);
      setSelectedFingerprints((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          next.add(sortedErrors[i].fingerprint);
        }
        return next;
      });
    } else if (event.ctrlKey || event.metaKey) {
      // Toggle individual
      setSelectedFingerprints((prev) => {
        const next = new Set(prev);
        if (next.has(fingerprint)) {
          next.delete(fingerprint);
        } else {
          next.add(fingerprint);
        }
        return next;
      });
    } else {
      // Simple toggle (no modifier)
      setSelectedFingerprints((prev) => {
        const next = new Set(prev);
        if (next.has(fingerprint)) {
          next.delete(fingerprint);
        } else {
          next.add(fingerprint);
        }
        return next;
      });
    }
    setLastSelectedIndex(currentIndex);
  }, [lastSelectedIndex, sortedErrors]);

  // Select all / deselect all
  const handleSelectAll = useCallback(() => {
    if (selectedFingerprints.size > 0 && selectedFingerprints.size === sortedErrors.length) {
      // All selected: deselect all
      setSelectedFingerprints(new Set());
    } else {
      // Select all on current page
      setSelectedFingerprints(new Set(sortedErrors.map(e => e.fingerprint)));
    }
  }, [selectedFingerprints.size, sortedErrors]);

  // Context menu handler for rows
  const handleRowContextMenu = useCallback((fingerprint: string, event: React.MouseEvent) => {
    event.preventDefault();
    // If row is not already selected, auto-select just that row
    if (!selectedFingerprints.has(fingerprint)) {
      setSelectedFingerprints(new Set([fingerprint]));
    }
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, [selectedFingerprints]);

  // Build context menu items based on selection
  const contextMenuItems = useMemo((): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [];
    const selectedErrors = sortedErrors.filter(e => selectedFingerprints.has(e.fingerprint));
    const hasUnreviewed = selectedErrors.some(e => !e.isReviewed);
    const hasReviewed = selectedErrors.some(e => e.isReviewed);

    if (hasUnreviewed) {
      items.push({
        label: 'Mark Reviewed',
        onClick: () => handleBatchReview('review'),
      });
    }
    if (hasReviewed) {
      items.push({
        label: 'Re-open',
        onClick: () => handleBatchReview('unreview'),
      });
    }
    return items;
  }, [sortedErrors, selectedFingerprints, handleBatchReview]);

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

        {/* Selection count badge — always rendered to prevent layout shift */}
        <Badge variant="info" size="lg" className={selectedFingerprints.size > 0 ? '' : 'invisible'}>
          {selectedFingerprints.size || 0} selected
        </Badge>

      </div>

      {fetchError && (
        <div className="bg-surface-card border border-status-error/30 rounded-lg p-6 text-center">
          <p className="text-status-error mb-2">Failed to load error data</p>
          <Button variant="ghost" size="sm" onClick={() => fetchErrors()}>Retry</Button>
        </div>
      )}

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
                  <th className="px-2 py-2 w-8">
                    <input
                      type="checkbox"
                      aria-label="Select all errors on page"
                      checked={selectedFingerprints.size > 0 && selectedFingerprints.size === sortedErrors.length}
                      ref={(el) => { if (el) el.indeterminate = selectedFingerprints.size > 0 && selectedFingerprints.size < sortedErrors.length; }}
                      onChange={handleSelectAll}
                      className="rounded border-border-subtle text-accent focus:ring-accent cursor-pointer"
                    />
                  </th>
                  <SortableHeader<ErrorSortField> field="message" label="Message" currentField={sortField} currentDirection={sortDir} onSort={handleSort} />
                  <SortableHeader<ErrorSortField> field="errorType" label="Type" currentField={sortField} currentDirection={sortDir} onSort={handleSort} />
                  <SortableHeader<ErrorSortField> field="caught" label="Caught" currentField={sortField} currentDirection={sortDir} onSort={handleSort} align="center" />
                  <SortableHeader<ErrorSortField> field="severity" label="Severity" currentField={sortField} currentDirection={sortDir} onSort={handleSort} align="center" />
                  <SortableHeader<ErrorSortField> field="source" label="Source" currentField={sortField} currentDirection={sortDir} onSort={handleSort} align="center" />
                  <SortableHeader<ErrorSortField> field="count" label="Count" currentField={sortField} currentDirection={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader<ErrorSortField> field="affectedUsers" label="Users" currentField={sortField} currentDirection={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader<ErrorSortField> field="lastSeen" label="Last Seen" currentField={sortField} currentDirection={sortDir} onSort={handleSort} align="right" />
                  <SortableHeader<ErrorSortField> field="isReviewed" label="Status" currentField={sortField} currentDirection={sortDir} onSort={handleSort} align="center" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {sortedErrors.map((error) => (
                  <ErrorRow
                    key={error.fingerprint}
                    error={error}
                    isExpanded={expandedFingerprints.has(error.fingerprint)}
                    onToggle={(shiftKey: boolean) => handleExpand(error.fingerprint, shiftKey)}
                    detailData={detailDataMap.get(error.fingerprint) ?? null}
                    detailLoading={loadingFingerprints.has(error.fingerprint)}
                    markingReviewed={markingReviewed}
                    onMarkReviewed={handleMarkReviewed}
                    onUnreview={handleUnreview}
                    expandedStackTraces={expandedStackTraces}
                    onToggleStackTrace={toggleStackTrace}
                    isSelected={selectedFingerprints.has(error.fingerprint)}
                    onSelect={handleSelect}
                    onContextMenu={handleRowContextMenu}
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

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

// --- Error Row Sub-component ---

interface ErrorRowProps {
  error: ErrorGroup;
  isExpanded: boolean;
  onToggle: (shiftKey: boolean) => void;
  detailData: ErrorDetailData | null;
  detailLoading: boolean;
  markingReviewed: boolean;
  onMarkReviewed: (fingerprint: string) => void;
  onUnreview: (fingerprint: string) => void;
  expandedStackTraces: Set<number>;
  onToggleStackTrace: (id: number) => void;
  isSelected: boolean;
  onSelect: (fingerprint: string, event: React.MouseEvent) => void;
  onContextMenu: (fingerprint: string, event: React.MouseEvent) => void;
}

function ErrorRow({
  error,
  isExpanded,
  onToggle,
  detailData,
  detailLoading,
  markingReviewed,
  onMarkReviewed,
  onUnreview,
  expandedStackTraces,
  onToggleStackTrace,
  isSelected,
  onSelect,
  onContextMenu,
}: ErrorRowProps) {
  return (
    <>
      {/* Summary Row */}
      <tr
        className={`cursor-pointer transition-colors select-none ${
          isSelected
            ? 'bg-accent/5 shadow-[inset_2px_0_0_0_var(--color-accent)]'
            : isExpanded
              ? 'bg-surface-elevated'
              : 'hover:bg-surface-elevated'
        }`}
        onClick={(e) => {
          // Ctrl/Cmd+Click toggles selection
          if (e.ctrlKey || e.metaKey) {
            onSelect(error.fingerprint, e);
            return;
          }
          // Prevent text selection on shift+click
          if (e.shiftKey) {
            e.preventDefault();
          }
          // Shift+Click multi-expands
          onToggle(e.shiftKey);
        }}
        onContextMenu={(e) => onContextMenu(error.fingerprint, e)}
      >
        <td className="px-2 py-2 w-8" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            aria-label={`Select error: ${truncate(error.message, 40)}`}
            checked={isSelected}
            onChange={(e) => {
              onSelect(error.fingerprint, e as unknown as React.MouseEvent);
            }}
            onClick={(e) => e.stopPropagation()}
            className="rounded border-border-subtle text-accent focus:ring-accent cursor-pointer"
          />
        </td>
        <td className="px-4 py-2 text-sm text-text-primary max-w-xs">
          <span className="block truncate" title={error.message}>
            {truncate(error.message, 80)}
          </span>
        </td>
        <td className="px-4 py-2 text-sm text-text-secondary font-mono text-xs">
          {error.errorType}
        </td>
        <td className="px-4 py-2 text-center">
          {isHandledError(error.errorType) ? (
            <Badge variant="success" size="sm">Handled</Badge>
          ) : (
            <Badge variant="error" size="sm">Unhandled</Badge>
          )}
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
          <td colSpan={10} className="px-0 py-0">
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
                        {detailData.isReviewed ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUnreview(detailData.fingerprint);
                            }}
                            className="!min-h-0"
                          >
                            Re-open
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMarkReviewed(detailData.fingerprint);
                            }}
                            disabled={markingReviewed}
                            className="!min-h-0"
                          >
                            {markingReviewed ? 'Marking...' : 'Mark Reviewed'}
                          </Button>
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
