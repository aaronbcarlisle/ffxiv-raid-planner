/**
 * Priority Tab
 *
 * Main container for the Priority tab in GroupView.
 * Allows leads/owners to configure priority settings for the static.
 */

import { useState, useEffect, useCallback } from 'react';
import { Settings2, Save, AlertCircle } from 'lucide-react';
import { Button } from '../primitives';
import { Label, ErrorBox } from '../ui';
import { ModeSelector } from './ModeSelector';
import { RoleBasedEditor } from './RoleBasedEditor';
import { JobBasedEditor } from './JobBasedEditor';
import { PlayerBasedEditor } from './PlayerBasedEditor';
import { AdvancedOptions } from './AdvancedOptions';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { toast } from '../../stores/toastStore';
import type {
  StaticGroup,
  StaticPrioritySettings,
  PrioritySystemMode,
  RoleType,
  AdvancedPriorityOptions,
  SnapshotPlayer,
  JobBasedConfig,
  PlayerBasedConfig,
} from '../../types';
import { DEFAULT_PRIORITY_SETTINGS, DEFAULT_ADVANCED_OPTIONS } from '../../types';
import { getJobsByRole } from '../../gamedata';

interface PriorityTabProps {
  group: StaticGroup;
  players: SnapshotPlayer[];
}

