/**
 * RosterSlot - Individual player slot for wizard roster setup
 *
 * Shows position label, name input, job picker, and BiS import button.
 */

import { useState } from 'react';
import { FileDown, Check, X } from 'lucide-react';
import { Button } from '../primitives/Button';
import { JobPicker } from '../player/JobPicker';
import { JobIcon } from '../ui/JobIcon';
import { BiSImportModal } from '../player/BiSImportModal';
import { getRoleForJob } from '../../gamedata';
import type { WizardPlayer } from './types';
import type { SnapshotPlayer, GearSlotStatus } from '../../types';

interface RosterSlotProps {
  player: WizardPlayer;
  tierId: string; // For BiS import context
  onUpdate: (updates: Partial<WizardPlayer>) => void;
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

// Role border colors
const ROLE_BORDER_COLORS: Record<string, string> = {
  tank: 'border-role-tank',
  healer: 'border-role-healer',
  melee: 'border-role-melee',
  ranged: 'border-role-ranged',
  caster: 'border-role-caster',
};

export function RosterSlot({ player, tierId, onUpdate }: RosterSlotProps) {
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [showBiSImport, setShowBiSImport] = useState(false);

  const hasJob = Boolean(player.job);
  const hasBiS = Boolean(player.bisLink);
  const isEmpty = !player.name && !player.job;

  const borderColor = hasJob ? ROLE_BORDER_COLORS[player.role] : 'border-border-default';

  const handleJobSelect = (job: string) => {
    const role = getRoleForJob(job);
    onUpdate({ job, role: role || 'melee' });
    setShowJobPicker(false);
  };

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
        className={`relative bg-surface-card border-2 ${borderColor} rounded-lg p-4 space-y-3 transition-all`}
      >
        {/* Position label */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-muted">
              {POSITION_LABELS[player.position] || player.position}
            </span>
            {hasJob && <JobIcon job={player.job} size="sm" />}
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
          type="text"
          value={player.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Player name"
          className="w-full px-3 py-2 bg-surface-elevated border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
        />

        {/* Job picker toggle/display */}
        {showJobPicker ? (
          <div className="border border-border-default rounded bg-surface-elevated p-2">
            <JobPicker
              selectedJob={player.job}
              onJobSelect={handleJobSelect}
              onRequestClose={() => setShowJobPicker(false)}
            />
          </div>
        ) : (
          <button
            onClick={() => setShowJobPicker(true)}
            className="w-full px-3 py-2 bg-surface-elevated border border-border-default rounded text-sm text-left hover:border-accent/30 transition-colors flex items-center justify-between"
          >
            <span className={hasJob ? 'text-text-primary' : 'text-text-muted'}>
              {hasJob ? player.job : 'Select job...'}
            </span>
            <svg className="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}

        {/* BiS import button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowBiSImport(true)}
          disabled={!hasJob}
          className="w-full"
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
      </div>

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
