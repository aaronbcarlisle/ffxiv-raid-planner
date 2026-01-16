/**
 * RosterSlot - Individual player slot for wizard roster setup
 *
 * Shows position label, name input, job picker, and BiS import button.
 */

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, MoreHorizontal } from 'lucide-react';
import { JobPicker } from '../player/JobPicker';
import { JobIcon } from '../ui/JobIcon';
import { Label } from '../ui/Label';
import { Input } from '../ui/Input';
import { BiSImportModal } from '../player/BiSImportModal';
import { getRoleForJob, getJobsByRole, getRoleDisplayName, getJobDisplayName, getHealerType, type JobInfo } from '../../gamedata';
import type { WizardPlayer } from './types';
import type { SnapshotPlayer, GearSlotStatus } from '../../types';

// Expected role for each position
const POSITION_EXPECTED_ROLE: Record<string, string> = {
  T1: 'tank',
  T2: 'tank',
  H1: 'healer',
  H2: 'healer',
  M1: 'melee',
  M2: 'melee',
  R1: 'ranged',
  R2: 'caster',
};

interface RosterSlotProps {
  player: WizardPlayer;
  tierId: string; // For BiS import context
  slotIndex: number; // For keyboard navigation
  nameInputRef: (el: HTMLInputElement | null) => void; // Callback ref for name input
  onUpdate: (updates: Partial<WizardPlayer>) => void;
  onFocusNextSlot: () => void; // Callback to focus next slot
}

// Position labels with role context
const POSITION_LABELS: Record<string, string> = {
  T1: 'Main Tank',
  T2: 'Off Tank',
  H1: 'Pure Healer',
  H2: 'Barrier Healer',
  M1: 'Melee DPS 1',
  M2: 'Melee DPS 2',
  R1: 'Physical Ranged',
  R2: 'Magical Ranged',
};

// Role ring colors for selected job buttons
const ROLE_RING_COLORS: Record<string, string> = {
  tank: 'ring-role-tank',
  healer: 'ring-role-healer',
  melee: 'ring-role-melee',
  ranged: 'ring-role-ranged',
  caster: 'ring-role-caster',
};

// Role background colors for selected job buttons
const ROLE_BG_COLORS: Record<string, string> = {
  tank: 'bg-role-tank/30',
  healer: 'bg-role-healer/30',
  melee: 'bg-role-melee/30',
  ranged: 'bg-role-ranged/30',
  caster: 'bg-role-caster/30',
};