export function PriorityTab({ group, players }: PriorityTabProps) {
  const { updateGroup } = useStaticGroupStore();

  // Initialize state from group settings or defaults
  const [settings, setSettings] = useState<StaticPrioritySettings>(() => {
    // Check for new priority settings first
    if (group.settings?.prioritySettings) {
      return group.settings.prioritySettings;
    }
    // Migrate from legacy settings
    return {
      ...DEFAULT_PRIORITY_SETTINGS,
      mode: 'role-based',
      roleBasedConfig: {
        roleOrder: (group.settings?.lootPriority as RoleType[]) || DEFAULT_PRIORITY_SETTINGS.roleBasedConfig!.roleOrder,
      },
      advancedOptions: {
        ...DEFAULT_ADVANCED_OPTIONS,
        showPriorityScores: group.settings?.showPriorityScores ?? true,
        enableEnhancedFairness: group.settings?.enableEnhancedScoring ?? false,
      },
    };
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Track changes
  useEffect(() => {
    const original = group.settings?.prioritySettings || DEFAULT_PRIORITY_SETTINGS;
    const changed = JSON.stringify(settings) !== JSON.stringify(original);
    setHasChanges(changed);
  }, [settings, group.settings?.prioritySettings]);

  // Permission checks
  const canEdit = group.userRole === 'owner' || group.userRole === 'lead';

  // Mode change handler
  const handleModeChange = useCallback((mode: PrioritySystemMode) => {
    setSettings((prev) => {
      const newSettings = { ...prev, mode };

      // Initialize mode-specific config if needed
      if (mode === 'role-based' && !newSettings.roleBasedConfig) {
        newSettings.roleBasedConfig = {
          roleOrder: ['melee', 'ranged', 'caster', 'tank', 'healer'],
        };
      } else if (mode === 'job-based' && !newSettings.jobBasedConfig) {
        // Create default groups by role
        const defaultGroups = [
          { id: 'melee', name: 'Melee DPS', sortOrder: 0, basePriority: 125 },
          { id: 'ranged', name: 'Physical Ranged', sortOrder: 1, basePriority: 100 },
          { id: 'caster', name: 'Magical Ranged', sortOrder: 2, basePriority: 75 },
          { id: 'tank', name: 'Tank', sortOrder: 3, basePriority: 50 },
          { id: 'healer', name: 'Healer', sortOrder: 4, basePriority: 25 },
        ];

        // Create job configs for all jobs grouped by role
        const roles: RoleType[] = ['melee', 'ranged', 'caster', 'tank', 'healer'];
        const jobs = roles.flatMap((role) =>
          getJobsByRole(role).map((job, index) => ({
            job: job.abbreviation,
            groupId: role,
            sortOrder: index,
            priorityOffset: 0,
          }))
        );

        newSettings.jobBasedConfig = {
          groups: defaultGroups,
          jobs,
          showAdvancedControls: false,
        };
      } else if (mode === 'player-based' && !newSettings.playerBasedConfig) {
        newSettings.playerBasedConfig = {
          groups: [
            { id: 'default', name: 'All Players', sortOrder: 0, basePriority: 0 },
          ],
          players: [],
          showAdvancedControls: false,
        };
      }

      return newSettings;
    });
  }, []);

  // Role order change handler
  const handleRoleOrderChange = useCallback((roleOrder: RoleType[]) => {
    setSettings((prev) => ({
      ...prev,
      roleBasedConfig: {
        ...prev.roleBasedConfig,
        roleOrder,
      },
    }));
  }, []);

  // Job-based config change handler
  const handleJobBasedConfigChange = useCallback((jobBasedConfig: JobBasedConfig) => {
    setSettings((prev) => ({
      ...prev,
      jobBasedConfig,
    }));
  }, []);

  // Player-based config change handler
  const handlePlayerBasedConfigChange = useCallback((playerBasedConfig: PlayerBasedConfig) => {
    setSettings((prev) => ({
      ...prev,
      playerBasedConfig,
    }));
  }, []);

  // Advanced options change handler
  const handleAdvancedOptionsChange = useCallback((advancedOptions: AdvancedPriorityOptions) => {
    setSettings((prev) => ({
      ...prev,
      advancedOptions,
    }));
  }, []);

  // Save handler
  const handleSave = async () => {
    if (!hasChanges) return;

    setIsSaving(true);
    setError(null);

    try {
      // Merge with existing settings to preserve non-priority fields
      const existingSettings = group.settings || {};
      await updateGroup(group.id, {
        settings: {
          ...existingSettings,
          prioritySettings: settings,
          // Also update legacy fields for backward compatibility
          lootPriority: settings.roleBasedConfig?.roleOrder || ['melee', 'ranged', 'caster', 'tank', 'healer'],
          showPriorityScores: settings.advancedOptions.showPriorityScores,
          enableEnhancedScoring: settings.advancedOptions.enableEnhancedFairness,
        },
      });
      toast.success('Priority settings saved!');
      setHasChanges(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save settings';
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-surface-card rounded-lg border border-border-default p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <Settings2 className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-display text-text-primary">Priority Settings</h2>
        </div>

        {/* Permission warning */}
        {!canEdit && (
          <div className="mb-6 p-3 bg-status-warning/10 border border-status-warning/30 rounded text-status-warning text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Only owners and leads can modify priority settings.
          </div>
        )}

        {/* Error display */}
        {error && <ErrorBox message={error} size="sm" className="mb-6" />}

        {/* Mode selector */}
        <div className="mb-6">
          <Label>Priority Mode</Label>
          <ModeSelector
            value={settings.mode}
            onChange={handleModeChange}
            disabled={!canEdit}
          />
        </div>

        {/* Mode-specific editor */}
        {settings.mode === 'role-based' && settings.roleBasedConfig && (
          <div className="mb-6">
            <Label>Role Priority Order</Label>
            <RoleBasedEditor
              roleOrder={settings.roleBasedConfig.roleOrder}
              onChange={handleRoleOrderChange}
              disabled={!canEdit}
            />
          </div>
        )}

        {settings.mode === 'job-based' && settings.jobBasedConfig && (
          <div className="mb-6">
            <Label>Job Priority</Label>
            <JobBasedEditor
              config={settings.jobBasedConfig}
              onChange={handleJobBasedConfigChange}
              players={players}
              disabled={!canEdit}
            />
          </div>
        )}

        {settings.mode === 'player-based' && settings.playerBasedConfig && (
          <div className="mb-6">
            <Label>Player Priority</Label>
            <PlayerBasedEditor
              config={settings.playerBasedConfig}
              onChange={handlePlayerBasedConfigChange}
              players={players}
              disabled={!canEdit}
            />
          </div>
        )}

        {settings.mode === 'manual-planning' && (
          <div className="mb-6 p-4 bg-surface-elevated rounded-lg border border-border-default">
            <p className="text-text-muted text-sm">
              Manual planning mode lets you pre-assign loot to players for each week.
              Go to the Loot tab to create weekly assignments.
            </p>
          </div>
        )}

        {settings.mode === 'disabled' && (
          <div className="mb-6 p-4 bg-surface-elevated rounded-lg border border-border-default">
            <p className="text-text-muted text-sm">
              Priority is disabled. All players will show equal priority in the Loot tab.
              This is useful for groups that prefer equal distribution.
            </p>
          </div>
        )}

        {/* Advanced options - show for all modes except disabled */}
        {settings.mode !== 'disabled' && (
          <AdvancedOptions
            options={settings.advancedOptions}
            onChange={handleAdvancedOptionsChange}
            disabled={!canEdit}
            priorityDisabled={settings.mode === 'disabled'}
          />
        )}

        {/* Save button */}
        {canEdit && (
          <div className="flex justify-end pt-6 mt-6 border-t border-border-default">
            <Button
              onClick={handleSave}
              disabled={!hasChanges}
              loading={isSaving}
            >
              <Save className="w-4 h-4 mr-1.5" />
              Save Changes
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
