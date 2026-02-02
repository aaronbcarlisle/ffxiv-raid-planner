/**
 * Add Player Modal
 *
 * Modal for adding a new player to the roster with name, job, and position.
 */

import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { UserPlus } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { Button } from '../primitives/Button';
import { JobPicker } from './JobPicker';
import { JobIcon } from '../ui/JobIcon';
import { getRoleForJob, getJobDisplayName, type Role } from '../../gamedata';
import type { TankRole } from '../../types';

// Position type for G1/G2 grouping
type RaidPosition = 'T1' | 'T2' | 'H1' | 'H2' | 'M1' | 'M2' | 'R1' | 'R2';

export interface AddPlayerData {
  name: string;
  job: string;
  role: Role;
  position?: RaidPosition;
  tankRole?: TankRole;
}

interface AddPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: AddPlayerData) => Promise<void>;
  isLoading?: boolean;
}

// Position options by role
const POSITION_OPTIONS: Record<Role, { value: RaidPosition; label: string }[]> = {
  tank: [
    { value: 'T1', label: 'T1 - Main Tank' },
    { value: 'T2', label: 'T2 - Off Tank' },
  ],
  healer: [
    { value: 'H1', label: 'H1 - Pure Healer' },
    { value: 'H2', label: 'H2 - Barrier Healer' },
  ],
  melee: [
    { value: 'M1', label: 'M1 - Melee DPS' },
    { value: 'M2', label: 'M2 - Melee DPS' },
  ],
  ranged: [
    { value: 'R1', label: 'R1 - Physical Ranged' },
  ],
  caster: [
    { value: 'R2', label: 'R2 - Magical Ranged' },
  ],
};

export function AddPlayerModal({ isOpen, onClose, onAdd, isLoading }: AddPlayerModalProps) {
  const [name, setName] = useState('');
  const [job, setJob] = useState<string>('');
  const [position, setPosition] = useState<RaidPosition | ''>('');
  const [tankRole, setTankRole] = useState<TankRole | ''>('');
  const [showJobPicker, setShowJobPicker] = useState(false);
  const jobButtonRef = useRef<HTMLButtonElement>(null);
  const jobPickerRef = useRef<HTMLDivElement>(null);

  // Get role from selected job
  const role = job ? getRoleForJob(job) : null;
  const isTank = role === 'tank';
  const positionOptions = role ? POSITION_OPTIONS[role] : [];

  // Reset form when modal closes
  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: reset state on modal close */
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setJob('');
      setPosition('');
      setTankRole('');
      setShowJobPicker(false);
    }
  }, [isOpen]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Close job picker on click outside
  useEffect(() => {
    if (!showJobPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        jobPickerRef.current &&
        !jobPickerRef.current.contains(e.target as Node) &&
        jobButtonRef.current &&
        !jobButtonRef.current.contains(e.target as Node)
      ) {
        setShowJobPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showJobPicker]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleJobSelect = useCallback((selectedJob: string) => {
    setJob(selectedJob);
    setShowJobPicker(false);
    // Reset position when job changes (role might change)
    setPosition('');
    setTankRole('');
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job || !role) return;

    await onAdd({
      name: name.trim() || 'New Player',
      job,
      role,
      position: position || undefined,
      tankRole: isTank && tankRole ? tankRole : undefined,
    });

    handleClose();
  }, [name, job, role, position, tankRole, isTank, onAdd, handleClose]);

  const canSubmit = job !== '';

  // Track job picker position in state (updated when picker opens)
  const [jobPickerPosition, setJobPickerPosition] = useState({ top: 0, left: 0, width: 320 });

  // Update position when job picker opens (useLayoutEffect for DOM measurements)
  useLayoutEffect(() => {
    if (showJobPicker && jobButtonRef.current) {
      const rect = jobButtonRef.current.getBoundingClientRect();
      setJobPickerPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 320),
      });
    }
  }, [showJobPicker]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <span className="flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Add Player
        </span>
      }
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <Label htmlFor="player-name">Player Name</Label>
          <Input
            id="player-name"
            value={name}
            onChange={setName}
            placeholder="Enter player name"
            autoFocus
          />
          <p className="text-xs text-text-muted mt-1">
            Leave blank to use "New Player"
          </p>
        </div>

        {/* Job */}
        <div>
          <Label>Job</Label>
          <button
            ref={jobButtonRef}
            type="button"
            onClick={() => setShowJobPicker(!showJobPicker)}
            className="w-full flex items-center gap-2 px-3 py-2 bg-surface-elevated border border-border-default rounded-lg text-left hover:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/50 transition-colors"
          >
            {job ? (
              <>
                <JobIcon job={job} size="sm" />
                <span className="text-text-primary">{getJobDisplayName(job)}</span>
              </>
            ) : (
              <span className="text-text-muted">Select a job...</span>
            )}
          </button>
          {showJobPicker && createPortal(
            <div
              ref={jobPickerRef}
              className="fixed z-[100] bg-surface-card border border-border-default rounded-lg shadow-xl [&>div]:w-full [&_div.w-80]:w-full"
              style={{
                top: jobPickerPosition.top,
                left: jobPickerPosition.left,
                width: jobPickerPosition.width,
                maxHeight: '400px',
                overflow: 'auto',
              }}
            >
              <JobPicker
                selectedJob={job}
                onJobSelect={handleJobSelect}
                onRequestClose={() => setShowJobPicker(false)}
              />
            </div>,
            document.body
          )}
        </div>

        {/* Position - only show if job is selected */}
        {job && positionOptions.length > 0 && (
          <div>
            <Label htmlFor="player-position">Position (Optional)</Label>
            <Select
              id="player-position"
              value={position}
              onChange={(value) => setPosition(value as RaidPosition | '')}
              options={[
                { value: '', label: 'No position' },
                ...positionOptions,
              ]}
            />
            <p className="text-xs text-text-muted mt-1">
              Used for G1/G2 light party grouping
            </p>
          </div>
        )}

        {/* Tank Role - only show for tanks */}
        {isTank && (
          <div>
            <Label htmlFor="player-tank-role">Tank Role (Optional)</Label>
            <Select
              id="player-tank-role"
              value={tankRole}
              onChange={(value) => setTankRole(value as TankRole | '')}
              options={[
                { value: '', label: 'Not specified' },
                { value: 'MT', label: 'Main Tank (MT)' },
                { value: 'OT', label: 'Off Tank (OT)' },
              ]}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-border-default">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!canSubmit || isLoading}
            loading={isLoading}
          >
            <UserPlus className="w-4 h-4 mr-1.5" />
            Add Player
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default AddPlayerModal;
