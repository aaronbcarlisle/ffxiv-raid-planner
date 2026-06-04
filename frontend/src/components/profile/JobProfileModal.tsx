/**
 * JobProfileModal - Add or edit a job profile
 */

import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../primitives/Button';
import { Select } from '../ui/Select';
import { TextArea } from '../ui/TextArea';
import { JobIcon } from '../ui/JobIcon';
import { usePlayerProfileStore } from '../../stores/playerProfileStore';
import type { PlayerJobProfile } from '../../stores/playerProfileStore';
import { RAID_JOBS, getRoleForJob, getJobDisplayName } from '../../gamedata/jobs';
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

interface JobProfileModalProps {
  existing?: PlayerJobProfile;
  onClose: () => void;
}

export function JobProfileModal({ existing, onClose }: JobProfileModalProps) {
  const { createJobProfile, updateJobProfile } = usePlayerProfileStore();
  const profile = usePlayerProfileStore((s) => s.profile);
  const isEditing = !!existing;

  const [job, setJob] = useState(existing?.job ?? '');
  const [priority, setPriority] = useState(existing?.priority ?? 'flex');
  const [readiness, setReadiness] = useState(existing?.readiness ?? 'unknown');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter out jobs that already have profiles (unless editing)
  const existingJobs = new Set(
    (profile?.jobProfiles ?? [])
      .filter((jp) => jp.id !== existing?.id)
      .map((jp) => jp.job)
  );
  const availableJobs = RAID_JOBS.filter((j) => !existingJobs.has(j.abbreviation));

  const handleSubmit = async () => {
    if (!isEditing && !job) return;
    setSaving(true);
    setError(null);
    try {
      if (isEditing) {
        await updateJobProfile(existing.id, { priority, readiness, notes: notes || undefined });
        toast.success(`Updated ${getJobDisplayName(existing.job)} profile`);
      } else {
        const role = getRoleForJob(job);
        if (!role) {
          setError('Invalid job');
          setSaving(false);
          return;
        }
        await createJobProfile({ job, role, priority, readiness, notes: notes || undefined });
        toast.success(`Added ${getJobDisplayName(job)} profile`);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

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
            <label className="block text-sm font-medium text-text-secondary mb-2">Job</label> {/* design-system-ignore */}
            {/* design-system-ignore: Custom job grid requires specific toggle styling */}
            <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-11">
              {availableJobs.map((j) => (
                <button
                  key={j.abbreviation}
                  type="button"
                  onClick={() => setJob(j.abbreviation)}
                  className={`
                    flex flex-col items-center gap-0.5 p-1.5 rounded-lg border transition-colors text-xs
                    ${
                      job === j.abbreviation
                        ? 'bg-accent/20 border-accent/40 text-accent'
                        : 'bg-surface-elevated border-border-default text-text-secondary hover:border-border-hover'
                    }
                  `}
                  title={j.name}
                >
                  <JobIcon job={j.abbreviation} size="md" />
                  <span>{j.abbreviation}</span>
                </button>
              ))}
            </div>
            {job && (
              <div className="mt-2 text-sm text-text-primary flex items-center gap-2">
                <JobIcon job={job} size="sm" />
                {getJobDisplayName(job)}
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
          <Button onClick={handleSubmit} disabled={saving || (!isEditing && !job)}>
            {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Job'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
