/**
 * JobProfileModal - Add (multi) or edit a job profile
 */

import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../primitives/Button';
import { Select } from '../ui/Select';
import { TextArea } from '../ui/TextArea';
import { JobIcon } from '../ui/JobIcon';
import { usePlayerProfileStore } from '../../stores/playerProfileStore';
import type { PlayerJobProfile } from '../../stores/playerProfileStore';
import { RAID_JOBS, getRoleForJob, getJobDisplayName, type Role } from '../../gamedata/jobs';
import { hasUsableGearSnapshot } from './jobGearUtils';
import { toast } from '../../stores/toastStore';

const PRIORITIES = [
  { value: 'main', label: 'Main' },
  { value: 'preferred_alt', label: 'Preferred Alt' },
  { value: 'flex', label: 'Flex' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'casual', label: 'Casual' },
];

const READINESS_OPTIONS = [
  { value: 'ready', label: 'Ready' },
  { value: 'needs_gear', label: 'Needs Gear' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'not_ready', label: 'Not Ready' },
  { value: 'unknown', label: 'Unknown' },
];

const ROLE_FILTERS: { value: Role | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'tank', label: 'Tanks' },
  { value: 'healer', label: 'Healers' },
  { value: 'melee', label: 'Melee' },
  { value: 'ranged', label: 'Ranged' },
  { value: 'caster', label: 'Casters' },
];

interface JobProfileModalProps {
  existing?: PlayerJobProfile;
  onClose: () => void;
}

export function JobProfileModal({ existing, onClose }: JobProfileModalProps) {
  const { createJobProfile, updateJobProfile } = usePlayerProfileStore();
  const profile = usePlayerProfileStore((s) => s.profile);
  const gearSnapshots = usePlayerProfileStore((s) => s.gearSnapshots);
  const isEditing = !!existing;

  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [priority, setPriority] = useState(existing?.priority ?? 'flex');
  const [readiness, setReadiness] = useState(existing?.readiness ?? 'unknown');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingJobs = new Set(
    (profile?.jobProfiles ?? [])
      .filter((jp) => jp.id !== existing?.id)
      .map((jp) => jp.job),
  );

  const allUntracked = RAID_JOBS.filter((j) => !existingJobs.has(j.abbreviation));
  const filteredJobs = roleFilter === 'all'
    ? allUntracked
    : allUntracked.filter((j) => j.role === roleFilter);

  const allSnapshots = Object.values(gearSnapshots).flat();
  const syncedJobAbbrs = new Set(
    allSnapshots
      .filter((s) => s.source.toLowerCase() === 'plugin' && hasUsableGearSnapshot(s))
      .map((s) => s.job.toUpperCase()),
  );
  const syncedUntracked = allUntracked.filter((j) => syncedJobAbbrs.has(j.abbreviation));

  function toggleJob(abbreviation: string) {
    setSelectedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(abbreviation)) {
        next.delete(abbreviation);
      } else {
        next.add(abbreviation);
      }
      return next;
    });
  }

  function selectAllSynced() {
    setSelectedJobs((prev) => {
      const next = new Set(prev);
      for (const j of syncedUntracked) {
        next.add(j.abbreviation);
      }
      return next;
    });
  }

  const handleSubmit = async () => {
    if (!isEditing && selectedJobs.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      if (isEditing) {
        await updateJobProfile(existing.id, { priority, readiness, notes: notes || undefined });
        toast.success(`Updated ${getJobDisplayName(existing.job)} profile`);
      } else {
        const jobs = [...selectedJobs];
        for (const abbreviation of jobs) {
          const role = getRoleForJob(abbreviation);
          if (!role) continue;
          await createJobProfile({ job: abbreviation, role, priority, readiness, notes: notes || undefined });
        }
        const count = jobs.length;
        toast.success(count === 1 ? `Added ${getJobDisplayName(jobs[0])} profile` : `Added ${count} job profiles`);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const addButtonLabel = selectedJobs.size > 1
    ? `Add ${selectedJobs.size} Jobs`
    : 'Add Job';

  return (
    <Modal
      isOpen={true}
      title={isEditing ? `Edit ${getJobDisplayName(existing.job)}` : 'Add Job'}
      onClose={onClose}
    >
      <div className="space-y-4">
        {/* Job selector (only for new) */}
        {!isEditing && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-text-secondary">Jobs</label> {/* design-system-ignore */}
              {syncedUntracked.length > 0 && (
                <button
                  type="button"
                  onClick={selectAllSynced}
                  className="text-xs font-medium text-accent hover:text-accent-hover"
                  data-testid="select-all-synced"
                >
                  Select all synced ({syncedUntracked.length})
                </button>
              )}
            </div>

            {/* Role filter tabs */}
            {/* design-system-ignore: Compact inline filter tabs for job grid */}
            <div className="mb-2 flex flex-wrap gap-1">
              {ROLE_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setRoleFilter(filter.value)}
                  data-testid={`role-filter-${filter.value}`}
                  className={`rounded-md px-2 py-0.5 text-xs font-medium transition-colors ${
                    roleFilter === filter.value
                      ? 'bg-accent/20 text-accent border border-accent/40'
                      : 'bg-surface-elevated text-text-secondary border border-border-default hover:border-border-hover'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Job chips */}
            {/* design-system-ignore: Custom job grid requires specific toggle styling */}
            <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-11">
              {filteredJobs.map((j) => {
                const isSelected = selectedJobs.has(j.abbreviation);
                return (
                  <button
                    key={j.abbreviation}
                    type="button"
                    onClick={() => toggleJob(j.abbreviation)}
                    data-testid={`job-chip-${j.abbreviation}`}
                    className={`
                      flex flex-col items-center gap-0.5 p-1.5 rounded-lg border transition-colors text-xs
                      ${
                        isSelected
                          ? 'bg-accent/20 border-accent/40 text-accent ring-1 ring-accent/30'
                          : 'bg-surface-elevated border-border-default text-text-secondary hover:border-border-hover'
                      }
                    `}
                    title={j.name}
                  >
                    <JobIcon job={j.abbreviation} size="md" />
                    <span>{j.abbreviation}</span>
                  </button>
                );
              })}
            </div>

            {selectedJobs.size > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {[...selectedJobs].map((abbreviation) => (
                  <span key={abbreviation} className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-2 py-0.5 text-xs text-accent">
                    <JobIcon job={abbreviation} size="sm" />
                    {abbreviation}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Priority */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Priority</label> {/* design-system-ignore */}
          <Select
            value={priority}
            onChange={setPriority}
            options={PRIORITIES}
          />
        </div>

        {/* Readiness */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Gear Readiness</label> {/* design-system-ignore */}
          <Select
            value={readiness}
            onChange={setReadiness}
            options={READINESS_OPTIONS}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Notes</label> {/* design-system-ignore */}
          <TextArea
            value={notes}
            onChange={setNotes}
            placeholder="e.g., Missing weapon, BiS except ring2"
            maxLength={500}
            rows={2}
          />
        </div>

        {error && (
          <div className="text-sm text-status-error bg-status-error/10 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || (!isEditing && selectedJobs.size === 0)}
            data-testid="submit-add-job"
          >
            {saving ? 'Saving…' : isEditing ? 'Save Changes' : addButtonLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
