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
import { BiSImportModal } from '../player/BiSImportModal';
import { getRoleForJob, getJobsByRole, getRoleDisplayName } from '../../gamedata';
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

  // Get role-specific jobs for quick-select
  const roleJobs = getJobsByRole(player.role as 'tank' | 'healer' | 'melee' | 'ranged' | 'caster');

  // Determine slot label - show actual role if different from expected
  const expectedRole = POSITION_EXPECTED_ROLE[player.position];
  const slotLabel = hasJob && player.role !== expectedRole
    ? `${getRoleDisplayName(player.role as 'tank' | 'healer' | 'melee' | 'ranged' | 'caster')} (${player.position})`
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

      setPickerPosition({
        top: renderAbove ? rect.top + window.scrollY : rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
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

        setPickerPosition({
          top: renderAbove ? rect.top + window.scrollY : rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
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
          {!isEmpty && (
            <button
              onClick={handleClear}
              className="text-text-muted hover:text-status-error transition-colors"
              title="Clear slot"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Player name */}
        <input
          ref={nameInputRef}
          type="text"
          value={player.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Player name"
          className="w-full px-3 py-2 bg-surface-elevated border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
          tabIndex={slotIndex * 10 + 1}
        />

        {/* Job quick-select buttons */}
        <div className="space-y-1.5">
          <label className="block text-xs text-text-muted">Select Job</label>
          <div ref={jobButtonsRef} className="flex flex-wrap gap-2">
            {roleJobs.map((jobInfo, idx) => (
              <button
                key={jobInfo.abbreviation}
                type="button"
                onClick={() => handleJobSelect(jobInfo.abbreviation, true)}
                onKeyDown={(e) => handleJobButtonKeyDown(e, jobInfo.abbreviation)}
                className={`p-1.5 rounded-lg transition-all ${
                  player.job === jobInfo.abbreviation
                    ? `ring-2 ${ringColor}`
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
              onJobSelect={handleJobSelect}
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
