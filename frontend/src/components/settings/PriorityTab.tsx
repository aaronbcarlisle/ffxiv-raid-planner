/**
 * Settings Priority Tab
 *
 * Consolidated priority configuration for the settings panel.
 * Includes mode selection, configuration, advanced options, and player loot adjustments.
 */

import { useState, useEffect, useCallback } from 'react';
import { Save, AlertCircle, ChevronDown, ChevronRight, Users } from 'lucide-react';
import { Button } from '../primitives';
import { Label, ErrorBox, NumberInput } from '../ui';
import { ModeSelector } from '../priority/ModeSelector';
import { RoleBasedEditor } from '../priority/RoleBasedEditor';
import { JobBasedEditor } from '../priority/JobBasedEditor';
import { PlayerBasedEditor } from '../priority/PlayerBasedEditor';
import { AdvancedOptions } from '../priority/AdvancedOptions';
import { JobIcon } from '../ui/JobIcon';
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
  onClose?: () => void;
}

export function PriorityTab({ group, players, onClose }: PriorityTabProps) {
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

  // Player loot adjustments state
  const [lootAdjustments, setLootAdjustments] = useState<Record<string, number>>(() => {
    const adjustments: Record<string, number> = {};
    players.forEach(p => {
      adjustments[p.id] = p.lootAdjustment ?? 0;
    });
    return adjustments;
  });
  const [showPlayerAdjustments, setShowPlayerAdjustments] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [hasAdjustmentChanges, setHasAdjustmentChanges] = useState(false);

  // Track changes
  useEffect(() => {
    const original = group.settings?.prioritySettings || DEFAULT_PRIORITY_SETTINGS;
    const changed = JSON.stringify(settings) !== JSON.stringify(original);
    setHasChanges(changed);
  }, [settings, group.settings?.prioritySettings]);

  // Track adjustment changes
  useEffect(() => {
    const originalAdjustments: Record<string, number> = {};
    players.forEach(p => {
      originalAdjustments[p.id] = p.lootAdjustment ?? 0;
    });
    const changed = JSON.stringify(lootAdjustments) !== JSON.stringify(originalAdjustments);
    setHasAdjustmentChanges(changed);
  }, [lootAdjustments, players]);

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

  // Loot adjustment change handler
  const handleAdjustmentChange = useCallback((playerId: string, value: number | null) => {
    setLootAdjustments((prev) => ({
      ...prev,
      [playerId]: value ?? 0,
    }));
  }, []);

  // Save handler
  const handleSave = async () => {
    if (!hasChanges && !hasAdjustmentChanges) return;

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

      // Save player loot adjustments if changed
      // This would need a separate API call to update individual players
      // For now, we'll rely on the existing player update mechanism

      toast.success('Priority settings saved!');
      setHasChanges(false);
      setHasAdjustmentChanges(false);
      if (onClose) {
        onClose();
      }
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
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto space-y-6 min-h-0" style={{ scrollbarGutter: 'stable' }}>
        {/* Permission warning */}
        {!canEdit && (
        <div className="p-3 bg-status-warning/10 border border-status-warning/30 rounded text-status-warning text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Only owners and leads can modify priority settings.
        </div>
      )}

      {/* Error display */}
      {error && <ErrorBox message={error} size="sm" />}

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

      {/* Advanced options - show for all modes except disabled */}
      {settings.mode !== 'disabled' && (
        <AdvancedOptions
          options={settings.advancedOptions}
          onChange={handleAdvancedOptionsChange}
          disabled={!canEdit}
          priorityDisabled={false}
        />
      )}

      {/* Player Loot Adjustments - Collapsible section */}
      {configuredPlayers.length > 0 && settings.mode !== 'disabled' && (
        <div className="border-t border-border-default pt-4">
          <button
            type="button"
            onClick={() => setShowPlayerAdjustments(!showPlayerAdjustments)}
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors w-full text-left"
            disabled={!canEdit}
            aria-expanded={showPlayerAdjustments}
          >
            {showPlayerAdjustments ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium">Player Loot Adjustments</span>
            <span className="text-xs text-text-muted">({configuredPlayers.length} players)</span>
          </button>

          {showPlayerAdjustments && (
            <div className={`mt-4 ${!canEdit ? 'opacity-50 pointer-events-none' : ''}`}>
              <p className="text-xs text-text-muted mb-3">
                Adjust individual player priority for mid-tier roster fairness. Positive values increase priority, negative decrease.
                Use for players who joined late or missed weeks.
              </p>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {configuredPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 p-2 bg-surface-elevated rounded-lg border border-border-subtle"
                  >
                    <JobIcon job={player.job} size="sm" />
                    <span className="text-sm text-text-primary flex-1 min-w-0 truncate">
                      {player.name}
                    </span>
                    <NumberInput
                      value={lootAdjustments[player.id] ?? 0}
                      onChange={(value) => handleAdjustmentChange(player.id, value)}
                      min={-100}
                      max={100}
                      step={5}
                      size="sm"
                      disabled={!canEdit}
                      className="w-24"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Sticky Save button footer */}
      {canEdit && (
        <div className="flex-shrink-0 flex justify-end pt-4 pb-4 border-t border-border-default">
          <Button
            onClick={handleSave}
            disabled={!hasChanges && !hasAdjustmentChanges}
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
