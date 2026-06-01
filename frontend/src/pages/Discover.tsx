/**
 * Discover Page - Browse public statics looking for members
 *
 * Filters use the same dropdown/chip controls as the Discovery settings tab.
 * No private data (owner IDs, Discord IDs, member lists, gear) is displayed.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Globe, Users, Clock, MapPin, Swords,
  Filter, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Select, Spinner, EmptyState, Label } from '../components/ui';
import { Button } from '../components/primitives';
import { authRequest } from '../services/api';
import {
  RAID_JOBS,
  DC_NAMES,
  getWorldsForDC,
  TIMEZONES,
  LANGUAGES,
} from '../gamedata';

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

const ROLE_OPTIONS: { value: string; label: string }[] = [
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

/** Resolve a language code to its human-readable name */
function langName(code: string): string {
  return LANGUAGES.find(l => l.code === code)?.label ?? code.toUpperCase();
}

/** Resolve a timezone value to its short label */
function tzLabel(value: string): string {
  return TIMEZONES.find(t => t.value === value)?.label ?? value;
}

/** Abbreviate day name to 3 chars */
function shortDay(day: string): string {
  return day.length > 3 ? day.slice(0, 3) : day;
}

export function Discover() {
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [role, setRole] = useState('');
  const [job, setJob] = useState('');
  const [intensity, setIntensity] = useState('');
  const [recruitmentStatus, setRecruitmentStatus] = useState('');
  const [dataCenter, setDataCenter] = useState('');
  const [server, setServer] = useState('');
  const [timezone, setTimezone] = useState('');
  const [language, setLanguage] = useState('');

  // Server options depend on selected DC
  const serverOptions = dataCenter
    ? [{ value: '', label: 'Any server' }, ...getWorldsForDC(dataCenter).map(w => ({ value: w, label: w }))]
    : [{ value: '', label: 'Select a data center first' }];

  const fetchResults = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (role) params.set('role', role);
    if (job) params.set('job', job);
    if (intensity) params.set('intensity', intensity);
    if (recruitmentStatus) params.set('recruitmentStatus', recruitmentStatus);
    if (dataCenter) params.set('dataCenter', dataCenter);
    if (server) params.set('server', server);
    if (timezone) params.set('timezone', timezone);
    if (language) params.set('language', language);

    const qs = params.toString();

    try {
      const data = await authRequest<DiscoveryResponse>(
        `/api/discovery/statics${qs ? `?${qs}` : ''}`
      );
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn\'t load discovery listings. Try again.');
    } finally {
      setLoading(false);
    }
  }, [role, job, intensity, recruitmentStatus, dataCenter, server, timezone, language]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const clearFilters = () => {
    setRole('');
    setJob('');
    setIntensity('');
    setRecruitmentStatus('');
    setDataCenter('');
    setServer('');
    setTimezone('');
    setLanguage('');
  };

  // Reset server when DC changes
  const handleDCChange = (dc: string) => {
    setDataCenter(dc);
    if (dc !== dataCenter) setServer('');
  };

  const hasFilters = !!(role || job || intensity || recruitmentStatus || dataCenter || server || timezone || language);

  // Count active filters for badge
  const filterCount = [role, job, intensity, recruitmentStatus, dataCenter, server, timezone, language].filter(Boolean).length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Globe className="w-7 h-7 text-accent" />
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-text-primary">
            Discover Statics
          </h1>
        </div>
        <p className="text-text-secondary text-sm sm:text-base">
          Browse statics that are looking for members. Find a group that fits your schedule and playstyle.
        </p>
      </div>

      {/* Filter toggle + count */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="w-4 h-4 mr-1.5" />
          Filters
          {filterCount > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 bg-accent/20 text-accent rounded-full text-xs font-medium min-w-[1.25rem] text-center">
              {filterCount}
            </span>
          )}
          {showFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
        </Button>
        {!loading && (
          <span className="text-text-secondary text-sm flex-shrink-0">
            {total} {total === 1 ? 'static' : 'statics'} found
          </span>
        )}
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="mb-6 p-4 bg-surface-card border border-border-default rounded-lg space-y-4">
          {/* Row 1: Role, Job, Intensity, Recruitment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label htmlFor="f-role">Role</Label>
              <Select id="f-role" value={role} onChange={setRole} options={ROLE_OPTIONS} />
            </div>
            <div>
              <Label htmlFor="f-job">Job</Label>
              <Select id="f-job" value={job} onChange={setJob} options={JOB_OPTIONS} />
            </div>
            <div>
              <Label htmlFor="f-intensity">Intensity</Label>
              <Select id="f-intensity" value={intensity} onChange={setIntensity} options={INTENSITY_OPTIONS} />
            </div>
            <div>
              <Label htmlFor="f-status">Recruitment</Label>
              <Select id="f-status" value={recruitmentStatus} onChange={setRecruitmentStatus} options={RECRUITMENT_OPTIONS} />
            </div>
          </div>
          {/* Row 2: DC, Server, Timezone, Language */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label htmlFor="f-dc">Data Center</Label>
              <Select id="f-dc" value={dataCenter} onChange={handleDCChange} options={DC_OPTIONS} />
            </div>
            <div>
              <Label htmlFor="f-server">Server</Label>
              <Select id="f-server" value={server} onChange={setServer} options={serverOptions} disabled={!dataCenter} />
            </div>
            <div>
              <Label htmlFor="f-tz">Timezone</Label>
              <Select id="f-tz" value={timezone} onChange={setTimezone} options={TZ_OPTIONS} />
            </div>
            <div>
              <Label htmlFor="f-lang">Language</Label>
              <Select id="f-lang" value={language} onChange={setLanguage} options={LANG_OPTIONS} />
            </div>
          </div>
          {hasFilters && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="p-4 bg-status-error/10 border border-status-error/30 rounded-lg text-center">
          <p className="text-status-error font-medium">Couldn&apos;t load discovery listings</p>
          <p className="text-text-secondary text-sm mt-1">{error}</p>
          <Button variant="secondary" size="sm" onClick={fetchResults} className="mt-3">
            Try again
          </Button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Search className="w-8 h-8" />}
          heading="No statics found"
          description={hasFilters
            ? 'Try adjusting your filters to see more results.'
            : 'No statics are listed for discovery yet. Check back later!'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <DiscoveryCard key={item.shareCode} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function DiscoveryCard({ item }: { item: DiscoveryItem }) {
  const statusClass = STATUS_COLORS[item.recruitmentStatus] ?? STATUS_COLORS.closed;

  return (
    <div className="bg-surface-card border border-border-default rounded-lg p-4 hover:border-accent/30 transition-colors flex flex-col">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-display font-semibold text-text-primary truncate">
            {item.name}
          </h3>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {(item.dataCenter || item.server) && (
              <span className="flex items-center gap-1 text-text-secondary text-sm">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">
                  {[item.dataCenter, item.server].filter(Boolean).join(' — ')}
                </span>
              </span>
            )}
            {item.intensity && (
              <span className="px-2 py-0.5 bg-accent/10 text-accent border border-accent/20 rounded text-xs capitalize">
                {item.intensity}
              </span>
            )}
          </div>
        </div>
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border flex-shrink-0 capitalize ${statusClass}`}>
          {item.recruitmentStatus}
        </span>
      </div>

      {/* Description */}
      {item.description && (
        <p className="text-text-secondary text-sm mb-3 line-clamp-2 break-words">{item.description}</p>
      )}

      {/* Meta tags row */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {item.languages?.map(l => (
          <span key={l} className="px-2 py-0.5 bg-surface-elevated text-text-secondary border border-border-default rounded text-xs">
            {langName(l)}
          </span>
        ))}
        {item.timezone && (
          <span className="px-2 py-0.5 bg-surface-elevated text-text-secondary border border-border-default rounded text-xs flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {tzLabel(item.timezone)}
          </span>
        )}
      </div>

      {/* Needed roles/jobs */}
      {(item.neededRoles?.length || item.neededJobs?.length) ? (
        <div className="mb-3">
          <p className="text-text-muted text-xs mb-1 font-medium uppercase tracking-wide">Recruiting</p>
          <div className="flex flex-wrap gap-1">
            {item.neededRoles?.map(r => (
              <span key={r} className="px-2 py-0.5 bg-accent/10 text-accent border border-accent/20 rounded text-xs capitalize">
                {r === 'ranged' ? 'Phys. Ranged' : r}
              </span>
            ))}
            {item.neededJobs?.map(j => (
              <span key={j} className="px-2 py-0.5 bg-surface-elevated text-text-primary border border-border-default rounded text-xs font-mono">
                {j}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Schedule */}
      {item.scheduleDays?.length ? (
        <div className="flex items-center gap-1.5 text-text-secondary text-xs mb-3 flex-wrap">
          <Swords className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            {item.scheduleDays.map(shortDay).join(', ')}
            {item.scheduleStartTime && ` ${item.scheduleStartTime}`}
            {item.scheduleEndTime && `–${item.scheduleEndTime}`}
          </span>
          {item.timezone && (
            <span className="text-text-muted">({tzLabel(item.timezone)})</span>
          )}
        </div>
      ) : null}

      {/* Spacer to push footer down */}
      <div className="flex-1" />

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border-default">
        <div className="flex items-center gap-1.5 text-text-muted text-xs">
          <Users className="w-3.5 h-3.5" />
          <span>{item.memberCount} {item.memberCount === 1 ? 'member' : 'members'}</span>
          {item.lastUpdated && (
            <span className="ml-2 hidden sm:inline">
              Updated {new Date(item.lastUpdated).toLocaleDateString()}
            </span>
          )}
        </div>
        <Link
          to={`/group/${item.shareCode}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 border border-accent/30 hover:border-accent/50 rounded-lg text-accent text-sm font-medium transition-colors flex-shrink-0"
        >
          View Static
        </Link>
      </div>

      {/* Contact hint when no description */}
      {!item.description && (
        <p className="text-text-muted text-xs mt-2 italic">
          Request-to-join is coming soon. View the static page for more info.
        </p>
      )}
    </div>
  );
}

export default Discover;
