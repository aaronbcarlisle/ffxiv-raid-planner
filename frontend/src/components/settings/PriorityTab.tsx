/**
 * Settings Priority Tab
 *
 * Consolidated priority configuration for the settings panel.
 * Includes mode selection, configuration, advanced options, and player loot adjustments.
 * Uses subtabs: Mode | Advanced
 */

import { useState, useEffect, useCallback } from 'react';
import { Save, AlertCircle } from 'lucide-react';
import { Button, Tooltip } from '../primitives';
import { Label, ErrorBox } from '../ui';
import { ModeSelector } from '../priority/ModeSelector';
import { RoleBasedEditor } from '../priority/RoleBasedEditor';
import { JobBasedEditor } from '../priority/JobBasedEditor';
import { PlayerBasedEditor } from '../priority/PlayerBasedEditor';
import { AdvancedOptions } from '../priority/AdvancedOptions';
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

type PrioritySubTab = 'mode' | 'advanced';

interface PriorityTabProps {
  group: StaticGroup;
  players: SnapshotPlayer[];
  tierId?: string;
  onClose?: () => void;
}

export function PriorityTab({ group, players, tierId, onClose }: PriorityTabProps) {
  const { updateGroup } = useStaticGroupStore();

  // Subtab state
  const [activeSubTab, setActiveSubTab] = useState<PrioritySubTab>('mode');

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
    // If switching to disabled mode, switch to Mode tab
    if (mode === 'disabled') {
      setActiveSubTab('mode');
    }

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
      // Save priority settings if changed
      if (hasChanges) {
        // Merge with existing settings to preserve non-priority fields
        const existingSettings = group.settings || {};
        // Map new mode to legacy priorityMode for backward compatibility
        const legacyPriorityMode = settings.mode === 'disabled' ? 'disabled' : 'automatic';

        await updateGroup(group.id, {
          settings: {
            ...existingSettings,
            prioritySettings: settings,
            // Also update legacy fields for backward compatibility
            lootPriority: settings.roleBasedConfig?.roleOrder || ['melee', 'ranged', 'caster', 'tank', 'healer'],
            priorityMode: legacyPriorityMode,
            showPriorityScores: settings.advancedOptions.showPriorityScores,
            enableEnhancedScoring: settings.advancedOptions.enableEnhancedFairness,
          },
        });
      }

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

  // Get configured players for display
  const configuredPlayers = players.filter(p => p.configured);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Subtab navigation */}
      <div className="flex-shrink-0 flex items-center gap-1 mb-4 bg-surface-base rounded-lg p-1 w-fit">
        <Tooltip content="Configure priority mode and order">
          {/* design-system-ignore: Subtab button requires specific toggle styling */}
          <button
            onClick={() => setActiveSubTab('mode')}
            className={`px-3 py-1.5 text-sm rounded transition-colors font-medium ${
              activeSubTab === 'mode'
                ? 'bg-accent/20 text-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
            }`}
          >
            Mode
          </button>
        </Tooltip>
        <Tooltip content={settings.mode === 'disabled' ? 'Advanced options are not available when priority is disabled' : 'Fine-tune priority calculations'}>
          {/* design-system-ignore: Subtab button requires specific toggle styling */}
          <button
            onClick={() => settings.mode !== 'disabled' && setActiveSubTab('advanced')}
            disabled={settings.mode === 'disabled'}
            className={`px-3 py-1.5 text-sm rounded transition-colors font-medium ${
              settings.mode === 'disabled'
                ? 'text-text-disabled cursor-not-allowed'
                : activeSubTab === 'advanced'
                  ? 'bg-accent/20 text-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
            }`}
          >
            Advanced
          </button>
        </Tooltip>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto space-y-6 min-h-0 pb-20" style={{ scrollbarGutter: 'stable' }}>
        {/* Permission warning */}
        {!canEdit && (
          <div className="p-3 bg-status-warning/10 border border-status-warning/30 rounded text-status-warning text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Only owners and leads can modify priority settings.
          </div>
        )}

        {/* Error display */}
        {error && <ErrorBox message={error} size="sm" />}

        {/* Mode subtab content */}
        {activeSubTab === 'mode' && (
          <>
            {/* Mode selector */}
            <div>
              <Label>Priority Mode</Label>
              <ModeSelector
                value={settings.mode}
                onChange={handleModeChange}
                disabled={!canEdit}
              />
            </div>

            {/* Mode-specific editor */}
            {settings.mode === 'role-based' && settings.roleBasedConfig && (
              <div>
                <Label>Role Priority Order</Label>
                <RoleBasedEditor
                  roleOrder={settings.roleBasedConfig.roleOrder}
                  onChange={handleRoleOrderChange}
                  disabled={!canEdit}
                />
              </div>
            )}

            {settings.mode === 'job-based' && settings.jobBasedConfig && (
              <div>
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
              <div>
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
              <div className="p-4 bg-surface-elevated rounded-lg border border-border-default">
                <p className="text-text-muted text-sm">
                  Manual planning mode lets you pre-assign loot to players for each week.
                  Go to the Loot tab to create weekly assignments.
                </p>
              </div>
            )}

            {settings.mode === 'disabled' && (
              <div className="p-4 bg-surface-elevated rounded-lg border border-border-default">
                <p className="text-text-muted text-sm">
                  Priority is disabled. All players will show equal priority in the Loot tab.
                  This is useful for groups that prefer equal distribution.
                </p>
              </div>
            )}
          </>
        )}

        {/* Advanced subtab content */}
        {activeSubTab === 'advanced' && (
          <AdvancedOptions
            options={settings.advancedOptions}
            onChange={handleAdvancedOptionsChange}
            disabled={!canEdit}
            priorityDisabled={settings.mode === 'disabled'}
            players={configuredPlayers}
            groupId={group.id}
            tierId={tierId}
          />
        )}
      </div>

      {/* Sticky Save button footer */}
      {canEdit && (
        <div className="flex-shrink-0 flex justify-end pt-4 pb-4 pr-4 border-t border-border-default bg-surface-card">
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
  );
}
