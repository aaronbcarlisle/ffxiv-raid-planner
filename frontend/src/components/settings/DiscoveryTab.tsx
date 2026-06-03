/**
 * Discovery Tab — Static listing / recruitment settings
 *
 * Lets owners/leads configure how their static appears in the Static Finder.
 * Includes listing status summary, preview card, and "Suggest from static".
 */

import { useState, useCallback } from 'react';
import {
  Globe, AlertTriangle, Sparkles, Info,
  CheckCircle2, XCircle, Clock, MapPin, Swords, Users, Eye, MessageCircle,
} from 'lucide-react';
import { Label, Select, Toggle, TextArea, Input } from '../ui';
import { Button } from '../primitives';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { toast } from '../../stores/toastStore';
import { authRequest } from '../../services/api';
import {
  getJobsByRole,
  DC_NAMES,
  getWorldsForDC,
  getDCForWorld,
  TIMEZONES,
  LANGUAGES,
  RAID_DAYS,
  TIME_SLOTS,
  type Role,
} from '../../gamedata';
import type { StaticGroup, DiscoverySettings, ContactMethod } from '../../types';

// ─── Constants ───────────────────────────────────────────────

interface DiscoveryTabProps {
  group: StaticGroup;
  onClose: () => void;
}

const ROLES: { value: Role; label: string }[] = [
  { value: 'tank', label: 'Tank' },
  { value: 'healer', label: 'Healer' },
  { value: 'melee', label: 'Melee' },
  { value: 'ranged', label: 'Physical Ranged' },
  { value: 'caster', label: 'Caster' },
];

const INTENSITY_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'casual', label: 'Casual' },
  { value: 'midcore', label: 'Midcore' },
  { value: 'hardcore', label: 'Hardcore' },
];

const RECRUITMENT_OPTIONS = [
  { value: 'open', label: 'Open — actively recruiting' },
  { value: 'limited', label: 'Limited — specific roles only' },
  { value: 'closed', label: 'Closed — not recruiting' },
];

const CONTACT_METHOD_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'discord', label: 'Discord tag' },
  { value: 'discord_server', label: 'Discord server invite' },
  { value: 'url', label: 'Link (Lodestone, website, etc.)' },
  { value: 'text', label: 'Other / instructions' },
];

const CONTACT_PLACEHOLDERS: Record<string, string> = {
  discord: 'e.g. username#1234 or @username',
  discord_server: 'e.g. https://discord.gg/abcdef',
  url: 'e.g. https://na.finalfantasyxiv.com/lodestone/...',
  text: 'e.g. DM me on Twitter @handle',
};

const EMPTY_DISCOVERY: DiscoverySettings = {
  enabled: false,
  recruitmentStatus: 'closed',
};

const JOB_GROUPS: { label: string; role: Role }[] = [
  { label: 'Tank', role: 'tank' },
  { label: 'Healer', role: 'healer' },
  { label: 'Melee', role: 'melee' },
  { label: 'Phys. Ranged', role: 'ranged' },
  { label: 'Caster', role: 'caster' },
];

function getDiscovery(group: StaticGroup): DiscoverySettings {
  return group.settings?.discovery ?? EMPTY_DISCOVERY;
}

// ─── Section heading ────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-text-muted text-[10px] font-semibold uppercase tracking-wider pt-2 first:pt-0">
      {children}
    </p>
  );
}

// ─── Chip component ──────────────────────────────────────────

function Chip({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    /* design-system-ignore: toggle chip for multi-select, not a standalone button */
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
        active
          ? 'bg-accent/20 text-accent border-accent/40'
          : 'bg-surface-elevated text-text-secondary border-border-default hover:border-border-subtle'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {label}
    </button>
  );
}

// ─── Listing Status Banner ───────────────────────────────────

