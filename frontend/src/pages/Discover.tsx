/**
 * Find a Static — Public recruitment board
 *
 * Browse statics that have opted in to discovery listings.
 * Filters sync to URL query params for shareable/bookmarkable links.
 * No private data is ever displayed.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search, Users, Clock, MapPin, Globe,
  Filter, X, ChevronDown, ChevronUp, Copy, Check, Info, MessageCircle, ExternalLink,
  Send, LogIn,
} from 'lucide-react';
import { Input, Select, Checkbox, Spinner, EmptyState, Label } from '../components/ui';
import { Button } from '../components/primitives';
import { authRequest } from '../services/api';
import { useDebounce } from '../hooks/useDebounce';
import { useAuthStore } from '../stores/authStore';
import { useJoinRequestStore } from '../stores/joinRequestStore';
import { XivIcon } from '../components/ui/XivIcon';
import { JoinRequestModal } from '../components/static-group/JoinRequestModal';
import { useModal } from '../hooks/useModal';
import {
  RAID_JOBS,
  DC_NAMES,
  getWorldsForDC,
  TIMEZONES,
  LANGUAGES,
} from '../gamedata';

// ─── Types ───────────────────────────────────────────────────

interface GoalAlignmentSlim {
  aligned: number;
  partial: number;
  conflicts: number;
  missing: number;
  unknown: number;
}

interface FitGoals {
  aligned: number;
  partial: number;
  conflicts: number;
  missing: number;
}

interface FitJobs {
  status: 'match' | 'partial' | 'none' | 'unknown';
  matchedJobs: string[];
}

interface FitSchedule {
  status: 'match' | 'partial' | 'conflict' | 'unknown';
}

interface FitComms {
  status: 'match' | 'partial' | 'conflict' | 'unknown';
}

interface FitBis {
  status: 'ready' | 'partial' | 'unknown';
}

interface FitSummary {
  overall: 'strong' | 'good' | 'partial' | 'weak' | 'unknown';
  goals: FitGoals;
  jobs: FitJobs;
  schedule: FitSchedule;
  comms: FitComms;
  bis: FitBis;
}

interface DiscoveryItem {
  name: string;
  shareCode: string;
  recruitmentStatus: string;
  description?: string;
  contactMethod?: string;
  contactValue?: string;
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
  objectiveCategories?: string[];
  goalAlignment?: GoalAlignmentSlim | null;
  fitSummary?: FitSummary | null;
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
  { value: '', label: 'Any vibe' },
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
  open:    'bg-status-success/15 text-status-success border-status-success/25',
  limited: 'bg-status-warning/15 text-status-warning border-status-warning/25',
  closed:  'bg-surface-elevated text-text-muted border-border-default',
};

const STATUS_BORDER: Record<string, string> = {
  open:    'rgba(74,222,128,0.35)',
  limited: 'rgba(234,179,8,0.3)',
  closed:  'rgba(255,255,255,0.06)',
};

const GOAL_CATEGORY_LABELS: Record<string, string> = {
  ultimate_clear:     'Ultimate — Clear',
  ultimate_farm:      'Ultimate — Farm',
  savage_bis:         'Savage — BiS',
  savage_mount:       'Savage — Mount',
  savage_achievement: 'Savage — Achievement',
  savage_alt_jobs:    'Savage — Alt Jobs',
  criterion_title:    'Criterion — Title',
  gil_farm:           'Gil Farm',
  loot_farm:          'Loot Farm',
  mount_farm:         'Mount Farm',
  custom:             'Custom',
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

const CONTACT_LABELS: Record<string, string> = {
  discord: 'Discord',
  discord_server: 'Discord Server',
  url: 'Link',
  text: 'Contact',
};

/** Only allow http/https URLs — reject javascript:, data:, etc. */
function isSafeUrl(url: string): boolean {
  const lower = url.trim().toLowerCase();
  return lower.startsWith('https://') || lower.startsWith('http://');
}

const GOAL_CATEGORY_OPTIONS = [
  { value: '', label: 'Any objectives' },
  { value: 'ultimate_clear',     label: 'Ultimate — Clear' },
  { value: 'ultimate_farm',      label: 'Ultimate — Farm' },
  { value: 'savage_bis',         label: 'Savage — BiS' },
  { value: 'savage_mount',       label: 'Savage — Mount' },
  { value: 'savage_achievement', label: 'Savage — Achievement' },
  { value: 'savage_alt_jobs',    label: 'Savage — Alt Jobs' },
  { value: 'criterion_title',    label: 'Criterion — Title' },
  { value: 'gil_farm',           label: 'Gil Farm' },
  { value: 'loot_farm',          label: 'Loot Farm' },
  { value: 'mount_farm',         label: 'Mount Farm' },
  { value: 'custom',             label: 'Custom' },
];

