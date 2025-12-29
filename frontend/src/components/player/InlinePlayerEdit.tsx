import { useState, useEffect, useRef } from 'react';
import { JobPicker } from './JobPicker';
import {
  getRoleForJob,
} from '../../gamedata';
import type { SnapshotPlayer } from '../../types';
import { TEMPLATE_ROLE_INFO } from '../../utils/constants';

interface InlinePlayerEditProps {
  player: SnapshotPlayer;
  onSave: (name: string, job: string, role: string) => void;
  onCancel: () => void;
}

export function InlinePlayerEdit({ player, onSave, onCancel }: InlinePlayerEditProps) {
  const [name, setName] = useState(player.name);
  const [job, setJob] = useState(player.job);
  const [showNameError, setShowNameError] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus name input on mount
  useEffect(() => {
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, []);

  const handleJobSelect = (selectedJob: string) => {
    setJob(selectedJob);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate name - show error and focus if empty
    if (!name.trim()) {
      setShowNameError(true);
      nameInputRef.current?.focus();
      return;
    }
    // Job is required but we don't block - they just need to pick one
    if (!job) return;
    const actualRole = getRoleForJob(job) || '';
    onSave(name.trim(), job, actualRole);
  };

  // Clear name error when user starts typing
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (showNameError && e.target.value.trim()) {
      setShowNameError(false);
    }
  };

  // Get role color for template slots
  const templateRoleInfo = player.templateRole ? TEMPLATE_ROLE_INFO[player.templateRole] : null;
  const roleColorVar = templateRoleInfo ? `var(--color-${templateRoleInfo.color})` : null;

  return (
    <div
      className="bg-surface-card border-2 rounded-lg p-4"
      style={{ borderColor: roleColorVar || 'var(--color-accent)' }}
    >
      <form onSubmit={handleSubmit}>
        {/* Name input - no label, placeholder is sufficient */}
        <div className="mb-4">
          <input
            ref={nameInputRef}
            type="text"
            value={name}
            onChange={handleNameChange}
            placeholder="Enter player name"
            className={`w-full bg-surface-base border rounded px-3 py-2 text-text-primary placeholder:text-text-muted focus:outline-none transition-colors ${
              showNameError
                ? 'border-status-error focus:border-status-error'
                : 'border-border-default'
            }`}
            style={{
              // Role-colored focus border when not showing error
              ...((!showNameError && roleColorVar) ? { '--focus-color': roleColorVar } as React.CSSProperties : {}),
            }}
            onFocus={(e) => {
              if (!showNameError && roleColorVar) {
                e.target.style.borderColor = roleColorVar;
              }
            }}
            onBlur={(e) => {
              if (!showNameError) {
                e.target.style.borderColor = '';
              }
            }}
          />
        </div>

        {/* Job selection - unified picker for both template and configured slots */}
        <div className="mb-4">
          <JobPicker
            selectedJob={job}
            onJobSelect={handleJobSelect}
            templateRole={player.templateRole}
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-3 py-2 rounded text-sm font-medium border-2 transition-colors hover:brightness-110"
            style={{
              borderColor: roleColorVar || 'var(--color-text-muted)',
              color: roleColorVar || 'var(--color-text-secondary)',
              backgroundColor: 'transparent',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`flex-1 px-3 py-2 rounded text-sm font-medium text-bg-primary transition-colors ${
              roleColorVar ? 'hover:brightness-110' : 'bg-accent hover:bg-accent-bright'
            }`}
            style={roleColorVar ? { backgroundColor: roleColorVar } : undefined}
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
