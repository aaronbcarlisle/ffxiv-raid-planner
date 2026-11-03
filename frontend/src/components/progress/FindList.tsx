/**
 * FindList — the Find view's list (S2a-4a·A2b, R-F-5, D-3, D-10): the search box, three filter
 * groups, "Wanted by your static", "All farm sources", then the footer. Presentational: the page
 * owns the query, the filters, the open row and the fetches, and hands in the built `list`.
 *
 * Wanted shows P-55's line while nothing is wanted at all (no search or filter set), nothing when a
 * search or filter leaves no wanted match, and the inline error with Retry when the suggestions
 * failed (E-5). A failed catalog shows the built-in farms with its own Retry above the lists (P-67).
 */
import { useId, type ReactNode, type RefObject } from 'react';
import { AlertCircle, Search, X } from 'lucide-react';
import { Button } from '../primitives/Button';
import { IconButton } from '../primitives/IconButton';
import { Input } from '../ui/Input';
import { Tag } from '../ui/Tag';
import { CATEGORY_BADGE, EXPANSION_FULL, EXPANSION_KEYS, SOURCE_TYPE_BADGE } from '../../utils/collectionBadgeConfig';
import { hasFilters, type FindFilters, type FindItem, type FindList as FindListModel } from '../../utils/findModel';
import { FindRow } from './FindRow';

const SOURCE_ORDER = ['ultimate', 'savage', 'extreme', 'criterion', 'chaotic_alliance', 'collaboration', 'field_operation'];

const P55 = 'Nobody in your static has shared a want yet. Members add wants from Find or their Hub.';

interface FindListProps {
  list: FindListModel;
  query: string;
  onQuery: (query: string) => void;
  filters: FindFilters;
  onFilters: (filters: FindFilters) => void;
  /** The row's action; `() => null` while Find is read-only. */
  renderAction: (item: FindItem) => ReactNode;
  /** Roster names by user id (`memberNames`). */
  names: Map<string, string>;
  expandedId: string | null;
  onExpand: (id: string) => void;
  footer?: ReactNode;
  /** The suggestions fetch failed: the wanted section shows this with Retry (E-5). */
  error: string | null;
  onRetry: () => void;
  /** The live catalog failed or came back empty: the built-in farms are showing (P-67). */
  catalogFallback: boolean;
  onRetryCatalog: () => void;
  searchRef: RefObject<HTMLInputElement | null>;
  /** A viewer's rows show no token counts (B1, P-58). */
  readerIsViewer: boolean;
  /** The catalog or the suggestions have not come back yet. */
  loading?: boolean;
}

interface Group {
  key: keyof FindFilters;
  label: 'Category' | 'Source' | 'Expansion';
  order: readonly string[];
  tagLabel: (value: string) => string;
  counts: Record<string, number>;
}

/** The chips of one group: its known values in order, then any other value seen. A zero count hides a chip unless it is the set one. */
function chipValues(group: Group, selected: string | null): string[] {
  const extra = Object.keys(group.counts)
    .filter((v) => !group.order.includes(v))
    .sort();
  return [...group.order, ...extra, ...(selected !== null ? [selected] : [])]
    .filter((v, i, all) => all.indexOf(v) === i)
    .filter((v) => (group.counts[v] ?? 0) > 0 || v === selected);
}

