/**
 * Discovery Tab - Static discovery/recruitment settings
 *
 * Lets owners/leads configure how their static appears in public discovery.
 * Uses dropdowns, chips, and "Suggest from static" for assisted setup.
 */

import { useState, useCallback } from 'react';
import { Globe, AlertTriangle, Sparkles, Info } from 'lucide-react';
import { Label, Select, Toggle, TextArea } from '../ui';
import { Button } from '../primitives';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { toast } from '../../stores/toastStore';
import { authRequest } from '../../services/api';
import {
  getJobsByRole,
  DC_NAMES,
  getWorldsForDC,
  TIMEZONES,
  LANGUAGES,
  RAID_DAYS,
  TIME_SLOTS,
  type Role,
} from '../../gamedata';
import type { StaticGroup, DiscoverySettings } from '../../types';

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
  { value: 'open', label: 'Open' },
  { value: 'limited', label: 'Limited' },
  { value: 'closed', label: 'Closed' },
];

const EMPTY_DISCOVERY: DiscoverySettings = {
  enabled: false,
  recruitmentStatus: 'closed',
};

// Job groups for organized chip display
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

/** Toggle chip component for compact multi-select */
function Chip({
  label,
  active,
  onClick,
  disabled,
  className = '',
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
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
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
    >
      {label}
    </button>
  );
}

