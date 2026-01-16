/**
 * ReviewStep - Step 3 of setup wizard
 *
 * Shows summary of static configuration before creation.
 * Displays roster preview with empty slot warnings.
 */

import { Users, AlertCircle, FileText, Shield, Check, X } from 'lucide-react';
import { getTierById } from '../../../gamedata/raid-tiers';
import { JobIcon } from '../../ui/JobIcon';
import type { WizardPlayer } from '../types';

interface ReviewStepProps {
  staticName: string;
  tierId: string;
  isPublic: boolean;
  players: WizardPlayer[];
  isSubmitting: boolean;
  error: string | null;
  onRetry: () => void;
}

// Position colors matching the existing role color system
const POSITION_COLORS: Record<string, string> = {
  tank: 'text-role-tank',
  healer: 'text-role-healer',
  melee: 'text-role-melee',
  ranged: 'text-role-ranged',
  caster: 'text-role-caster',
};

export function ReviewStep({
  staticName,
  tierId,
  isPublic,
  players,
  isSubmitting,
  error,
  onRetry,
}: ReviewStepProps) {
  const tier = getTierById(tierId);
  const filledSlots = players.filter((p) => p.name.trim() || p.job).length;
  const emptySlots = 8 - filledSlots;
  const hasAllJobs = players.every((p) => p.job);
  const hasBisLinks = players.filter((p) => p.bisLink).length;

  return (
    <div className="space-y-6">
      {/* Error display */}
      {error && (
        <div className="p-4 bg-status-error/10 border border-status-error/30 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-status-error flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-status-error">Failed to create static</p>
              <p className="text-sm text-text-secondary mt-1">{error}</p>
              <button
                onClick={onRetry}
                className="mt-2 text-sm text-accent hover:text-accent-bright underline"
                disabled={isSubmitting}
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Static details summary */}
      <div className="bg-surface-elevated rounded-lg border border-border-default p-4">
        <h3 className="text-sm font-medium text-text-muted mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Static Details
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-text-muted">Name</span>
            <span className="text-sm font-medium text-text-primary">{staticName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-text-muted">Raid Tier</span>
            <span className="text-sm font-medium text-text-primary">
              {tier?.shortName || tierId}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-text-muted">Visibility</span>
            <span className="text-sm font-medium text-text-primary">
              {isPublic ? 'Public' : 'Private'}
            </span>
          </div>
        </div>
      </div>

      {/* Roster summary */}
      <div className="bg-surface-elevated rounded-lg border border-border-default p-4">
        <h3 className="text-sm font-medium text-text-muted mb-3 flex items-center gap-2">
          <Users className="w-4 h-4" />
          Roster ({filledSlots}/8 configured)
        </h3>

        {/* Roster grid - 2x4 */}
        <div className="grid grid-cols-2 gap-2">
          {players.map((player) => (
            <div
              key={player.position}
              className={`flex items-center gap-2 p-2 rounded border ${
                player.name.trim() || player.job
                  ? 'border-border-default bg-surface-card'
                  : 'border-border-subtle bg-surface-raised/50'
              }`}
            >
              {/* Position badge */}
              <span
                className={`text-xs font-bold w-7 text-center ${POSITION_COLORS[player.role]}`}
              >
                {player.position}
              </span>

              {/* Job icon or placeholder */}
              {player.job ? (
                <JobIcon job={player.job} size="sm" />
              ) : (
                <div className="w-5 h-5 rounded bg-surface-interactive flex items-center justify-center">
                  <span className="text-xs text-text-muted">?</span>
                </div>
              )}

              {/* Player name or empty */}
              <span
                className={`flex-1 text-sm truncate ${
                  player.name.trim() ? 'text-text-primary' : 'text-text-muted italic'
                }`}
              >
                {player.name.trim() || 'Empty'}
              </span>

              {/* BiS indicator */}
              {player.bisLink && (
                <Check className="w-4 h-4 text-status-success flex-shrink-0" />
              )}
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div className="mt-3 pt-3 border-t border-border-subtle flex items-center gap-4 text-xs text-text-muted">
          <span className="flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-status-success" />
            {hasBisLinks} BiS imported
          </span>
          {!hasAllJobs && (
            <span className="flex items-center gap-1">
              <X className="w-3.5 h-3.5 text-status-warning" />
              {players.filter((p) => !p.job).length} missing jobs
            </span>
          )}
        </div>
      </div>

      {/* Empty slots warning */}
      {emptySlots > 0 && (
        <div className="flex items-start gap-3 p-3 bg-status-warning/10 border border-status-warning/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-status-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-text-primary">
              {emptySlots} slot{emptySlots > 1 ? 's' : ''} not configured
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              Empty slots will be created as placeholders. You can configure them later.
            </p>
          </div>
        </div>
      )}

      {/* Final info */}
      <div className="flex items-start gap-3 p-4 bg-accent/10 border border-accent/30 rounded-lg">
        <Shield className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-text-primary font-medium">Ready to create</p>
          <p className="text-xs text-text-muted mt-0.5">
            Click "Create Static" below to finish. You'll be the owner with full control.
          </p>
        </div>
      </div>
    </div>
  );
}