/** Filter keys that map 1:1 to URL params and API query params */
const FILTER_KEYS = ['role', 'job', 'intensity', 'recruitmentStatus', 'dataCenter', 'server', 'timezone', 'language', 'goalCategory'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

// ─── Page Component ──────────────────────────────────────────

export function Discover() {
  const { t } = useTranslation();
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
  const [hideConflicts, setHideConflicts] = useState(() => searchParams.get('hideConflicts') === 'true');
  const [hideGoalConflicts, setHideGoalConflicts] = useState(() => searchParams.get('hideGoalConflicts') === 'true');
  const [scheduleOverlap, setScheduleOverlap] = useState(() => searchParams.get('scheduleOverlap') === 'true');
  const [filters, setFilters] = useState<Record<FilterKey, string>>(() => {
    const init = {} as Record<FilterKey, string>;
    for (const k of FILTER_KEYS) init[k] = readParam(k);
    return init;
  });

  const debouncedSearch = useDebounce(searchText, 350);

  const user = useAuthStore((s) => s.user);
  const { myRequests, fetchMyRequests } = useJoinRequestStore();

  useEffect(() => {
    if (user) fetchMyRequests();
  }, [user, fetchMyRequests]);

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
    FILTER_KEYS.some(k => filters[k] !== '') || hideConflicts || hideGoalConflicts || scheduleOverlap,
    [filters, hideConflicts, hideGoalConflicts, scheduleOverlap],
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
    setHideConflicts(false);
    setHideGoalConflicts(false);
    setScheduleOverlap(false);
  }, []);

  // Sync filters → URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (sort && sort !== 'recent') params.set('sort', sort);
    if (hideConflicts) params.set('hideConflicts', 'true');
    if (hideGoalConflicts) params.set('hideGoalConflicts', 'true');
    if (scheduleOverlap) params.set('scheduleOverlap', 'true');
    for (const k of FILTER_KEYS) {
      if (filters[k]) params.set(k, filters[k]);
    }
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, sort, hideConflicts, hideGoalConflicts, scheduleOverlap, filters, setSearchParams]);

  // Fetch results
  const fetchResults = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (sort) params.set('sort', sort);
    if (hideConflicts) params.set('hideConflicts', 'true');
    if (hideGoalConflicts) params.set('hideGoalConflicts', 'true');
    if (scheduleOverlap) params.set('scheduleOverlap', 'true');
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
      setError(err instanceof Error ? err.message : 'Couldn\'t load listings.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, sort, hideConflicts, hideGoalConflicts, scheduleOverlap, filters]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-14 py-6 sm:py-8">
      {/* ─── Header ─── */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-text-primary mb-1">
          {t('discover.pageHeading')}
        </h1>
        <p className="text-text-secondary text-sm sm:text-base">
          {t('discover.pageSubheading')}
        </p>
        <p className="text-text-muted text-xs mt-1.5 flex items-center gap-1">
          <Info className="w-3 h-3 flex-shrink-0" />
          {t('discover.allListingsOptIn')}
        </p>
      </div>

      {/* ─── Search + Sort bar ─── */}
      <div className="flex flex-col gap-3 mb-4">
        {/* Row 1: search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <Input
            value={searchText}
            onChange={setSearchText}
            placeholder={t('discover.searchPlaceholder')}
            className="pl-9"
          />
        </div>
        {/* Row 2: sort + filter toggle */}
        <div className="flex gap-2 items-center">
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
            <span className="hidden sm:inline">{t('discover.filterButton')}</span>
            {filterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-accent/20 text-accent rounded-full text-xs font-medium min-w-[1.25rem] text-center">
                {filterCount}
              </span>
            )}
            {showFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
          </Button>
          {(hasFilters || debouncedSearch) && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-[44px] sm:h-auto">
              <X className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">{t('discover.clearAll')}</span>
            </Button>
          )}
        </div>
      </div>

      {/* ─── Filters panel ─── */}
      {showFilters && (
        <div className="mb-5 p-4 bg-surface-card border border-border-default rounded-lg space-y-4">
          {/* Looking for */}
          <div>
            <p className="text-text-muted text-[10px] font-medium uppercase tracking-widest opacity-60 mb-2">{t('discover.lookingFor')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <Label htmlFor="f-role">{t('discover.filterRole')}</Label>
                <Select id="f-role" value={filters.role} onChange={v => setFilter('role', v)} options={ROLE_OPTIONS} />
              </div>
              <div>
                <Label htmlFor="f-job">{t('discover.filterJob')}</Label>
                <Select id="f-job" value={filters.job} onChange={v => setFilter('job', v)} options={JOB_OPTIONS} />
              </div>
              <div>
                <Label htmlFor="f-intensity">{t('discover.filterVibe')}</Label>
                <Select id="f-intensity" value={filters.intensity} onChange={v => setFilter('intensity', v)} options={INTENSITY_OPTIONS} />
              </div>
              <div>
                <Label htmlFor="f-status">{t('discover.filterStatus')}</Label>
                <Select id="f-status" value={filters.recruitmentStatus} onChange={v => setFilter('recruitmentStatus', v)} options={RECRUITMENT_OPTIONS} />
              </div>
            </div>
          </div>
          {/* Goal objectives */}
          <div>
            <p className="text-text-muted text-[10px] font-medium uppercase tracking-widest opacity-60 mb-2">{t('discover.objectivesAndAlignment')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <Label htmlFor="f-goalcat">{t('discover.filterGoalCat')}</Label>
                <Select id="f-goalcat" value={filters.goalCategory} onChange={v => setFilter('goalCategory', v)} options={GOAL_CATEGORY_OPTIONS} />
              </div>
              {user && (
                <div className="flex flex-col gap-2 pb-1">
                  <Label className="flex items-center gap-2 cursor-pointer select-none text-sm">
                    <Checkbox
                      checked={hideConflicts}
                      onChange={() => setHideConflicts(v => !v)}
                      aria-label="Hide goal conflicts (legacy)"
                    />
                    {t('discover.filterHideConflicts')}
                  </Label>
                  <Label className="flex items-center gap-2 cursor-pointer select-none text-sm">
                    <Checkbox
                      checked={hideGoalConflicts}
                      onChange={() => setHideGoalConflicts(v => !v)}
                      aria-label="Hide fit score goal conflicts"
                    />
                    {t('discover.filterHideFitConflicts')}
                  </Label>
                  <Label className="flex items-center gap-2 cursor-pointer select-none text-sm">
                    <Checkbox
                      checked={scheduleOverlap}
                      onChange={() => setScheduleOverlap(v => !v)}
                      aria-label="Require schedule overlap"
                    />
                    {t('discover.filterScheduleOverlap')}
                  </Label>
                </div>
              )}
            </div>
          </div>

          {/* Location & schedule */}
          <div>
            <p className="text-text-muted text-[10px] font-medium uppercase tracking-widest opacity-60 mb-2">{t('discover.locationAndSchedule')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <Label htmlFor="f-dc">{t('discover.filterDc')}</Label>
                <Select id="f-dc" value={filters.dataCenter} onChange={v => setFilter('dataCenter', v)} options={DC_OPTIONS} />
              </div>
              <div>
                <Label htmlFor="f-server">{t('discover.filterServer')}</Label>
                <Select id="f-server" value={filters.server} onChange={v => setFilter('server', v)} options={serverOptions} disabled={!filters.dataCenter} />
              </div>
              <div>
                <Label htmlFor="f-tz">{t('discover.filterTimezone')}</Label>
                <Select id="f-tz" value={filters.timezone} onChange={v => setFilter('timezone', v)} options={TZ_OPTIONS} />
              </div>
              <div>
                <Label htmlFor="f-lang">{t('discover.filterLanguage')}</Label>
                <Select id="f-lang" value={filters.language} onChange={v => setFilter('language', v)} options={LANG_OPTIONS} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Results count ─── */}
      {!loading && !error && (
        <p className="text-text-muted text-sm mb-4">
          {t('discover.resultsCount', { count: total })}
          {(hasFilters || debouncedSearch) ? ' matching your filters' : ''}
        </p>
      )}

      {/* ─── Results ─── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Spinner size="lg" />
          <p className="text-text-muted text-sm">{t('discover.loading')}</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-status-error/10 border border-status-error/30 rounded-lg text-center">
          <p className="text-status-error font-medium">{t('discover.errorHeading')}</p>
          <p className="text-text-secondary text-sm mt-1">{error}</p>
          <Button variant="secondary" size="sm" onClick={fetchResults} className="mt-3">
            {t('discover.errorRetry')}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Search className="w-8 h-8" />}
          heading={t('discover.emptyHeading')}
          description={
            hasFilters || debouncedSearch
              ? t('discover.emptyDescFiltered')
              : t('discover.emptyDescDefault')
          }
          action={hasFilters || debouncedSearch ? { label: 'Clear filters', onClick: clearFilters } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((item) => (
            <ListingCard
              key={item.shareCode}
              item={item}
              existingRequest={myRequests.find(r => r.staticGroupName === item.name && (r.status === 'pending' || r.status === 'accepted' || r.status === 'declined'))}
              isLoggedIn={!!user}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Listing Card ────────────────────────────────────────────

function ListingCard({ item, existingRequest, isLoggedIn }: {
  item: DiscoveryItem;
  existingRequest?: import('../types').JoinRequest;
  isLoggedIn: boolean;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const joinModal = useModal();
  const login = useAuthStore((s) => s.login);
  const { cancelRequest } = useJoinRequestStore();
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancelRequest = async () => {
    if (!existingRequest) return;
    setIsCancelling(true);
    try { await cancelRequest(existingRequest.id); } finally { setIsCancelling(false); }
  };
  const statusClass = STATUS_COLORS[item.recruitmentStatus] ?? STATUS_COLORS.closed;
  const longDescription = (item.description?.length ?? 0) > 120;

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

  const statusBorderColor = STATUS_BORDER[item.recruitmentStatus] ?? STATUS_BORDER.closed;

  return (
    <div
      className="relative bg-surface-card border border-border-default rounded-lg hover:border-border-hover transition-all duration-150 flex flex-col overflow-hidden hover:shadow-md"
      style={{ boxShadow: `inset 3px 0 0 ${statusBorderColor}` }}
    >
      {/* ─── Card header ─── */}
      <div className="p-4 pb-0">
        {/* Row 1: Name + status */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className="text-base font-display font-semibold text-text-primary break-words min-w-0">
            {item.name}
          </h3>
          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border flex-shrink-0 capitalize whitespace-nowrap tracking-wide ${statusClass}`}>
            {item.recruitmentStatus === 'open' ? t('discover.recruitmentOpen')
              : item.recruitmentStatus === 'limited' ? t('discover.recruitmentLimited')
              : item.recruitmentStatus === 'closed' ? t('discover.recruitmentClosed')
              : item.recruitmentStatus}
          </span>
        </div>

        {/* Row 2: Quick facts — location / timezone / vibe */}
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
          {item.languages?.length ? (
            <span className="flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 flex-shrink-0" />
              {item.languages.map(langName).join(', ')}
            </span>
          ) : null}
        </div>
      </div>

      {/* ─── Card body ─── */}
      <div className="px-4 flex-1">
        {/* Raid nights */}
        {hasSchedule && (
          <div className="mb-2.5">
            <p className="text-text-muted text-[10px] mb-1 font-medium uppercase tracking-widest opacity-60">{t('discover.raidNights')}</p>
            <div className="flex items-center gap-1.5 text-text-secondary text-xs flex-wrap">
              <XivIcon name="sword" size={14} className="flex-shrink-0" />
              <span>
                {item.scheduleDays!.map(shortDay).join(', ')}
                {item.scheduleStartTime && ` ${item.scheduleStartTime}`}
                {item.scheduleEndTime && `–${item.scheduleEndTime}`}
                {item.timezone && (
                  <span className="text-text-muted"> ({tzLabel(item.timezone).split(' ')[0]})</span>
                )}
              </span>
            </div>
          </div>
        )}

        {/* Looking for */}
        {hasNeeds && (
          <div className="mb-2.5">
            <p className="text-text-muted text-[10px] mb-1 font-medium uppercase tracking-widest opacity-60">{t('discover.lookingForLabel')}</p>
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

        {/* Static objectives */}
        {item.objectiveCategories && item.objectiveCategories.length > 0 && (
          <div className="mb-2.5">
            <p className="text-text-muted text-[10px] mb-1 font-medium uppercase tracking-widest opacity-60">{t('discover.officialGoals')}</p>
            <div className="flex flex-wrap gap-1">
              {item.objectiveCategories.map((cat) => (
                <span key={cat} className="px-2 py-0.5 bg-surface-elevated text-text-secondary border border-border-default rounded text-xs">
                  {GOAL_CATEGORY_LABELS[cat] ?? cat}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Goal alignment (logged-in users only) */}
        {item.goalAlignment && (
          <div className="mb-2.5">
            <p className="text-text-muted text-[10px] mb-1 font-medium uppercase tracking-widest opacity-60">{t('discover.yourGoalMatch')}</p>
            <div className="flex items-center gap-2 text-xs flex-wrap">
              {item.goalAlignment.aligned > 0 && (
                <span className="text-status-success font-medium">{item.goalAlignment.aligned} aligned</span>
              )}
              {item.goalAlignment.partial > 0 && (
                <span className="text-status-warning font-medium">{item.goalAlignment.partial} partial</span>
              )}
              {item.goalAlignment.conflicts > 0 && (
                <span className="text-status-error font-medium">{item.goalAlignment.conflicts} conflict{item.goalAlignment.conflicts !== 1 ? 's' : ''}</span>
              )}
              {item.goalAlignment.missing > 0 && (
                <span className="text-text-muted">{item.goalAlignment.missing} missing</span>
              )}
            </div>
          </div>
        )}

        {/* Fit summary (authenticated users with player profile only) */}
        {item.fitSummary && (
          <FitSummarySection fit={item.fitSummary} />
        )}

        {/* About */}
        {item.description && (
          <div className="mb-2.5">
            <p className="text-text-muted text-[10px] mb-1 font-medium uppercase tracking-widest opacity-60">{t('discover.about')}</p>
            <p className={`text-text-secondary text-sm break-words whitespace-pre-line ${!expanded && longDescription ? 'line-clamp-3' : ''}`}>
              {item.description}
            </p>
            {longDescription && (
              /* design-system-ignore: inline show more/less toggle for card content */
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="text-accent text-xs mt-1 hover:underline"
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}

        {/* Contact info */}
        {item.contactMethod && item.contactValue ? (
          <div className="mb-3 flex items-center gap-1.5 text-sm min-w-0">
            <MessageCircle className="w-3.5 h-3.5 text-accent flex-shrink-0" />
            <span className="text-text-muted text-xs">{CONTACT_LABELS[item.contactMethod] ?? 'Contact'}:</span>
            {item.contactMethod === 'url' && isSafeUrl(item.contactValue) ? (
              <a
                href={item.contactValue}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent text-xs hover:underline truncate min-w-0 flex items-center gap-0.5"
              >
                {item.contactValue.replace(/^https?:\/\//, '').slice(0, 60)}
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
            ) : (
              <span className="text-text-primary text-xs break-all min-w-0">{item.contactValue}</span>
            )}
          </div>
        ) : !item.description ? (
          <p className="text-text-muted text-xs mb-3 italic">
            {t('discover.noDetails')}
          </p>
        ) : null}
      </div>

      {/* ─── Card footer ─── */}
      <div className="px-4 py-3 border-t border-border-default flex items-center justify-between gap-2 bg-surface-base/50">
        <div className="flex items-center gap-3 text-text-muted text-xs min-w-0">
          {item.memberCount > 0 && (
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {t('common.count_member', { count: item.memberCount })}
            </span>
          )}
          {item.lastUpdated && (
            <span className="hidden sm:inline truncate">
              {t('discover.updatedDate', { date: new Date(item.lastUpdated).toLocaleDateString() })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* design-system-ignore: compact icon-only copy button in card footer */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="p-1.5 rounded-md text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
            aria-label={copied ? t('discover.linkCopied') : t('discover.copyListingLink')}
            title={copied ? t('discover.linkCopied') : t('discover.copyListingLink')}
          >
            {copied
              ? <Check className="w-4 h-4 text-status-success" />
              : <Copy className="w-4 h-4" />}
          </button>
          {/* Join request actions */}
          {existingRequest?.status === 'pending' ? (
            <Button variant="ghost" size="sm" onClick={handleCancelRequest} loading={isCancelling}>
              <Clock className="w-3.5 h-3.5 text-status-warning" />
              <span className="text-status-warning">{t('discover.requestPending')}</span>
            </Button>
          ) : existingRequest?.status === 'accepted' ? (
            <span className="flex items-center gap-1 text-xs text-status-success px-2">
              <Check className="w-3.5 h-3.5" /> {t('discover.requestAccepted')}
            </span>
          ) : existingRequest?.status === 'declined' ? (
            <span className="flex items-center gap-1 text-xs text-status-error px-2">{t('discover.requestDeclined')}</span>
          ) : isLoggedIn ? (
            <Button variant="primary" size="sm" leftIcon={<Send className="w-3.5 h-3.5" />} onClick={joinModal.open}>
              {t('discover.requestToJoin')}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" leftIcon={<LogIn className="w-3.5 h-3.5" />} onClick={() => login()}>
              {t('discover.loginToJoin')}
            </Button>
          )}
          <Link
            to={`/group/${item.shareCode}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 border border-accent/30 hover:border-accent/50 rounded-lg text-accent text-sm font-medium transition-colors"
          >
            {t('discover.viewStatic')}
          </Link>
        </div>
      </div>

      <JoinRequestModal
        isOpen={joinModal.isOpen}
        onClose={joinModal.close}
        shareCode={item.shareCode}
        staticName={item.name}
        neededJobs={item.neededJobs}
        neededRoles={item.neededRoles}
        recruitmentStatus={item.recruitmentStatus}
      />
    </div>
  );
}

// ─── Fit Summary Section ─────────────────────────────────────

function FitSummarySection({ fit }: { fit: FitSummary }) {
  const { t } = useTranslation();
  const FIT_LABELS: Record<string, { label: string; className: string }> = {
    strong:  { label: t('discover.fitScoreStrong'),  className: 'text-status-success' },
    good:    { label: t('discover.fitScoreGood'),    className: 'text-status-success' },
    partial: { label: t('discover.fitScorePartial'), className: 'text-status-warning' },
    weak:    { label: t('discover.fitScoreWeak'),    className: 'text-status-error' },
    unknown: { label: t('discover.fitScoreUnknown'), className: 'text-text-muted' },
  };
  const overallInfo = FIT_LABELS[fit.overall] ?? FIT_LABELS.unknown;

  // Build compact detail tokens
  const tokens: { label: string; className?: string }[] = [];

  if (fit.goals.aligned > 0) {
    tokens.push({ label: `${fit.goals.aligned} goal${fit.goals.aligned !== 1 ? 's' : ''} aligned`, className: 'text-status-success' });
  }
  if (fit.goals.conflicts > 0) {
    tokens.push({ label: `${fit.goals.conflicts} goal conflict${fit.goals.conflicts !== 1 ? 's' : ''}`, className: 'text-status-error' });
  }
  if (fit.jobs.status === 'match' && fit.jobs.matchedJobs.length > 0) {
    tokens.push({ label: `${fit.jobs.matchedJobs.join(', ')} wanted`, className: 'text-status-success' });
  } else if (fit.jobs.status === 'partial' && fit.jobs.matchedJobs.length > 0) {
    tokens.push({ label: `${fit.jobs.matchedJobs.join(', ')} (alt)`, className: 'text-status-warning' });
  } else if (fit.jobs.status === 'none') {
    tokens.push({ label: 'job not wanted', className: 'text-status-error' });
  }
  if (fit.schedule.status === 'match') {
    tokens.push({ label: 'schedule match' });
  } else if (fit.schedule.status === 'partial') {
    tokens.push({ label: 'schedule partial', className: 'text-status-warning' });
  } else if (fit.schedule.status === 'conflict') {
    tokens.push({ label: 'schedule conflict', className: 'text-status-error' });
  }
  if (fit.comms.status === 'match') {
    tokens.push({ label: 'comms match' });
  } else if (fit.comms.status === 'conflict') {
    tokens.push({ label: 'comms conflict', className: 'text-status-error' });
  }
  if (fit.bis.status === 'ready') {
    tokens.push({ label: 'BiS ready', className: 'text-status-success' });
  }

  return (
    <div className="mb-2.5" data-testid="fit-summary">
      <p className="text-text-muted text-[10px] mb-1 font-medium uppercase tracking-widest opacity-60">{t('discover.fitScore')}</p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
        <span className={`font-semibold ${overallInfo.className}`} data-testid="fit-overall">
          {overallInfo.label}
        </span>
        {tokens.length > 0 && (
          <>
            <span className="text-border-default">·</span>
            {tokens.map((t, i) => (
              <span key={i} className={t.className ?? 'text-text-secondary'}>
                {t.label}
                {i < tokens.length - 1 && <span className="text-border-default ml-2">·</span>}
              </span>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default Discover;
