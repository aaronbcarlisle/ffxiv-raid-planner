/**
 * Discovery Tab - Static discovery/recruitment settings
 *
 * Lets owners/leads configure how their static appears in public discovery.
 */

import { useState, useCallback } from 'react';
import { Globe, AlertTriangle } from 'lucide-react';
import { Label, Input, Select, Toggle, TextArea, Checkbox } from '../ui';
import { Button } from '../primitives';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { toast } from '../../stores/toastStore';
import { RAID_JOBS, type Role } from '../../gamedata';
import type { StaticGroup, DiscoverySettings } from '../../types';

interface DiscoveryTabProps {
  group: StaticGroup;
  onClose: () => void;
}

const ROLES: { value: Role; label: string }[] = [
  { value: 'tank', label: 'Tank' },
  { value: 'healer', label: 'Healer' },
  { value: 'melee', label: 'Melee' },
  { value: 'ranged', label: 'Ranged' },
  { value: 'caster', label: 'Caster' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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

function getDiscovery(group: StaticGroup): DiscoverySettings {
  return group.settings?.discovery ?? EMPTY_DISCOVERY;
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
  const [languages, setLanguages] = useState(existing.languages?.join(', ') ?? '');
  const [neededRoles, setNeededRoles] = useState<string[]>(existing.neededRoles ?? []);
  const [neededJobs, setNeededJobs] = useState<string[]>(existing.neededJobs ?? []);
  const [scheduleDays, setScheduleDays] = useState<string[]>(existing.scheduleDays ?? []);
  const [scheduleStartTime, setScheduleStartTime] = useState(existing.scheduleStartTime ?? '');
  const [scheduleEndTime, setScheduleEndTime] = useState(existing.scheduleEndTime ?? '');

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = group.userRole === 'owner' || group.userRole === 'lead';

  const toggleInList = useCallback((list: string[], item: string, setter: (v: string[]) => void) => {
    setter(list.includes(item) ? list.filter(x => x !== item) : [...list, item]);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    const langList = languages.split(',').map(l => l.trim()).filter(Boolean);

    const discovery: DiscoverySettings = {
      enabled,
      recruitmentStatus: recruitmentStatus as DiscoverySettings['recruitmentStatus'],
      description: description || undefined,
      intensity: (intensity || undefined) as DiscoverySettings['intensity'],
      dataCenter: dataCenter || undefined,
      server: server || undefined,
      timezone: timezone || undefined,
      languages: langList.length > 0 ? langList : undefined,
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

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto space-y-6 min-h-0 ml-[3px]" style={{ scrollbarGutter: 'stable' }}>
        {error && (
          <div className="p-3 bg-status-error/10 border border-status-error/30 rounded-lg text-status-error text-sm">
            {error}
          </div>
        )}

        {/* Warning if group is not public */}
        {!group.isPublic && (
          <div className="p-3 bg-status-warning/10 border border-status-warning/30 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-status-warning flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-status-warning">Static is private</p>
              <p className="text-text-secondary mt-0.5">
                Discovery listing only works for public statics. Enable &quot;Public Static&quot; in the General tab first.
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
          hint="When enabled, this static appears in the public discovery page for players looking for groups"
        />

        {enabled && (
          <>
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
              <Label htmlFor="discoveryDesc">Description</Label>
              <TextArea
                id="discoveryDesc"
                value={description}
                onChange={setDescription}
                placeholder="Tell potential recruits about your static. Include contact info (e.g. Discord tag) so interested players can reach you."
                rows={3}
                maxLength={500}
                disabled={!canEdit}
              />
              <p className="text-text-muted text-xs mt-1">{description.length}/500 — include a way to contact you (Discord tag, etc.)</p>
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

            {/* Data Center / Server */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dataCenter">Data Center</Label>
                <Input
                  id="dataCenter"
                  value={dataCenter}
                  onChange={setDataCenter}
                  placeholder="e.g. Aether"
                  disabled={!canEdit}
                />
              </div>
              <div>
                <Label htmlFor="server">Server</Label>
                <Input
                  id="server"
                  value={server}
                  onChange={setServer}
                  placeholder="e.g. Jenova"
                  disabled={!canEdit}
                />
              </div>
            </div>

            {/* Timezone */}
            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                value={timezone}
                onChange={setTimezone}
                placeholder="e.g. America/New_York or EST"
                disabled={!canEdit}
              />
            </div>

            {/* Languages */}
            <div>
              <Label htmlFor="languages">Languages</Label>
              <Input
                id="languages"
                value={languages}
                onChange={setLanguages}
                placeholder="e.g. en, ja, fr"
                disabled={!canEdit}
              />
              <p className="text-text-muted text-xs mt-1">Comma-separated language codes</p>
            </div>

            {/* Needed Roles */}
            <div>
              <Label>Roles Recruiting</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {ROLES.map(r => (
                  <Checkbox
                    key={r.value}
                    checked={neededRoles.includes(r.value)}
                    onChange={() => toggleInList(neededRoles, r.value, setNeededRoles)}
                    label={r.label}
                    disabled={!canEdit}
                  />
                ))}
              </div>
            </div>

            {/* Needed Jobs */}
            <div>
              <Label>Jobs Recruiting</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {RAID_JOBS.map(j => (
                  <Checkbox
                    key={j.abbreviation}
                    checked={neededJobs.includes(j.abbreviation)}
                    onChange={() => toggleInList(neededJobs, j.abbreviation, setNeededJobs)}
                    label={j.abbreviation}
                    disabled={!canEdit}
                  />
                ))}
              </div>
            </div>

            {/* Schedule Days */}
            <div>
              <Label>Raid Days</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {DAYS.map(d => (
                  <Checkbox
                    key={d}
                    checked={scheduleDays.includes(d)}
                    onChange={() => toggleInList(scheduleDays, d, setScheduleDays)}
                    label={d}
                    disabled={!canEdit}
                  />
                ))}
              </div>
            </div>

            {/* Schedule Time Window */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  value={scheduleStartTime}
                  onChange={setScheduleStartTime}
                  placeholder="e.g. 20:00"
                  disabled={!canEdit}
                />
              </div>
              <div>
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  value={scheduleEndTime}
                  onChange={setScheduleEndTime}
                  placeholder="e.g. 23:00"
                  disabled={!canEdit}
                />
              </div>
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