export function RosterSlot({ player, tierId, slotIndex, nameInputRef, onUpdate, onFocusNextSlot }: RosterSlotProps) {
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [showBiSImport, setShowBiSImport] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0, width: 0, renderAbove: false });
  const containerRef = useRef<HTMLDivElement>(null);
  const jobButtonsRef = useRef<HTMLDivElement>(null);

  const hasJob = Boolean(player.job);
  const isEmpty = !player.name && !player.job;

  // Ring color for card outline and selected job buttons
  const ringColor = ROLE_RING_COLORS[player.role] || 'ring-border-default';
  // Background color for selected job button
  const bgColor = ROLE_BG_COLORS[player.role] || 'bg-surface-interactive';

  // Get role-specific jobs for quick-select (H1 = pure healers, H2 = barrier healers)
  const roleJobs: JobInfo[] = (() => {
    const jobs = getJobsByRole(player.role as 'tank' | 'healer' | 'melee' | 'ranged' | 'caster');
    // Filter healers by type based on position
    if (player.role === 'healer') {
      const healerType = player.position === 'H1' ? 'pure' : 'barrier';
      return jobs.filter(j => getHealerType(j.abbreviation) === healerType);
    }
    return jobs;
  })();

  // Get display name for the role (Pure Healer / Barrier Healer for healers)
  const roleDisplayName = (() => {
    if (player.role === 'healer') {
      return player.position === 'H1' ? 'Pure Healer' : 'Barrier Healer';
    }
    return getRoleDisplayName(player.role as 'tank' | 'healer' | 'melee' | 'ranged' | 'caster');
  })();

  // Determine slot label - show actual role if different from expected
  const expectedRole = POSITION_EXPECTED_ROLE[player.position];
  const slotLabel = hasJob && player.role !== expectedRole
    ? getRoleDisplayName(player.role as 'tank' | 'healer' | 'melee' | 'ranged' | 'caster')
    : POSITION_LABELS[player.position] || player.position;

  const handleJobSelect = (job: string, shouldFocusNext = false) => {
    const role = getRoleForJob(job);
    onUpdate({ job, role: role || 'melee' });
    setShowJobPicker(false);
    // Auto-focus next slot's name input after job selection
    if (shouldFocusNext) {
      onFocusNextSlot();
    }
  };

  const handleJobButtonKeyDown = (e: React.KeyboardEvent, job: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleJobSelect(job, true); // Focus next on Enter
    }
  };

  const handleOpenJobPicker = () => {
    if (jobButtonsRef.current) {
      const rect = jobButtonsRef.current.getBoundingClientRect();

      // Estimate dropdown height (max-height is 224px from JobPicker)
      const DROPDOWN_HEIGHT = 280; // ~224px content + padding/border
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      // Render above if not enough space below but enough space above
      const renderAbove = spaceBelow < DROPDOWN_HEIGHT && spaceAbove > spaceBelow;

      // Use viewport coordinates directly for fixed positioning
      setPickerPosition({
        top: renderAbove ? rect.top : rect.bottom,
        left: rect.left,
        width: rect.width,
        renderAbove,
      });
    }
    setShowJobPicker(true);
  };

  // Update picker position on scroll/resize
  useEffect(() => {
    if (!showJobPicker || !jobButtonsRef.current) return;

    const updatePosition = () => {
      if (jobButtonsRef.current) {
        const rect = jobButtonsRef.current.getBoundingClientRect();

        const DROPDOWN_HEIGHT = 280;
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const renderAbove = spaceBelow < DROPDOWN_HEIGHT && spaceAbove > spaceBelow;

        // Use viewport coordinates directly for fixed positioning
        setPickerPosition({
          top: renderAbove ? rect.top : rect.bottom,
          left: rect.left,
          width: rect.width,
          renderAbove,
        });
      }
    };

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showJobPicker]);

  const handleBiSImport = (updates: { gear: GearSlotStatus[]; bisLink?: string }) => {
    // Extract BiS data from import
    onUpdate({
      bisLink: updates.bisLink,
      gear: updates.gear,
    });
    setShowBiSImport(false);
  };

  // Create a temporary player object for BiS import
  const tempPlayer: SnapshotPlayer = {
    id: `temp-${player.position}`,
    tierSnapshotId: tierId,
    name: player.name || player.position,
    job: player.job,
    role: player.role,
    configured: true,
    sortOrder: 0,
    gear: player.gear || [],
    tomeWeapon: { pursuing: false, hasItem: false, isAugmented: false },
    weaponPriorities: [],
    weaponPrioritiesLocked: false,
    isSubstitute: false,
    bisLink: player.bisLink,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const handleClear = () => {
    onUpdate({
      name: '',
      job: '',
      role: player.position.startsWith('T')
        ? 'tank'
        : player.position.startsWith('H')
        ? 'healer'
        : player.position.startsWith('M')
        ? 'melee'
        : player.position === 'R1'
        ? 'ranged'
        : 'caster',
      bisLink: undefined,
      gear: undefined,
    });
  };

  return (
    <>
      <div
        ref={containerRef}
        className={`relative bg-surface-card border border-border-default rounded-lg p-3 space-y-2.5 transition-all ${hasJob ? `ring-2 ${ringColor}` : ''}`}
      >
        {/* Position label */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-muted">
              {slotLabel}
            </span>
          </div>
          {/* Always render to prevent layout shift, but hide when empty */}
          <button
            onClick={handleClear}
            className={`text-text-muted hover:text-status-error transition-colors ${isEmpty ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            title="Clear slot"
            tabIndex={isEmpty ? -1 : undefined}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Player name */}
        <Input
          ref={nameInputRef}
          value={player.name}
          onChange={(value) => onUpdate({ name: value })}
          placeholder="Player name"
          size="sm"
          fullWidth
          tabIndex={slotIndex * 10 + 1}
        />

        {/* Job quick-select buttons */}
        <div className="space-y-1.5">
          <Label size="sm" className="mb-0">
            Select Job for: <span className={`text-role-${player.role} font-medium`}>{roleDisplayName}</span>
          </Label>
          <div ref={jobButtonsRef} className="flex flex-wrap gap-2">
            {roleJobs.map((jobInfo, idx) => (
              <button
                key={jobInfo.abbreviation}
                type="button"
                onClick={() => handleJobSelect(jobInfo.abbreviation, true)}
                onKeyDown={(e) => handleJobButtonKeyDown(e, jobInfo.abbreviation)}
                className={`p-1.5 rounded-lg transition-all ${
                  player.job === jobInfo.abbreviation
                    ? `${bgColor} ring-2 ${ringColor}`
                    : 'bg-surface-interactive hover:bg-surface-elevated hover:ring-1 hover:ring-border-default'
                }`}
                title={jobInfo.abbreviation}
                tabIndex={slotIndex * 10 + 2 + idx}
              >
                <JobIcon job={jobInfo.abbreviation} size="md" />
              </button>
            ))}
            {/* "Other Jobs" button */}
            <button
              type="button"
              onClick={handleOpenJobPicker}
              className={`p-1.5 rounded-lg transition-all ${
                showJobPicker
                  ? `ring-2 ${ringColor}`
                  : 'bg-surface-interactive hover:bg-surface-elevated hover:ring-1 hover:ring-border-default'
              }`}
              title="Other jobs..."
              tabIndex={slotIndex * 10 + 2 + roleJobs.length}
            >
              <MoreHorizontal className="w-6 h-6 text-text-muted" />
            </button>
          </div>

          {/* Selected job display - always rendered to reserve height */}
          <div className={`flex items-center gap-2 text-xs h-6 ${!hasJob ? 'invisible' : ''}`}>
            <span className="text-text-muted">Selected:</span>
            <JobIcon job={player.job || 'PLD'} size="sm" />
            <span className={`font-medium text-role-${player.role}`}>
              {player.job}
            </span>
            <span className="text-text-secondary">
              - {getJobDisplayName(player.job || 'PLD')}
            </span>
          </div>
        </div>


        {/* BiS import button - temporarily hidden for space
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowBiSImport(true)}
          disabled={!hasJob}
          className="w-full"
          tabIndex={slotIndex * 10 + 9}
          leftIcon={
            hasBiS ? (
              <Check className="w-4 h-4 text-status-success" />
            ) : (
              <FileDown className="w-4 h-4" />
            )
          }
        >
          {hasBiS ? 'BiS Imported' : 'Import BiS'}
        </Button>
        */}
      </div>

      {/* Job picker dropdown portal (when "Other Jobs" is clicked) */}
      {showJobPicker &&
        createPortal(
          <div
            className="fixed z-[100]"
            style={{
              [pickerPosition.renderAbove ? 'bottom' : 'top']: pickerPosition.renderAbove
                ? `${window.innerHeight - pickerPosition.top}px`
                : `${pickerPosition.top}px`,
              left: `${pickerPosition.left}px`,
              width: `${pickerPosition.width}px`,
            }}
          >
            <JobPicker
              selectedJob={player.job}
              onJobSelect={(job) => handleJobSelect(job, true)}
              onRequestClose={() => setShowJobPicker(false)}
              reverseLayout={pickerPosition.renderAbove}
            />
          </div>,
          document.body
        )}

      {/* BiS Import Modal */}
      {showBiSImport && hasJob && (
        <BiSImportModal
          isOpen={showBiSImport}
          onClose={() => setShowBiSImport(false)}
          onImport={handleBiSImport}
          player={tempPlayer}
          contentType="savage"
        />
      )}
    </>
  );
}