export function FindList({
  list,
  query,
  onQuery,
  filters,
  onFilters,
  renderAction,
  names,
  expandedId,
  onExpand,
  footer,
  error,
  onRetry,
  catalogFallback,
  onRetryCatalog,
  searchRef,
  readerIsViewer,
  loading = false,
}: FindListProps) {
  const wantedHeadingId = useId();
  const allHeadingId = useId();
  const filtered = hasFilters(filters);
  const searching = query.trim() !== '';

  const groups: Group[] = [
    { key: 'category', label: 'Category', order: Object.keys(CATEGORY_BADGE), tagLabel: (v) => CATEGORY_BADGE[v]?.label ?? v, counts: list.counts.byCategory },
    { key: 'source', label: 'Source', order: SOURCE_ORDER, tagLabel: (v) => SOURCE_TYPE_BADGE[v]?.label ?? v, counts: list.counts.bySource },
    { key: 'expansion', label: 'Expansion', order: EXPANSION_KEYS, tagLabel: (v) => EXPANSION_FULL[v] ?? v, counts: list.counts.byExpansion },
  ];

  const rows = (items: FindItem[]) => (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <FindRow
          key={item.id}
          item={item}
          names={names}
          expanded={expandedId === item.id}
          onToggle={() => onExpand(item.id)}
          action={renderAction(item)}
          readerIsViewer={readerIsViewer}
        />
      ))}
    </ul>
  );

  const showWanted = error !== null || list.wanted.length > 0 || (!list.anyWanted && !searching && !filtered && !loading);
  const noMatches = !loading && list.wanted.length === 0 && list.all.length === 0 && (searching || filtered);

  return (
    <div className="space-y-4">
      {catalogFallback && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-status-warning/30 bg-status-warning/10 px-4 py-2.5 text-sm text-text-primary">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-status-warning" aria-hidden />
          <span className="flex-1">The farm catalog is unavailable, so these are the built-in farms.</span>
          <Button variant="secondary" size="sm" onClick={onRetryCatalog}>
            Retry
          </Button>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <Input
          ref={searchRef}
          value={query}
          onChange={onQuery}
          fullWidth
          maxLength={200}
          leftIcon={<Search className="h-4 w-4" aria-hidden />}
          placeholder="Search farms, duties, rewards or tokens…"
          aria-label="Search farms"
        />
        {query.length > 0 && (
          <IconButton aria-label="Clear search" variant="ghost" size="sm" icon={<X className="h-4 w-4" aria-hidden />} onClick={() => onQuery('')} />
        )}
      </div>

      <div className="space-y-2">
        {groups.map((group) => (
          <div key={group.key} role="group" aria-label={group.label} className="flex flex-wrap items-center gap-1.5">
            <span aria-hidden className="w-20 text-xs uppercase tracking-wide text-text-muted">
              {group.label}
            </span>
            <Tag variant="filter" tone="accent" pressed={filters[group.key] === null} onClick={() => onFilters({ ...filters, [group.key]: null })}>
              All
            </Tag>
            {chipValues(group, filters[group.key]).map((value) => (
              <Tag
                key={value}
                variant="filter"
                tone="accent"
                pressed={filters[group.key] === value}
                onClick={() => onFilters({ ...filters, [group.key]: value })}
              >
                {`${group.tagLabel(value)} ${group.counts[value] ?? 0}`}
              </Tag>
            ))}
          </div>
        ))}
        {filtered && (
          <Button variant="secondary" size="sm" onClick={() => onFilters({ category: null, source: null, expansion: null })}>
            Clear filters
          </Button>
        )}
      </div>

      {loading && (
        <p role="status" className="px-1 text-sm text-text-secondary">
          Loading the farm list…
        </p>
      )}

      {showWanted && (
        <section aria-labelledby={wantedHeadingId} className="space-y-2">
          <h2 id={wantedHeadingId} className="text-sm font-semibold text-text-primary">
            {error !== null ? 'Wanted by your static' : `Wanted by your static (${list.counts.wanted})`}
          </h2>
          {error !== null ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-text-primary">
              <span>{`Couldn't load what your static wants: ${error}`}</span>
              <Button variant="secondary" size="sm" onClick={onRetry}>
                Retry
              </Button>
            </div>
          ) : list.wanted.length > 0 ? (
            rows(list.wanted)
          ) : (
            <p className="text-sm text-text-secondary">{P55}</p>
          )}
        </section>
      )}

      {(list.all.length > 0 || (!loading && !noMatches && list.wanted.length === 0)) && (
        <section aria-labelledby={allHeadingId} className="space-y-2">
          <h2 id={allHeadingId} className="text-sm font-semibold text-text-primary">
            {`All farm sources (${list.counts.all})`}
          </h2>
          {rows(list.all)}
        </section>
      )}

      {noMatches && (
        <p className="text-sm text-text-secondary">{searching ? `No farms match "${query.trim()}"` : 'No farms match these filters.'}</p>
      )}

      {footer}
    </div>
  );
}