export function DiscoveryTab({ group, onClose }: DiscoveryTabProps) {
  const { updateGroup } = useStaticGroupStore();
  const existing = getDiscovery(group);

  const [enabled, setEnabled] = useState(existing.enabled);
  const [recruitmentStatus, setRecruitmentStatus] = useState(existing.recruitmentStatus);
  const [description, setDescription] = useState(existing.description ?? '');
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

  const [isSaving, setIsSaving] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = group.userRole === 'owner' || group.userRole === 'lead';

  const toggleInList = useCallback((list: string[], item: string, setter: (v: string[]) => void) => {
    setter(list.includes(item) ? list.filter(x => x !== item) : [...list, item]);
  }, []);

  // Server options depend on selected DC
  const serverOptions = dataCenter
    ? [{ value: '', label: 'Any server' }, ...getWorldsForDC(dataCenter).map(w => ({ value: w, label: w }))]
    : [{ value: '', label: 'Select a data center first' }];

  // Timezone options for Select
  const tzOptions = [
    { value: '', label: 'Not specified' },
    ...TIMEZONES.map(tz => ({ value: tz.value, label: tz.label })),
  ];

  // Time slot options for Select
  const timeOptions = [
    { value: '', label: 'Not set' },
    ...TIME_SLOTS.map(t => ({ value: t, label: t })),
  ];

  // DC options grouped by region
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

      // Only fill empty fields
      if (!timezone && suggestions.timezone) {
        setTimezone(suggestions.timezone as string);
        filled++;
      }
      if (!server && suggestions.server) {
        setServer(suggestions.server as string);
        filled++;
      }
      if (scheduleDays.length === 0 && Array.isArray(suggestions.scheduleDays)) {
        setScheduleDays(suggestions.scheduleDays as string[]);
        filled++;
      }
      if (!scheduleStartTime && suggestions.scheduleStartTime) {
        setScheduleStartTime(suggestions.scheduleStartTime as string);
        filled++;
      }
      if (!scheduleEndTime && suggestions.scheduleEndTime) {
        setScheduleEndTime(suggestions.scheduleEndTime as string);
        filled++;
      }
      if (neededRoles.length === 0 && Array.isArray(suggestions.neededRoles)) {
        setNeededRoles(suggestions.neededRoles as string[]);
        filled++;
      }

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
    };

    try {
      await updateGroup(group.id, {
        settings: { ...group.settings, discovery },
      });
      toast.success('Discovery settings saved!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset server when DC changes
  const handleDCChange = (dc: string) => {
    setDataCenter(dc);
    if (dc !== dataCenter) {
      setServer('');
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto space-y-5 min-h-0 ml-[3px]" style={{ scrollbarGutter: 'stable' }}>
        {error && (
          <div className="p-3 bg-status-error/10 border border-status-error/30 rounded-lg text-status-error text-sm">
            {error}
          </div>
        )}

        {/* Privacy info */}
        <div className="p-3 bg-surface-elevated border border-border-default rounded-lg flex items-start gap-2">
          <Info className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
          <div className="text-xs text-text-secondary">
            <p><strong className="text-text-primary">Public Static</strong> = anyone with the share link can view your static (read-only).</p>
            <p className="mt-1"><strong className="text-text-primary">Discovery Listing</strong> = your static appears in the public browse directory. Both must be enabled.</p>
            <p className="mt-1">Discovery never exposes private notes, RSVP details, gear data, or member Discord IDs.</p>
          </div>
        </div>

        {/* Warning if group is not public */}
        {!group.isPublic && (
          <div className="p-3 bg-status-warning/10 border border-status-warning/30 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-status-warning flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-status-warning">Static is private</p>
              <p className="text-text-secondary mt-0.5">
                Enable &quot;Public Static&quot; in the General tab first. Discovery only works for public statics.
              </p>
            </div>
          </div>
        )}

        {/* Enable discovery */}
        <Toggle
          checked={enabled}
          onChange={setEnabled}
          disabled={!canEdit}
          label="List in discovery"
          hint="Your static appears in the public browse page for players looking for groups"
        />

        {enabled && (
          <>
            {/* Suggest from static */}
            {canEdit && (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSuggest}
                  loading={isSuggesting}
                >
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  Suggest from static
                </Button>
                <span className="text-text-muted text-xs">
                  Fills empty fields from your schedule and roster
                </span>
              </div>
            )}

            {/* Recruitment status */}
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

            {/* Description */}
            <div>
              <Label htmlFor="discoveryDesc">Description &amp; Contact Info</Label>
              <TextArea
                id="discoveryDesc"
                value={description}
                onChange={setDescription}
                placeholder="Tell potential recruits about your static. Include contact info (e.g. Discord tag) so interested players can reach you."
                rows={3}
                maxLength={500}
                disabled={!canEdit}
              />
              <p className="text-text-muted text-xs mt-1">{description.length}/500</p>
            </div>

            {/* Intensity */}
            <div>
              <Label htmlFor="intensity">Intensity</Label>
              <Select
                id="intensity"
                value={intensity}
                onChange={setIntensity}
                options={INTENSITY_OPTIONS}
                disabled={!canEdit}
              />
            </div>

            {/* Data Center / Server dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dataCenter">Data Center</Label>
                <Select
                  id="dataCenter"
                  value={dataCenter}
                  onChange={handleDCChange}
                  options={dcOptions}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <Label htmlFor="server">Server</Label>
                <Select
                  id="server"
                  value={server}
                  onChange={setServer}
                  options={serverOptions}
                  disabled={!canEdit || !dataCenter}
                />
              </div>
            </div>

            {/* Timezone dropdown */}
            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                id="timezone"
                value={timezone}
                onChange={setTimezone}
                options={tzOptions}
                disabled={!canEdit}
              />
            </div>

            {/* Languages — chips */}
            <div>
              <Label>Languages</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {LANGUAGES.map(l => (
                  <Chip
                    key={l.code}
                    label={l.label}
                    active={selectedLangs.includes(l.code)}
                    onClick={() => toggleInList(selectedLangs, l.code, setSelectedLangs)}
                    disabled={!canEdit}
                  />
                ))}
              </div>
            </div>

            {/* Needed Roles — chips */}
            <div>
              <Label>Roles Recruiting</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {ROLES.map(r => (
                  <Chip
                    key={r.value}
                    label={r.label}
                    active={neededRoles.includes(r.value)}
                    onClick={() => toggleInList(neededRoles, r.value, setNeededRoles)}
                    disabled={!canEdit}
                  />
                ))}
              </div>
            </div>

            {/* Needed Jobs — grouped chips */}
            <div>
              <Label>Jobs Recruiting</Label>
              <div className="space-y-2 mt-1">
                {JOB_GROUPS.map(g => (
                  <div key={g.role}>
                    <p className="text-text-muted text-xs mb-1">{g.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {getJobsByRole(g.role).map(j => (
                        <Chip
                          key={j.abbreviation}
                          label={j.abbreviation}
                          active={neededJobs.includes(j.abbreviation)}
                          onClick={() => toggleInList(neededJobs, j.abbreviation, setNeededJobs)}
                          disabled={!canEdit}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Schedule Days — chips */}
            <div>
              <Label>Raid Days</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {RAID_DAYS.map(d => (
                  <Chip
                    key={d}
                    label={d.slice(0, 3)}
                    active={scheduleDays.includes(d)}
                    onClick={() => toggleInList(scheduleDays, d, setScheduleDays)}
                    disabled={!canEdit}
                  />
                ))}
              </div>
            </div>

            {/* Schedule Time Window — dropdowns */}
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startTime">Start Time</Label>
                  <Select
                    id="startTime"
                    value={scheduleStartTime}
                    onChange={setScheduleStartTime}
                    options={timeOptions}
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <Label htmlFor="endTime">End Time</Label>
                  <Select
                    id="endTime"
                    value={scheduleEndTime}
                    onChange={setScheduleEndTime}
                    options={timeOptions}
                    disabled={!canEdit}
                  />
                </div>
              </div>
              {timezone && (
                <p className="text-text-muted text-xs mt-1">
                  Times are in {TIMEZONES.find(t => t.value === timezone)?.label ?? timezone}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Sticky footer */}
      <div className="flex-shrink-0 flex justify-end gap-3 pt-4 pb-4 pr-4 border-t border-border-default">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={!canEdit}
          loading={isSaving}
        >
          <Globe className="w-4 h-4 mr-1.5" />
          Save
        </Button>
      </div>
    </div>
  );
}
