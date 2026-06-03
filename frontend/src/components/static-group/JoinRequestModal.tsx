import { useState } from 'react';
import { Send } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../primitives/Button';
import { Checkbox } from '../ui/Checkbox';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';
import { Label } from '../ui/Label';
import { useJoinRequestStore } from '../../stores/joinRequestStore';
import { toast } from '../../stores/toastStore';
import type { JoinRequestCreatePayload } from '../../types';

const ROLE_OPTIONS = [
  { value: 'tank', label: 'Tank' },
  { value: 'healer', label: 'Healer' },
  { value: 'melee', label: 'Melee DPS' },
  { value: 'ranged', label: 'Physical Ranged' },
  { value: 'caster', label: 'Caster' },
];

const JOB_OPTIONS = [
  { value: 'pld', label: 'PLD' }, { value: 'war', label: 'WAR' },
  { value: 'drk', label: 'DRK' }, { value: 'gnb', label: 'GNB' },
  { value: 'whm', label: 'WHM' }, { value: 'sch', label: 'SCH' },
  { value: 'ast', label: 'AST' }, { value: 'sge', label: 'SGE' },
  { value: 'mnk', label: 'MNK' }, { value: 'drg', label: 'DRG' },
  { value: 'nin', label: 'NIN' }, { value: 'sam', label: 'SAM' },
  { value: 'rpr', label: 'RPR' }, { value: 'vpr', label: 'VPR' },
  { value: 'brd', label: 'BRD' }, { value: 'mch', label: 'MCH' },
  { value: 'dnc', label: 'DNC' }, { value: 'blm', label: 'BLM' },
  { value: 'smn', label: 'SMN' }, { value: 'rdm', label: 'RDM' },
  { value: 'pct', label: 'PCT' },
];

interface JoinRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareCode: string;
  staticName: string;
}

export function JoinRequestModal({ isOpen, onClose, shareCode, staticName }: JoinRequestModalProps) {
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [availabilityNote, setAvailabilityNote] = useState('');
  const [contactDiscord, setContactDiscord] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { createRequest } = useJoinRequestStore();

  const toggleRole = (role: string) =>
    setSelectedRoles((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);

  const toggleJob = (job: string) =>
    setSelectedJobs((prev) => prev.includes(job) ? prev.filter((j) => j !== job) : [...prev, job]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload: JoinRequestCreatePayload = {};
      if (selectedRoles.length > 0) payload.roleInterest = selectedRoles;
      if (selectedJobs.length > 0) payload.jobInterest = selectedJobs;
      if (message.trim()) payload.message = message.trim();
      if (availabilityNote.trim()) payload.availabilityNote = availabilityNote.trim();
      if (contactDiscord.trim()) payload.contactDiscord = contactDiscord.trim();

      await createRequest(shareCode, payload);
      toast.success('Request sent! The static lead will review your application.');
      handleClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedRoles([]);
    setSelectedJobs([]);
    setMessage('');
    setAvailabilityNote('');
    setContactDiscord('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <span className="flex items-center gap-2">
          <Send className="w-4 h-4 text-accent" />
          Request to Join
        </span>
      }
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={isSubmitting} leftIcon={<Send className="w-4 h-4" />}>
            Send Request
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Tell the lead of <span className="font-semibold text-text-primary">{staticName}</span> what
          roles you can play and when you&apos;re usually available.
        </p>

        <div>
          <Label htmlFor="join-discord" description="So the lead can reach you. Removed after they respond.">
            Discord handle
          </Label>
          <Input
            id="join-discord"
            value={contactDiscord}
            onChange={setContactDiscord}
            placeholder="e.g. username"
            maxLength={100}
          />
          <p className="text-xs text-text-muted mt-1">
            Your handle is only visible while the request is pending and is automatically deleted once accepted, declined, or cancelled.
          </p>
        </div>

        {/* Role interest - checkboxes */}
        <div>
          <Label description="Select all roles you can fill">Roles</Label>
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.map((role) => (
              <Checkbox
                key={role.value}
                checked={selectedRoles.includes(role.value)}
                onChange={() => toggleRole(role.value)}
                label={role.label}
              />
            ))}
          </div>
        </div>

        {/* Job interest - chip toggles */}
        <div>
          <Label description="Select all jobs you can play">Jobs</Label>
          <div className="flex flex-wrap gap-1.5">
            {JOB_OPTIONS.map((job) => (
              /* design-system-ignore: chip toggle for multi-select job picker */
              <button
                key={job.value}
                type="button"
                onClick={() => toggleJob(job.value)}
                className={`px-2.5 py-1 text-xs font-mono rounded-md border transition-colors ${
                  selectedJobs.includes(job.value)
                    ? 'bg-accent/20 text-accent border-accent/50'
                    : 'bg-surface-elevated text-text-secondary border-border-default hover:border-accent/30'
                }`}
              >
                {job.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="join-message" description="Why you'd like to join, your experience, etc.">
            Message
          </Label>
          <TextArea
            id="join-message"
            value={message}
            onChange={setMessage}
            placeholder="Introduce yourself..."
            maxLength={500}
            rows={3}
          />
          <p className="text-xs text-text-muted mt-1 text-right">{message.length}/500</p>
        </div>

        <div>
          <Label htmlFor="join-availability" description="Days/times you can raid, timezone, etc.">
            Availability
          </Label>
          <TextArea
            id="join-availability"
            value={availabilityNote}
            onChange={setAvailabilityNote}
            placeholder="e.g. Tue/Thu 8-11pm EST"
            maxLength={300}
            rows={2}
          />
          <p className="text-xs text-text-muted mt-1 text-right">{availabilityNote.length}/300</p>
        </div>
      </div>
    </Modal>
  );
}
