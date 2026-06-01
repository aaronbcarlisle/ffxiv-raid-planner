/**
 * Discover Page - Browse public statics looking for members
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Globe, Users, Clock, MapPin, Swords, Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Input, Select, Spinner, EmptyState } from '../components/ui';
import { Button } from '../components/primitives';
import { Label } from '../components/ui';
import { authRequest } from '../services/api';
import { RAID_JOBS, type Role } from '../gamedata';

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

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'tank', label: 'Tank' },
  { value: 'healer', label: 'Healer' },
  { value: 'melee', label: 'Melee' },
  { value: 'ranged', label: 'Ranged' },
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

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-status-success/20 text-status-success border-status-success/30',
  limited: 'bg-status-warning/20 text-status-warning border-status-warning/30',
  closed: 'bg-status-error/20 text-status-error border-status-error/30',
};

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
      setError(err instanceof Error ? err.message : 'Failed to load results');
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

  const hasFilters = !!(role || job || intensity || recruitmentStatus || dataCenter || server || timezone || language);

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
        <p className="text-text-secondary">
          Browse statics that are looking for members. Find a group that fits your schedule and playstyle.
        </p>
      </div>

      {/* Filter toggle + count */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="w-4 h-4 mr-1.5" />
          Filters
          {hasFilters && (
            <span className="ml-1.5 px-1.5 py-0.5 bg-accent/20 text-accent rounded text-xs">
              Active
            </span>
          )}
          {showFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
        </Button>
        {!loading && (
          <span className="text-text-secondary text-sm">
            {total} {total === 1 ? 'static' : 'statics'} found
          </span>
        )}
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="mb-6 p-4 bg-surface-card border border-border-default rounded-lg space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="f-role">Role Needed</Label>
              <Select
                id="f-role"
                value={role}
                onChange={setRole}
                options={[{ value: '', label: 'Any role' }, ...ROLE_OPTIONS]}
              />
            </div>
            <div>
              <Label htmlFor="f-job">Job Needed</Label>
              <Select
                id="f-job"
                value={job}
                onChange={setJob}
                options={[
                  { value: '', label: 'Any job' },
                  ...RAID_JOBS.map(j => ({ value: j.abbreviation, label: `${j.abbreviation} - ${j.name}` })),
                ]}
              />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="f-dc">Data Center</Label>
              <Input id="f-dc" value={dataCenter} onChange={setDataCenter} placeholder="e.g. Aether" />
            </div>
            <div>
              <Label htmlFor="f-server">Server</Label>
              <Input id="f-server" value={server} onChange={setServer} placeholder="e.g. Jenova" />
            </div>
            <div>
              <Label htmlFor="f-tz">Timezone</Label>
              <Input id="f-tz" value={timezone} onChange={setTimezone} placeholder="e.g. EST" />
            </div>
            <div>
              <Label htmlFor="f-lang">Language</Label>
              <Input id="f-lang" value={language} onChange={setLanguage} placeholder="e.g. en" />
            </div>
          </div>
          {hasFilters && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                Clear filters
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
        <div className="p-4 bg-status-error/10 border border-status-error/30 rounded-lg text-status-error text-center">
          {error}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Search className="w-8 h-8" />}
          heading="No statics found"
          description={hasFilters
            ? 'Try adjusting your filters to see more results.'
            : 'No statics are currently listed for discovery. Check back later!'}
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
    <div className="bg-surface-card border border-border-default rounded-lg p-4 hover:border-accent/30 transition-colors">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-lg font-display font-semibold text-text-primary truncate">
            {item.name}
          </h3>
          {(item.dataCenter || item.server) && (
            <div className="flex items-center gap-1.5 text-text-secondary text-sm mt-0.5">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">
                {[item.dataCenter, item.server].filter(Boolean).join(' — ')}
              </span>
            </div>
          )}
        </div>
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0 ${statusClass}`}>
          {item.recruitmentStatus}
        </span>
      </div>

      {/* Description */}
      {item.description && (
        <p className="text-text-secondary text-sm mb-3 line-clamp-2">{item.description}</p>
      )}

      {/* Tags row */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {item.intensity && (
          <span className="px-2 py-0.5 bg-accent/10 text-accent border border-accent/20 rounded text-xs">
            {item.intensity}
          </span>
        )}
        {item.languages?.map(l => (
          <span key={l} className="px-2 py-0.5 bg-surface-elevated text-text-secondary border border-border-default rounded text-xs">
            {l.toUpperCase()}
          </span>
        ))}
        {item.timezone && (
          <span className="px-2 py-0.5 bg-surface-elevated text-text-secondary border border-border-default rounded text-xs flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {item.timezone}
          </span>
        )}
      </div>

      {/* Needed roles/jobs */}
      {(item.neededRoles?.length || item.neededJobs?.length) ? (
        <div className="mb-3">
          <p className="text-text-muted text-xs mb-1 font-medium uppercase tracking-wide">Recruiting</p>
          <div className="flex flex-wrap gap-1">
            {item.neededRoles?.map(r => (
              <span key={r} className="px-2 py-0.5 bg-surface-elevated text-text-primary border border-border-default rounded text-xs capitalize">
                {r}
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
        <div className="flex items-center gap-1.5 text-text-secondary text-xs mb-3">
          <Swords className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            {item.scheduleDays.join(', ')}
            {item.scheduleStartTime && ` ${item.scheduleStartTime}`}
            {item.scheduleEndTime && `–${item.scheduleEndTime}`}
          </span>
        </div>
      ) : null}

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
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 border border-accent/30 hover:border-accent/50 rounded-lg text-accent text-sm font-medium transition-colors"
        >
          View Static
        </Link>
      </div>

      {/* Contact hint */}
      {!item.description && (
        <p className="text-text-muted text-xs mt-2 italic">
          Request-to-join is coming soon. View the static page for more info.
        </p>
      )}
    </div>
  );
}

export default Discover;
