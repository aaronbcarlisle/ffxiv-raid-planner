/**
 * Find a Static — Public recruitment board
 *
 * Browse statics that have opted in to discovery listings.
 * Filters sync to URL query params for shareable/bookmarkable links.
 * No private data is ever displayed.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search, Users, Clock, MapPin, Swords,
  Filter, X, ChevronDown, ChevronUp, Copy, Check, Info,
} from 'lucide-react';
import { Input, Select, Spinner, EmptyState, Label } from '../components/ui';
import { Button } from '../components/primitives';
import { authRequest } from '../services/api';
import { useDebounce } from '../hooks/useDebounce';
import {
  RAID_JOBS,
  DC_NAMES,
  getWorldsForDC,
  TIMEZONES,
  LANGUAGES,
} from '../gamedata';

// ─── Types ───────────────────────────────────────────────────

interface DiscoveryItem {
  name: string;
  shareCode: string;
  recruitmentStatus: string;
  description?: string;
  neededRoles?: string[];
  neededJobs?: string[];
  scheduleDays?: string[];
  scheduleStartTime?: string;
  scheduleEndTime?: string;
  timezone?: string;
  languages?: string[];
  intensity?: string;
  dataCenter?: string;
  server?: string;
  memberCount: number;
  lastUpdated?: string;
}

interface DiscoveryResponse {
  items: DiscoveryItem[];
  total: number;
}

// ─── Constants ───────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: '', label: 'Any role' },
  { value: 'tank', label: 'Tank' },
  { value: 'healer', label: 'Healer' },
  { value: 'melee', label: 'Melee' },
  { value: 'ranged', label: 'Physical Ranged' },
  { value: 'caster', label: 'Caster' },
];

const INTENSITY_OPTIONS = [
  { value: '', label: 'Any intensity' },
  { value: 'casual', label: 'Casual' },
  { value: 'midcore', label: 'Midcore' },
  { value: 'hardcore', label: 'Hardcore' },
];

const RECRUITMENT_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: 'open', label: 'Open' },
  { value: 'limited', label: 'Limited' },
  { value: 'closed', label: 'Closed' },
];

const SORT_OPTIONS = [
  { value: 'recent', label: 'Recently updated' },
  { value: 'members', label: 'Most members' },
  { value: 'name', label: 'Name A–Z' },
];

const DC_OPTIONS = [
  { value: '', label: 'Any data center' },
  ...DC_NAMES.map(dc => ({ value: dc, label: dc })),
];

const TZ_OPTIONS = [
  { value: '', label: 'Any timezone' },
  ...TIMEZONES.map(tz => ({ value: tz.value, label: tz.label })),
];

const LANG_OPTIONS = [
  { value: '', label: 'Any language' },
  ...LANGUAGES.map(l => ({ value: l.code, label: l.label })),
];

const JOB_OPTIONS = [
  { value: '', label: 'Any job' },
  ...RAID_JOBS.map(j => ({ value: j.abbreviation, label: `${j.abbreviation} — ${j.name}` })),
];

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-status-success/20 text-status-success border-status-success/30',
  limited: 'bg-status-warning/20 text-status-warning border-status-warning/30',
  closed: 'bg-status-error/20 text-status-error border-status-error/30',
};

// ─── Helpers ─────────────────────────────────────────────────

function langName(code: string): string {
  return LANGUAGES.find(l => l.code === code)?.label ?? code.toUpperCase();
}

function tzLabel(value: string): string {
  return TIMEZONES.find(t => t.value === value)?.label ?? value;
}

function shortDay(day: string): string {
  return day.length > 3 ? day.slice(0, 3) : day;
}

/** Filter keys that map 1:1 to URL params and API query params */
const FILTER_KEYS = ['role', 'job', 'intensity', 'recruitmentStatus', 'dataCenter', 'server', 'timezone', 'language'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

// ─── Page Component ──────────────────────────────────────────

export function Discover() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial state from URL
  const readParam = (key: string) => searchParams.get(key) ?? '';

  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(() =>
    FILTER_KEYS.some(k => searchParams.has(k))
  );

  // Search + filters + sort — initialised from URL
  const [searchText, setSearchText] = useState(readParam('q'));
  const [sort, setSort] = useState(readParam('sort') || 'recent');
  const [filters, setFilters] = useState<Record<FilterKey, string>>(() => {
    const init = {} as Record<FilterKey, string>;
    for (const k of FILTER_KEYS) init[k] = readParam(k);
    return init;
  });

  const debouncedSearch = useDebounce(searchText, 350);

  // Server options depend on DC
  const serverOptions = useMemo(() =>
    filters.dataCenter
      ? [{ value: '', label: 'Any server' }, ...getWorldsForDC(filters.dataCenter).map(w => ({ value: w, label: w }))]
      : [{ value: '', label: 'Select data center first' }],
    [filters.dataCenter],
  );

  const setFilter = useCallback((key: FilterKey, value: string) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      // Reset server when DC changes
      if (key === 'dataCenter' && value !== prev.dataCenter) next.server = '';
      return next;
    });
  }, []);

  const hasFilters = useMemo(() =>
    FILTER_KEYS.some(k => filters[k] !== ''),
    [filters],
  );

  const filterCount = useMemo(() =>
    FILTER_KEYS.filter(k => filters[k] !== '').length,
    [filters],
  );

  const clearFilters = useCallback(() => {
    const cleared = {} as Record<FilterKey, string>;
    for (const k of FILTER_KEYS) cleared[k] = '';
    setFilters(cleared);
    setSearchText('');
  }, []);

  // Sync filters → URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (sort && sort !== 'recent') params.set('sort', sort);
    for (const k of FILTER_KEYS) {
      if (filters[k]) params.set(k, filters[k]);
    }
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, sort, filters, setSearchParams]);

  // Fetch results
  const fetchResults = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (sort) params.set('sort', sort);
    for (const k of FILTER_KEYS) {
      if (filters[k]) params.set(k, filters[k]);
    }
    const qs = params.toString();

    try {
      const data = await authRequest<DiscoveryResponse>(
        `/api/discovery/statics${qs ? `?${qs}` : ''}`
      );
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn\'t load static listings.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, sort, filters]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
      {/* ─── Header ─── */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-text-primary mb-1">
          Find a Static
        </h1>
        <p className="text-text-secondary text-sm sm:text-base">
          Browse groups recruiting for current and upcoming tiers.
        </p>
        <p className="text-text-muted text-xs mt-1 flex items-center gap-1">
          <Info className="w-3 h-3 flex-shrink-0" />
          Listings are opt-in and only show public statics.
        </p>
      </div>

      {/* ─── Search + Sort bar ─── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <Input
            value={searchText}
            onChange={setSearchText}
            placeholder="Search by name or description..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 items-end">
          <div className="w-44">
            <Select
              value={sort}
              onChange={setSort}
              options={SORT_OPTIONS}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="h-[44px] sm:h-auto"
          >
            <Filter className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Filters</span>
            {filterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-accent/20 text-accent rounded-full text-xs font-medium min-w-[1.25rem] text-center">
                {filterCount}
              </span>
            )}
            {showFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
          </Button>
        </div>
      </div>

      {/* ─── Filters panel ─── */}
      {showFilters && (
        <div className="mb-5 p-4 bg-surface-card border border-border-default rounded-lg space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label htmlFor="f-role">Role</Label>
              <Select id="f-role" value={filters.role} onChange={v => setFilter('role', v)} options={ROLE_OPTIONS} />
            </div>
            <div>
              <Label htmlFor="f-job">Job</Label>
              <Select id="f-job" value={filters.job} onChange={v => setFilter('job', v)} options={JOB_OPTIONS} />
            </div>
            <div>
              <Label htmlFor="f-intensity">Intensity</Label>
              <Select id="f-intensity" value={filters.intensity} onChange={v => setFilter('intensity', v)} options={INTENSITY_OPTIONS} />
            </div>
            <div>
              <Label htmlFor="f-status">Recruitment</Label>
              <Select id="f-status" value={filters.recruitmentStatus} onChange={v => setFilter('recruitmentStatus', v)} options={RECRUITMENT_OPTIONS} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label htmlFor="f-dc">Data Center</Label>
              <Select id="f-dc" value={filters.dataCenter} onChange={v => setFilter('dataCenter', v)} options={DC_OPTIONS} />
            </div>
            <div>
              <Label htmlFor="f-server">Server</Label>
              <Select id="f-server" value={filters.server} onChange={v => setFilter('server', v)} options={serverOptions} disabled={!filters.dataCenter} />
            </div>
            <div>
              <Label htmlFor="f-tz">Timezone</Label>
              <Select id="f-tz" value={filters.timezone} onChange={v => setFilter('timezone', v)} options={TZ_OPTIONS} />
            </div>
            <div>
              <Label htmlFor="f-lang">Language</Label>
              <Select id="f-lang" value={filters.language} onChange={v => setFilter('language', v)} options={LANG_OPTIONS} />
            </div>
          </div>
          {(hasFilters || debouncedSearch) && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                Clear all
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ─── Results count ─── */}
      {!loading && !error && (
        <p className="text-text-muted text-sm mb-4">
          {total} {total === 1 ? 'listing' : 'listings'}
          {(hasFilters || debouncedSearch) ? ' matching your filters' : ''}
        </p>
      )}

      {/* ─── Results ─── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="p-6 bg-status-error/10 border border-status-error/30 rounded-lg text-center">
          <p className="text-status-error font-medium">Couldn&apos;t load static listings</p>
          <p className="text-text-secondary text-sm mt-1">{error}</p>
          <Button variant="secondary" size="sm" onClick={fetchResults} className="mt-3">
            Try again
          </Button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Search className="w-8 h-8" />}
          heading="No statics found"
          description={
            hasFilters || debouncedSearch
              ? 'No statics match your search. Try adjusting your filters.'
              : 'No statics are listed yet. Static owners can enable listings from Settings → Discovery.'
          }
          action={hasFilters || debouncedSearch ? { label: 'Clear filters', onClick: clearFilters } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map((item) => (
            <ListingCard key={item.shareCode} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Listing Card ────────────────────────────────────────────

function ListingCard({ item }: { item: DiscoveryItem }) {
  const [copied, setCopied] = useState(false);
  const statusClass = STATUS_COLORS[item.recruitmentStatus] ?? STATUS_COLORS.closed;

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/group/${item.shareCode}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  const hasSchedule = !!(item.scheduleDays?.length);
  const hasNeeds = !!(item.neededRoles?.length || item.neededJobs?.length);

  return (
    <div className="bg-surface-card border border-border-default rounded-lg hover:border-accent/30 transition-colors flex flex-col overflow-hidden">
      {/* ─── Card header ─── */}
      <div className="p-4 pb-0">
        {/* Row 1: Name + status */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className="text-base sm:text-lg font-display font-semibold text-text-primary break-words min-w-0">
            {item.name}
          </h3>
          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border flex-shrink-0 capitalize whitespace-nowrap ${statusClass}`}>
            {item.recruitmentStatus}
          </span>
        </div>

        {/* Row 2: Location / intensity / timezone */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary mb-3">
          {(item.dataCenter || item.server) && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              {[item.dataCenter, item.server].filter(Boolean).join(' — ')}
            </span>
          )}
          {item.timezone && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
              {tzLabel(item.timezone)}
            </span>
          )}
          {item.intensity && (
            <span className="px-2 py-0.5 bg-accent/10 text-accent border border-accent/20 rounded text-xs capitalize">
              {item.intensity}
            </span>
          )}
        </div>
      </div>

      {/* ─── Card body ─── */}
      <div className="px-4 flex-1">
        {/* Schedule */}
        {hasSchedule && (
          <div className="flex items-center gap-1.5 text-text-secondary text-xs mb-2.5 flex-wrap">
            <Swords className="w-3.5 h-3.5 flex-shrink-0 text-text-muted" />
            <span>
              {item.scheduleDays!.map(shortDay).join(', ')}
              {item.scheduleStartTime && ` ${item.scheduleStartTime}`}
              {item.scheduleEndTime && `–${item.scheduleEndTime}`}
            </span>
          </div>
        )}

        {/* Recruiting needs */}
        {hasNeeds && (
          <div className="mb-2.5">
            <p className="text-text-muted text-[10px] mb-1 font-semibold uppercase tracking-wider">Recruiting</p>
            <div className="flex flex-wrap gap-1">
              {item.neededRoles?.map(r => (
                <span key={r} className="px-2 py-0.5 bg-accent/10 text-accent border border-accent/20 rounded text-xs capitalize">
                  {r === 'ranged' ? 'Phys. Ranged' : r}
                </span>
              ))}
              {item.neededJobs?.map(j => (
                <span key={j} className="px-1.5 py-0.5 bg-surface-elevated text-text-primary border border-border-default rounded text-xs font-mono">
                  {j}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Languages */}
        {item.languages?.length ? (
          <div className="flex flex-wrap gap-1 mb-2.5">
            {item.languages.map(l => (
              <span key={l} className="px-1.5 py-0.5 bg-surface-elevated text-text-secondary border border-border-default rounded text-[11px]">
                {langName(l)}
              </span>
            ))}
          </div>
        ) : null}

        {/* Description / contact */}
        {item.description ? (
          <p className="text-text-secondary text-sm mb-3 line-clamp-3 break-words whitespace-pre-line">{item.description}</p>
        ) : (
          <p className="text-text-muted text-xs mb-3 italic">
            No contact info provided yet. View the static page for more details.
          </p>
        )}
      </div>

      {/* ─── Card footer ─── */}
      <div className="px-4 py-3 border-t border-border-default flex items-center justify-between gap-2 bg-surface-base/50">
        <div className="flex items-center gap-3 text-text-muted text-xs min-w-0">
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {item.memberCount}
          </span>
          {item.lastUpdated && (
            <span className="hidden sm:inline truncate">
              Updated {new Date(item.lastUpdated).toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* design-system-ignore: compact icon-only copy button in card footer */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="p-1.5 rounded-md text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
            aria-label="Copy listing link"
            title="Copy link"
          >
            {copied
              ? <Check className="w-4 h-4 text-status-success" />
              : <Copy className="w-4 h-4" />}
          </button>
          <Link
            to={`/group/${item.shareCode}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 border border-accent/30 hover:border-accent/50 rounded-lg text-accent text-sm font-medium transition-colors"
          >
            View Static
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Discover;