function ListingStatus({ group, enabled }: { group: StaticGroup; enabled: boolean }) {
  const isPublic = group.isPublic;
  const isLive = isPublic && enabled;

  if (isLive) {
    return (
      <div className="p-3 bg-status-success/10 border border-status-success/30 rounded-lg flex items-start gap-2">
        <CheckCircle2 className="w-4 h-4 text-status-success flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-status-success">Listed in Static Finder</p>
          <p className="text-text-secondary mt-0.5 text-xs">Players can find your static at <span className="font-mono text-text-primary">/discover</span></p>
        </div>
      </div>
    );
  }

  if (!isPublic && enabled) {
    return (
      <div className="p-3 bg-status-warning/10 border border-status-warning/30 rounded-lg flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-status-warning flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-status-warning">Not listed — static is private</p>
          <p className="text-text-secondary mt-0.5 text-xs">
            Turn on &quot;Public Static&quot; in the General tab to go live.
          </p>
        </div>
      </div>
    );
  }

  if (isPublic && !enabled) {
    return (
      <div className="p-3 bg-surface-elevated border border-border-default rounded-lg flex items-start gap-2">
        <XCircle className="w-4 h-4 text-text-muted flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-text-secondary">Not listed — listing is off</p>
          <p className="text-text-muted mt-0.5 text-xs">Flip the toggle below to appear in Static Finder.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-surface-elevated border border-border-default rounded-lg flex items-start gap-2">
      <XCircle className="w-4 h-4 text-text-muted flex-shrink-0 mt-0.5" />
      <div className="text-sm">
        <p className="font-medium text-text-secondary">Not listed</p>
        <p className="text-text-muted mt-0.5 text-xs">Turn on &quot;Public Static&quot; in General, then enable the listing toggle here.</p>
      </div>
    </div>
  );
}

// ─── Listing Preview Card ────────────────────────────────────

function ListingPreview({
  name, recruitmentStatus, description, intensity,
  dataCenter, server, timezone, neededRoles, neededJobs,
  scheduleDays, scheduleStartTime, scheduleEndTime,
  selectedLangs, memberCount, contactMethod, contactValue,
}: {
  name: string;
  recruitmentStatus: string;
  description: string;
  intensity: string;
  dataCenter: string;
  server: string;
  timezone: string;
  neededRoles: string[];
  neededJobs: string[];
  scheduleDays: string[];
  scheduleStartTime: string;
  scheduleEndTime: string;
  selectedLangs: string[];
  memberCount: number;
  contactMethod: string;
  contactValue: string;
}) {
  const STATUS_COLORS: Record<string, string> = {
    open: 'bg-status-success/20 text-status-success border-status-success/30',
    limited: 'bg-status-warning/20 text-status-warning border-status-warning/30',
    closed: 'bg-status-error/20 text-status-error border-status-error/30',
  };
  const statusClass = STATUS_COLORS[recruitmentStatus] ?? STATUS_COLORS.closed;
  const tzDisplay = TIMEZONES.find(t => t.value === timezone)?.label ?? timezone;
  const shortDayName = (d: string) => d.length > 3 ? d.slice(0, 3) : d;

  return (
    <div className="border border-border-default rounded-lg bg-surface-base overflow-hidden">
      <div className="px-3 py-2 bg-surface-elevated border-b border-border-default flex items-center gap-1.5 text-text-muted text-xs">
        <Eye className="w-3.5 h-3.5" />
        <span className="font-medium">Listing preview</span>
      </div>
      <div className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <span className="font-display font-semibold text-sm text-text-primary break-words min-w-0">{name}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border flex-shrink-0 capitalize ${statusClass}`}>
            {recruitmentStatus}
          </span>
        </div>

        {/* Location row */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-secondary">
          {(dataCenter || server) && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {[dataCenter, server].filter(Boolean).join(' — ')}
            </span>
          )}
          {timezone && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {tzDisplay}
            </span>
          )}
          {intensity && (
            <span className="px-1.5 py-0.5 bg-accent/10 text-accent border border-accent/20 rounded text-[10px] capitalize">
              {intensity}
            </span>
          )}
        </div>

        {/* Schedule */}
        {scheduleDays.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-text-secondary">
            <Swords className="w-3 h-3 text-text-muted" />
            <span>
              {scheduleDays.map(shortDayName).join(', ')}
              {scheduleStartTime && ` ${scheduleStartTime}`}
              {scheduleEndTime && `–${scheduleEndTime}`}
            </span>
          </div>
        )}

        {/* Needs */}
        {(neededRoles.length > 0 || neededJobs.length > 0) && (
          <div className="flex flex-wrap gap-1">
            {neededRoles.map(r => (
              <span key={r} className="px-1.5 py-0.5 bg-accent/10 text-accent border border-accent/20 rounded text-[10px] capitalize">
                {r === 'ranged' ? 'Phys. Ranged' : r}
              </span>
            ))}
            {neededJobs.map(j => (
              <span key={j} className="px-1.5 py-0.5 bg-surface-elevated text-text-primary border border-border-default rounded text-[10px] font-mono">
                {j}
              </span>
            ))}
          </div>
        )}

        {/* Languages */}
        {selectedLangs.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedLangs.map(l => (
              <span key={l} className="px-1.5 py-0.5 bg-surface-elevated text-text-secondary border border-border-default rounded text-[10px]">
                {LANGUAGES.find(la => la.code === l)?.label ?? l}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        {description ? (
          <p className="text-text-secondary text-xs line-clamp-2 break-words">{description}</p>
        ) : (
          <p className="text-text-muted text-xs italic">No description — add one above</p>
        )}

        {/* Contact */}
        {contactMethod && contactValue && (
          <div className="flex items-center gap-1 text-xs text-accent min-w-0">
            <MessageCircle className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{contactValue}</span>
          </div>
        )}

        {/* Footer */}
        {memberCount > 0 && (
          <div className="flex items-center gap-1 text-text-muted text-[10px] pt-1 border-t border-border-default">
            <Users className="w-3 h-3" />
            <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

export function DiscoveryTab({ group, onClose }: DiscoveryTabProps) {
  const { updateGroup } = useStaticGroupStore();
  const existing = getDiscovery(group);

  const [enabled, setEnabled] = useState(existing.enabled);
  const [recruitmentStatus, setRecruitmentStatus] = useState(existing.recruitmentStatus);
  const [description, setDescription] = useState(existing.description ?? '');
  const [contactMethod, setContactMethod] = useState<ContactMethod | ''>(existing.contactMethod ?? '');
  const [contactValue, setContactValue] = useState(existing.contactValue ?? '');
  const [intensity, setIntensity] = useState(existing.intensity ?? '');
  const [dataCenter, setDataCenter] = useState(existing.dataCenter ?? '');
  const [server, setServer] = useState(existing.server ?? '');
  const [timezone, setTimezone] = useState(existing.timezone ?? '');
  const [selectedLangs, setSelectedLangs] = useState<string[]>(existing.languages ?? []);
  const [neededRoles, setNeededRoles] = useState<string[]>(existing.neededRoles ?? []);
  const [neededJobs, setNeededJobs] = useState<string[]>(existing.neededJobs ?? []);
  const [scheduleDays, setScheduleDays] = useState<string[]>(existing.scheduleDays ?? []);
  const [scheduleStartTime, setScheduleStartTime] = useState(existing.scheduleStartTime ?? '');
  const [scheduleEndTime, setScheduleEndTime] = useState(existing.scheduleEndTime ?? '');
  const [showMemberCount, setShowMemberCount] = useState(existing.showMemberCount ?? false);

  const [isSaving, setIsSaving] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = group.userRole === 'owner' || group.userRole === 'lead';

  const toggleInList = useCallback((list: string[], item: string, setter: (v: string[]) => void) => {
    setter(list.includes(item) ? list.filter(x => x !== item) : [...list, item]);
  }, []);

  const serverOptions = dataCenter
    ? [{ value: '', label: 'Any server' }, ...getWorldsForDC(dataCenter).map(w => ({ value: w, label: w }))]
    : [{ value: '', label: 'Select a data center first' }];

  const tzOptions = [
    { value: '', label: 'Not specified' },
    ...TIMEZONES.map(tz => ({ value: tz.value, label: tz.label })),
  ];
  const timeOptions = [
    { value: '', label: 'Not set' },
    ...TIME_SLOTS.map(t => ({ value: t, label: t })),
  ];
  const dcOptions = [
    { value: '', label: 'Not specified' },
    ...DC_NAMES.map(dc => ({ value: dc, label: dc })),
  ];

  const handleSuggest = async () => {
    setIsSuggesting(true);
    try {
      const suggestions = await authRequest<Record<string, unknown>>(
        `/api/static-groups/${group.id}/discovery/suggestions`
      );
      let filled = 0;
      if (!timezone && suggestions.timezone) { setTimezone(suggestions.timezone as string); filled++; }
      if (!server && suggestions.server) {
        const suggestedServer = suggestions.server as string;
        setServer(suggestedServer);
        filled++;
        // Auto-detect DC from server if DC is empty
        if (!dataCenter) {
          const detectedDC = getDCForWorld(suggestedServer);
          if (detectedDC) {
            setDataCenter(detectedDC);
            filled++;
          }
        }
      }
      if (scheduleDays.length === 0 && Array.isArray(suggestions.scheduleDays)) { setScheduleDays(suggestions.scheduleDays as string[]); filled++; }
      if (!scheduleStartTime && suggestions.scheduleStartTime) { setScheduleStartTime(suggestions.scheduleStartTime as string); filled++; }
      if (!scheduleEndTime && suggestions.scheduleEndTime) { setScheduleEndTime(suggestions.scheduleEndTime as string); filled++; }
      if (neededRoles.length === 0 && Array.isArray(suggestions.neededRoles)) { setNeededRoles(suggestions.neededRoles as string[]); filled++; }

      if (filled > 0) {
        toast.success(`Filled ${filled} field${filled > 1 ? 's' : ''} from your static data`);
      } else {
        toast.info('All fields already have values, or no suggestions available');
      }
    } catch {
      toast.error('Could not load suggestions');
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    const discovery: DiscoverySettings = {
      enabled,
      recruitmentStatus: recruitmentStatus as DiscoverySettings['recruitmentStatus'],
      description: description || undefined,
      contactMethod: (contactMethod || undefined) as DiscoverySettings['contactMethod'],
      contactValue: contactMethod && contactValue ? contactValue.trim().slice(0, 200) : undefined,
      intensity: (intensity || undefined) as DiscoverySettings['intensity'],
      dataCenter: dataCenter || undefined,
      server: server || undefined,
      timezone: timezone || undefined,
      languages: selectedLangs.length > 0 ? selectedLangs : undefined,
      neededRoles: neededRoles.length > 0 ? neededRoles : undefined,
      neededJobs: neededJobs.length > 0 ? neededJobs : undefined,
      scheduleDays: scheduleDays.length > 0 ? scheduleDays : undefined,
      scheduleStartTime: scheduleStartTime || undefined,
      scheduleEndTime: scheduleEndTime || undefined,
      showMemberCount,
    };

    try {
      await updateGroup(group.id, {
        settings: { ...group.settings, discovery },
      });
      // Contextual success message
      if (enabled && group.isPublic) {
        toast.success('Saved! Your listing is live in Static Finder.');
      } else if (enabled && !group.isPublic) {
        toast.success('Saved! It will go live once Public Static is enabled.');
      } else {
        toast.success('Listing settings saved.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDCChange = (dc: string) => {
    setDataCenter(dc);
    if (dc !== dataCenter) setServer('');
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto space-y-5 min-h-0 ml-[3px]" style={{ scrollbarGutter: 'stable' }}>
        {error && (
          <div className="p-3 bg-status-error/10 border border-status-error/30 rounded-lg text-status-error text-sm">
            {error}
          </div>
        )}

        {/* ─── Listing status banner ─── */}
        <ListingStatus group={group} enabled={enabled} />

        {/* ─── Privacy info ─── */}
        <div className="p-3 bg-surface-elevated border border-border-default rounded-lg flex items-start gap-2">
          <Info className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
          <div className="text-xs text-text-secondary leading-relaxed">
            Your listing only shows the public details you choose here.
            Private notes, RSVP details, gear data, and member Discord IDs stay hidden.
          </div>
        </div>

        {/* ─── Toggle ─── */}
        <Toggle
          checked={enabled}
          onChange={setEnabled}
          disabled={!canEdit}
          label="List in Static Finder"
          hint="Players can discover your static when browsing for groups"
        />

        {enabled && (
          <>
            {/* ─── Suggest button ─── */}
            {canEdit && (
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="secondary" size="sm" onClick={handleSuggest} loading={isSuggesting}>
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  Fill from schedule &amp; roster
                </Button>
                <span className="text-text-muted text-xs">Only fills empty fields — won&apos;t overwrite your edits</span>
              </div>
            )}

            {/* ─── Recruitment status ─── */}
            <div>
              <Label htmlFor="recruitmentStatus">Recruitment Status</Label>
              <Select
                id="recruitmentStatus"
                value={recruitmentStatus}
                onChange={(v) => setRecruitmentStatus(v as DiscoverySettings['recruitmentStatus'])}
                options={RECRUITMENT_OPTIONS}
                disabled={!canEdit}
              />
            </div>

            {/* ─── About your static ─── */}
            <SectionHeading>About Your Static</SectionHeading>

            <div className="p-2.5 bg-status-warning/5 border border-status-warning/20 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-status-warning flex-shrink-0 mt-0.5" />
              <p className="text-xs text-text-secondary">
                Description and contact info below are <strong className="text-text-primary">public</strong> — visible to anyone browsing Static Finder. Do not include anything you want to keep private.
              </p>
            </div>

            <div>
              <Label htmlFor="discoveryDesc">Description</Label>
              <TextArea
                id="discoveryDesc"
                value={description}
                onChange={setDescription}
                placeholder="Tell recruits about your static — goals, vibe, loot rules, raid history."
                rows={3}
                maxLength={500}
                disabled={!canEdit}
              />
              <p className="text-text-muted text-xs mt-1">{description.length}/500</p>
            </div>

            <div>
              <Label htmlFor="intensity">Vibe</Label>
              <Select id="intensity" value={intensity} onChange={setIntensity} options={INTENSITY_OPTIONS} disabled={!canEdit} />
            </div>

            {/* ─── Contact info ─── */}
            <SectionHeading>Contact Info</SectionHeading>

            <div>
              <p className="text-text-muted text-xs mb-2">
                How should interested players reach you? Add a Discord tag, server invite, community link, or instructions.
              </p>
              <Select
                id="contactMethod"
                value={contactMethod}
                onChange={(v) => {
                  setContactMethod(v as ContactMethod | '');
                  if (!v) setContactValue('');
                }}
                options={CONTACT_METHOD_OPTIONS}
                disabled={!canEdit}
              />
              {contactMethod && (
                <div className="mt-2">
                  <Input
                    value={contactValue}
                    onChange={setContactValue}
                    placeholder={CONTACT_PLACEHOLDERS[contactMethod] ?? ''}
                    maxLength={200}
                    disabled={!canEdit}
                  />
                  <p className="text-text-muted text-xs mt-1">{contactValue.length}/200</p>
                </div>
              )}
            </div>

            {/* ─── Location ─── */}
            <SectionHeading>Location</SectionHeading>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dataCenter">Data Center</Label>
                <Select id="dataCenter" value={dataCenter} onChange={handleDCChange} options={dcOptions} disabled={!canEdit} />
              </div>
              <div>
                <Label htmlFor="server">Server</Label>
                <Select id="server" value={server} onChange={setServer} options={serverOptions} disabled={!canEdit || !dataCenter} />
              </div>
            </div>

            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Select id="timezone" value={timezone} onChange={setTimezone} options={tzOptions} disabled={!canEdit} />
            </div>

            <div>
              <Label>Languages</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {LANGUAGES.map(l => (
                  <Chip key={l.code} label={l.label} active={selectedLangs.includes(l.code)} onClick={() => toggleInList(selectedLangs, l.code, setSelectedLangs)} disabled={!canEdit} />
                ))}
              </div>
            </div>

            {/* ─── Who you're looking for ─── */}
            <SectionHeading>Who You&apos;re Looking For</SectionHeading>

            <div>
              <Label>Roles Recruiting</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {ROLES.map(r => (
                  <Chip key={r.value} label={r.label} active={neededRoles.includes(r.value)} onClick={() => toggleInList(neededRoles, r.value, setNeededRoles)} disabled={!canEdit} />
                ))}
              </div>
            </div>

            <div>
              <Label>Jobs Recruiting</Label>
              <div className="space-y-2 mt-1">
                {JOB_GROUPS.map(g => (
                  <div key={g.role}>
                    <p className="text-text-muted text-xs mb-1">{g.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {getJobsByRole(g.role).map(j => (
                        <Chip key={j.abbreviation} label={j.abbreviation} active={neededJobs.includes(j.abbreviation)} onClick={() => toggleInList(neededJobs, j.abbreviation, setNeededJobs)} disabled={!canEdit} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ─── Raid schedule ─── */}
            <SectionHeading>Raid Schedule</SectionHeading>

            <div>
              <Label>Raid Days</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {RAID_DAYS.map(d => (
                  <Chip key={d} label={d.slice(0, 3)} active={scheduleDays.includes(d)} onClick={() => toggleInList(scheduleDays, d, setScheduleDays)} disabled={!canEdit} />
                ))}
              </div>
            </div>

            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startTime">Start Time</Label>
                  <Select id="startTime" value={scheduleStartTime} onChange={setScheduleStartTime} options={timeOptions} disabled={!canEdit} />
                </div>
                <div>
                  <Label htmlFor="endTime">End Time</Label>
                  <Select id="endTime" value={scheduleEndTime} onChange={setScheduleEndTime} options={timeOptions} disabled={!canEdit} />
                </div>
              </div>
              {timezone && (
                <p className="text-text-muted text-xs mt-1">
                  Times are in {TIMEZONES.find(t => t.value === timezone)?.label ?? timezone}
                </p>
              )}
            </div>

            {/* ─── Visibility ─── */}
            <SectionHeading>Visibility</SectionHeading>

            <Toggle
              checked={showMemberCount}
              onChange={setShowMemberCount}
              disabled={!canEdit}
              label="Show member count on listing"
              hint="Optional. Helps applicants see how full your group is."
            />

            {/* ─── Listing Preview ─── */}
            <SectionHeading>Public Preview</SectionHeading>

            <div>
              <p className="text-text-muted text-xs mb-2">This is exactly what players will see in Static Finder.</p>
              <ListingPreview
                name={group.name}
                recruitmentStatus={recruitmentStatus}
                description={description}
                intensity={intensity}
                dataCenter={dataCenter}
                server={server}
                timezone={timezone}
                neededRoles={neededRoles}
                neededJobs={neededJobs}
                scheduleDays={scheduleDays}
                scheduleStartTime={scheduleStartTime}
                scheduleEndTime={scheduleEndTime}
                selectedLangs={selectedLangs}
                memberCount={showMemberCount ? group.memberCount : 0}
                contactMethod={contactMethod}
                contactValue={contactValue}
              />
            </div>
          </>
        )}
      </div>

      {/* ─── Sticky footer ─── */}
      <div className="flex-shrink-0 flex justify-end gap-3 pt-4 pb-4 pr-4 border-t border-border-default">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!canEdit} loading={isSaving}>
          <Globe className="w-4 h-4 mr-1.5" />
          Save
        </Button>
      </div>
    </div>
  );
}
