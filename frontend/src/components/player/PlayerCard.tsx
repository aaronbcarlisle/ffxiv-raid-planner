import { useState, useRef, useEffect, useMemo } from 'react';
import { GearTable } from './GearTable';
import { NeedsFooter } from './NeedsFooter';
import { PositionSelector } from './PositionSelector';
import { TankRoleSelector } from './TankRoleSelector';
import { JobIcon } from '../ui/JobIcon';
import { ContextMenu, Modal, type ContextMenuItem } from '../ui';
import {
  getJobDisplayName,
  getRoleColor,
  getRoleForJob,
  groupJobsByRole,
  getRoleDisplayName,
  type Role,
} from '../../gamedata';
import type { SnapshotPlayer, GearSlotStatus, StaticSettings, ViewMode, RaidPosition, TankRole } from '../../types';
import { CONTEXT_MENU_ICONS } from '../../types';
import { calculatePlayerNeeds } from '../../utils/priority';

const defaultRoleOrder: Role[] = ['tank', 'healer', 'melee', 'ranged', 'caster'];

// Get position badge color classes based on position type
function getPositionBadgeClasses(position: RaidPosition | undefined): string {
  if (!position) {
    return 'bg-bg-hover text-text-muted hover:text-text-secondary hover:bg-bg-hover/80';
  }
  if (position.startsWith('T')) {
    return 'bg-role-tank/20 text-role-tank hover:bg-role-tank/30';
  }
  if (position.startsWith('H')) {
    return 'bg-role-healer/20 text-role-healer hover:bg-role-healer/30';
  }
  // M* and R* are DPS (red)
  return 'bg-role-melee/20 text-role-melee hover:bg-role-melee/30';
}

interface PlayerCardProps {
  player: SnapshotPlayer;
  settings: StaticSettings;
  viewMode: ViewMode;
  clipboardPlayer: SnapshotPlayer | null;
  currentUserId?: string;
  isGroupOwner?: boolean;
  onUpdate: (updates: Partial<SnapshotPlayer>) => void;
  onRemove: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onResetGear?: () => void;
  onClaimPlayer?: () => void;
  onReleasePlayer?: () => void;
}

export function PlayerCard({
  player,
  settings: _settings,
  viewMode,
  clipboardPlayer,
  currentUserId,
  isGroupOwner,
  onUpdate,
  onRemove,
  onCopy,
  onPaste,
  onDuplicate,
  onResetGear,
  onClaimPlayer,
  onReleasePlayer,
}: PlayerCardProps) {
  // Expansion state follows global viewMode only (no individual override)
  const isExpanded = viewMode === 'expanded';
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showJobPicker, setShowJobPicker] = useState(false);
  const [showPositionPicker, setShowPositionPicker] = useState(false);
  const [showTankRolePicker, setShowTankRolePicker] = useState(false);
  const [jobSearch, setJobSearch] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(player.name);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const jobPickerRef = useRef<HTMLDivElement>(null);
  const positionPickerRef = useRef<HTMLDivElement>(null);
  const tankRolePickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Get the actual role color (valid roles: tank, healer, melee, ranged, caster)
  const validRoles: Role[] = ['tank', 'healer', 'melee', 'ranged', 'caster'];
  const displayRole = validRoles.includes(player.role as Role) ? player.role as Role : 'melee';
  const roleColor = getRoleColor(displayRole);
  const jobsByRole = groupJobsByRole();

  // Sort roles with current player's role first for job picker
  const roleOrder = useMemo(() => {
    const currentRole = getRoleForJob(player.job);
    if (!currentRole || !defaultRoleOrder.includes(currentRole)) return defaultRoleOrder;
    return [currentRole, ...defaultRoleOrder.filter((r) => r !== currentRole)];
  }, [player.job]);

  // Calculate completion count
  const completedSlots = player.gear.filter((g) => {
    if (g.bisSource === 'raid') return g.hasItem;
    return g.hasItem && g.isAugmented;
  }).length;
  const totalSlots = player.gear.length;

  // Calculate needs for compact view footer
  const needs = calculatePlayerNeeds(player);

  const handleGearChange = (slot: string, updates: Partial<GearSlotStatus>) => {
    const newGear = player.gear.map((g) =>
      g.slot === slot ? { ...g, ...updates } : g
    );
    onUpdate({ gear: newGear });
  };

  const handleTomeWeaponChange = (updates: Partial<typeof player.tomeWeapon>) => {
    onUpdate({ tomeWeapon: { ...player.tomeWeapon, ...updates } });
  };

  // Close job picker on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (jobPickerRef.current && !jobPickerRef.current.contains(event.target as Node)) {
        setShowJobPicker(false);
        setJobSearch('');
      }
    }
    if (showJobPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showJobPicker]);

  // Focus search when job picker opens
  useEffect(() => {
    if (showJobPicker && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showJobPicker]);

  // Focus name input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // Sync editedName with player.name when it changes externally
  useEffect(() => {
    setEditedName(player.name);
  }, [player.name]);

  const handleNameDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingName(true);
    setEditedName(player.name);
  };

  const handleNameSave = () => {
    const trimmedName = editedName.trim();
    if (trimmedName && trimmedName !== player.name) {
      onUpdate({ name: trimmedName });
    } else {
      setEditedName(player.name);
    }
    setIsEditingName(false);
  };

  const handleNameCancel = () => {
    setEditedName(player.name);
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      handleNameCancel();
    }
  };

  // Filter jobs based on search
  const allJobs = Object.values(jobsByRole).flat();
  const filteredJobs = jobSearch.trim()
    ? allJobs.filter(
        (job) =>
          job.abbreviation.toLowerCase().includes(jobSearch.toLowerCase()) ||
          getJobDisplayName(job.abbreviation).toLowerCase().includes(jobSearch.toLowerCase())
      )
    : null;

  const handleJobChange = (newJob: string) => {
    const newRole = getRoleForJob(newJob);
    if (newRole) {
      onUpdate({ job: newJob, role: newRole });
    }
    setShowJobPicker(false);
    setJobSearch('');
  };

  const handleJobIconClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowJobPicker(!showJobPicker);
  };

  const handlePositionChange = (position: RaidPosition | undefined) => {
    // Use null instead of undefined so JSON.stringify doesn't strip it
    onUpdate({ position: position ?? null });
  };

  const handleTankRoleChange = (tankRole: TankRole | undefined) => {
    // Use null instead of undefined so JSON.stringify doesn't strip it
    onUpdate({ tankRole: tankRole ?? null });
  };

  const handlePositionBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPositionPicker(!showPositionPicker);
  };

  const handleTankRoleBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTankRolePicker(!showTankRolePicker);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // Determine ownership status
  const isLinkedToMe = player.userId === currentUserId;
  const isLinkedToOther = player.userId && player.userId !== currentUserId;
  const canClaim = !player.userId && currentUserId && onClaimPlayer;
  const canRelease = (isLinkedToMe || isGroupOwner) && player.userId && onReleasePlayer;

  const contextMenuItems: ContextMenuItem[] = [
    {
      label: 'Copy Player',
      icon: CONTEXT_MENU_ICONS.copy,
      onClick: onCopy,
    },
    {
      label: 'Paste Player',
      icon: CONTEXT_MENU_ICONS.paste,
      onClick: onPaste,
      disabled: !clipboardPlayer,
    },
    {
      label: 'Duplicate Player',
      icon: CONTEXT_MENU_ICONS.duplicate,
      onClick: () => onDuplicate(),
    },
    {
      label: player.isSubstitute ? 'Mark as Main' : 'Mark as Sub',
      icon: CONTEXT_MENU_ICONS.substitute,
      onClick: () => onUpdate({ isSubstitute: !player.isSubstitute }),
    },
    { separator: true },
    // Ownership actions
    ...(canClaim ? [{
      label: 'Take Ownership',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      onClick: onClaimPlayer,
    }] : []),
    ...(canRelease ? [{
      label: isLinkedToMe ? 'Release Ownership' : 'Unlink User',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
        </svg>
      ),
      onClick: onReleasePlayer,
    }] : []),
    { separator: true },
    {
      label: 'Reset Gear',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      onClick: onResetGear,
      disabled: !onResetGear,
    },
    {
      label: 'Remove Player',
      icon: CONTEXT_MENU_ICONS.remove,
      onClick: () => setShowRemoveConfirm(true),
      danger: true,
    },
  ];

  // Elevate z-index when dropdowns are open to prevent overlap issues
  const hasOpenDropdown = showJobPicker || showPositionPicker || showTankRolePicker;

  return (
    <div
      className={`bg-bg-card border border-border-subtle rounded-lg overflow-visible flex flex-col h-full border-l-[3px] ${hasOpenDropdown ? 'z-[100] relative' : ''}`}
      style={{ borderLeftColor: roleColor }}
      onContextMenu={handleContextMenu}
    >
      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Remove Confirmation Modal */}
      <Modal
        isOpen={showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(false)}
        title="Remove Player"
      >
        <p className="text-text-secondary mb-6">
          Are you sure you want to remove <span className="text-text-primary font-medium">{player.name}</span> from the static?
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowRemoveConfirm(false)}
            className="px-4 py-2 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onRemove();
              setShowRemoveConfirm(false);
            }}
            className="px-4 py-2 rounded bg-status-error text-white hover:bg-status-error/80 transition-colors"
          >
            Remove
          </button>
        </div>
      </Modal>

      {/* Header */}
      <div className="p-3 transition-colors relative z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Clickable job icon with dropdown */}
            <div ref={jobPickerRef} className="relative">
              <button
                type="button"
                onClick={handleJobIconClick}
                className="p-0.5 rounded cursor-pointer hover:ring-2 hover:ring-accent/50 transition-all"
                style={{ backgroundColor: roleColor }}
                title="Click to change job"
              >
                <JobIcon job={player.job} size="lg" className="rounded-sm" />
              </button>

              {/* Job picker dropdown */}
              {showJobPicker && (
                <div
                  className="absolute z-50 top-full left-0 mt-2 w-64 bg-bg-secondary border border-border-default rounded-lg shadow-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Search input */}
                  <div className="p-2 border-b border-border-default">
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={jobSearch}
                      onChange={(e) => setJobSearch(e.target.value)}
                      placeholder="Search jobs..."
                      className="w-full bg-bg-primary border border-border-default rounded px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setShowJobPicker(false);
                          setJobSearch('');
                        }
                      }}
                    />
                  </div>

                  {/* Job list */}
                  <div className="max-h-56 overflow-y-auto">
                    {filteredJobs ? (
                      filteredJobs.length > 0 ? (
                        <div className="py-1">
                          {filteredJobs.map((job) => (
                            <button
                              key={job.abbreviation}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleJobChange(job.abbreviation);
                              }}
                              className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-bg-hover text-left ${
                                player.job === job.abbreviation ? 'bg-accent/10' : ''
                              }`}
                            >
                              <JobIcon job={job.abbreviation} size="md" />
                              <span className="text-text-primary">{job.abbreviation}</span>
                              <span className="text-text-secondary text-sm">
                                {getJobDisplayName(job.abbreviation)}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="px-3 py-4 text-center text-text-muted text-sm">
                          No jobs found
                        </div>
                      )
                    ) : (
                      roleOrder.map((role) => (
                        <div key={role}>
                          <div
                            className="px-3 py-1.5 text-xs font-medium sticky top-0 bg-bg-secondary border-b border-border-default"
                            style={{ color: getRoleColor(role) }}
                          >
                            {getRoleDisplayName(role)}
                          </div>
                          <div className="py-1">
                            {jobsByRole[role].map((job) => (
                              <button
                                key={job.abbreviation}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleJobChange(job.abbreviation);
                                }}
                                className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-bg-hover text-left ${
                                  player.job === job.abbreviation ? 'bg-accent/10' : ''
                                }`}
                              >
                                <JobIcon job={job.abbreviation} size="md" />
                                <span className="text-text-primary">{job.abbreviation}</span>
                                <span className="text-text-secondary text-sm">
                                  {getJobDisplayName(job.abbreviation)}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                {isEditingName ? (
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onBlur={handleNameSave}
                    onKeyDown={handleNameKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-text-primary bg-bg-primary border border-accent rounded px-2 py-0.5 w-32 focus:outline-none"
                  />
                ) : (
                  <span
                    className="font-medium text-text-primary cursor-pointer hover:text-accent"
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={handleNameDoubleClick}
                    title="Double-click to edit name"
                  >
                    {player.name}
                  </span>
                )}
                {/* Position badge */}
                <div ref={positionPickerRef} className="relative">
                  <button
                    onClick={handlePositionBadgeClick}
                    className={`px-1.5 py-0.5 rounded text-xs font-bold transition-colors ${getPositionBadgeClasses(player.position)}`}
                    title={player.position ? `Position: ${player.position}` : 'Click to set position'}
                  >
                    {player.position || '--'}
                  </button>
                  {showPositionPicker && (
                    <PositionSelector
                      position={player.position}
                      role={player.role}
                      onSelect={handlePositionChange}
                      onClose={() => setShowPositionPicker(false)}
                    />
                  )}
                </div>
                {player.isSubstitute && (
                  <span className="text-xs bg-status-warning/20 text-status-warning px-1.5 py-0.5 rounded font-medium">
                    SUB
                  </span>
                )}
                {/* Linked user badge */}
                {isLinkedToMe && (
                  <span className="text-xs bg-accent/20 text-accent px-1.5 py-0.5 rounded font-medium" title="This is you">
                    You
                  </span>
                )}
                {isLinkedToOther && player.linkedUser && (
                  <span
                    className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-medium flex items-center gap-1"
                    title={`Linked to ${player.linkedUser.displayName || player.linkedUser.discordUsername}`}
                  >
                    {player.linkedUser.avatarUrl ? (
                      <img
                        src={player.linkedUser.avatarUrl}
                        alt=""
                        className="w-3 h-3 rounded-full"
                      />
                    ) : null}
                    <span className="max-w-16 truncate">
                      {player.linkedUser.displayName || player.linkedUser.discordUsername}
                    </span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span style={{ color: roleColor }}>{player.job}</span>
                <span className="text-text-muted">-</span>
                <span className="text-text-secondary">{getJobDisplayName(player.job)}</span>
                {/* Tank role badge (MT/OT) - only for tanks */}
                {player.role === 'tank' && (
                  <div ref={tankRolePickerRef} className="relative">
                    <button
                      onClick={handleTankRoleBadgeClick}
                      className={`px-1.5 py-0.5 rounded text-xs font-bold transition-colors ${
                        player.tankRole
                          ? 'bg-role-tank/20 text-role-tank hover:bg-role-tank/30'
                          : 'bg-bg-hover text-text-muted hover:text-text-secondary hover:bg-bg-hover/80'
                      }`}
                      title={player.tankRole ? `Tank role: ${player.tankRole}` : 'Click to set MT/OT'}
                    >
                      {player.tankRole || '--'}
                    </button>
                    {showTankRolePicker && (
                      <TankRoleSelector
                        tankRole={player.tankRole}
                        onSelect={handleTankRoleChange}
                        onClose={() => setShowTankRolePicker(false)}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Completion count */}
          <div className="text-right">
            <div className="text-lg font-bold text-text-primary">
              {completedSlots}/{totalSlots}
            </div>
          </div>
        </div>


      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-border-default p-3 relative z-10">
          <GearTable
            gear={player.gear}
            tomeWeapon={player.tomeWeapon}
            onGearChange={handleGearChange}
            onTomeWeaponChange={handleTomeWeaponChange}
          />
        </div>
      )}

      {/* Spacer to push footer to bottom */}
      <div className="flex-1" />

      {/* Needs Footer - always visible at bottom */}
      <NeedsFooter needs={needs} />
    </div>
  );
}
