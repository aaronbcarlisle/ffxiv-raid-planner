/**
 * Static Settings Modal
 *
 * Allows owners to rename, toggle public/private, manage invitations, and delete their static.
 * Also allows leads/owners to customize loot priority order.
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Settings, ListOrdered, Users, Mail, Trash2, GripVertical, ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import { useSwipe } from '../../hooks/useSwipe';
import { Modal, Checkbox, Label, Input, ErrorBox, NumberInput, Select } from '../ui';
import { Button } from '../primitives';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { toast } from '../../stores/toastStore';
import { InvitationsPanel } from './InvitationsPanel';
import { MembersPanel } from './MembersPanel';
import { DEFAULT_LOOT_PRIORITY } from '../../utils/constants';
import { RAID_JOBS } from '../../gamedata';
import type { StaticGroup, PriorityMode } from '../../types';

// Type guard for PriorityMode validation
const isPriorityMode = (value: string): value is PriorityMode => {
  return value === 'automatic' || value === 'manual' || value === 'disabled';
};

type SettingsTab = 'general' | 'priority' | 'members' | 'invitations';

// Role display names for the priority list
const ROLE_DISPLAY_NAMES: Record<string, string> = {
  melee: 'Melee DPS',
  ranged: 'Physical Ranged',
  caster: 'Magical Ranged',
  tank: 'Tank',
  healer: 'Healer',
};

// Sortable role item component
function SortableRoleItem({ role, index }: { role: string; index: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: role });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Stop touch events from propagating to parent swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-4 py-3 bg-surface-elevated border border-border-default rounded-lg select-none touch-none ${
        isDragging ? 'opacity-50 shadow-lg z-50' : ''
      }`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      {...attributes}
      {...listeners}
    >
      <span className="text-text-muted cursor-grab active:cursor-grabbing">
        <GripVertical className="w-5 h-5" />
      </span>
      <span className="text-text-secondary font-medium w-6">{index + 1}.</span>
      <span className="text-text-primary">{ROLE_DISPLAY_NAMES[role] || role}</span>
    </div>
  );
}

interface GroupSettingsModalProps {
  group: StaticGroup;
  onClose: () => void;
  isAdmin?: boolean;
  /** Initial tab to show when modal opens */
  initialTab?: SettingsTab;
  /** Whether to highlight the create invitation button */
  highlightCreateInvite?: boolean;
}

export function GroupSettingsModal({ group, onClose, isAdmin, initialTab = 'general', highlightCreateInvite = false }: GroupSettingsModalProps) {
  const navigate = useNavigate();
  const { updateGroup, deleteGroup } = useStaticGroupStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [name, setName] = useState(group.name);
  const [isPublic, setIsPublic] = useState(group.isPublic);
  const [hideSetupBanners, setHideSetupBanners] = useState(group.settings?.hideSetupBanners ?? false);
  const [hideBisBanners, setHideBisBanners] = useState(group.settings?.hideBisBanners ?? false);
  const [lootPriority, setLootPriority] = useState<string[]>(
    group.settings?.lootPriority || DEFAULT_LOOT_PRIORITY
  );
  // New priority settings
  const [priorityMode, setPriorityMode] = useState<PriorityMode>(
    group.settings?.priorityMode ?? 'automatic'
  );
  const [jobPriorityModifiers, setJobPriorityModifiers] = useState<Record<string, number>>(
    group.settings?.jobPriorityModifiers ?? {}
  );
  const [showPriorityScores, setShowPriorityScores] = useState(
    group.settings?.showPriorityScores ?? true
  );
  const [enableEnhancedScoring, setEnableEnhancedScoring] = useState(
    group.settings?.enableEnhancedScoring ?? false
  );
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [newJobModifier, setNewJobModifier] = useState<string>('');

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isOwner = group.userRole === 'owner';
  const canEdit = group.userRole === 'owner' || group.userRole === 'lead';
  const canEditPriority = canEdit;
  const canManageInvitations = canEdit;

  // Check if settings have changed
  const originalPriority = group.settings?.lootPriority || DEFAULT_LOOT_PRIORITY;
  const priorityChanged = JSON.stringify(lootPriority) !== JSON.stringify(originalPriority);
  const hideSetupBannersChanged = hideSetupBanners !== (group.settings?.hideSetupBanners ?? false);
  const hideBisBannersChanged = hideBisBanners !== (group.settings?.hideBisBanners ?? false);
  const priorityModeChanged = priorityMode !== (group.settings?.priorityMode ?? 'automatic');
  const jobModifiersChanged = JSON.stringify(jobPriorityModifiers) !== JSON.stringify(group.settings?.jobPriorityModifiers ?? {});
  const showPriorityScoresChanged = showPriorityScores !== (group.settings?.showPriorityScores ?? true);
  const enableEnhancedScoringChanged = enableEnhancedScoring !== (group.settings?.enableEnhancedScoring ?? false);
  const ownerFieldsChanged = name !== group.name || isPublic !== group.isPublic;
  const leadFieldsChanged = priorityChanged || hideSetupBannersChanged || hideBisBannersChanged ||
    priorityModeChanged || jobModifiersChanged || showPriorityScoresChanged || enableEnhancedScoringChanged;
  const hasChanges = ownerFieldsChanged || leadFieldsChanged;
  // Can save if: has changes AND all changed fields are editable by user
  const canSave = hasChanges && (!ownerFieldsChanged || isOwner) && (!leadFieldsChanged || canEdit);

  // DnD sensors for priority reordering - with activation constraint for better touch handling
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Tab order for swipe navigation
  const tabOrder: SettingsTab[] = ['general', 'priority', 'members', 'invitations'];

  // Navigate to next/previous tab
  const navigateTab = useCallback((direction: 'next' | 'prev') => {
    const currentIndex = tabOrder.indexOf(activeTab);
    if (direction === 'next' && currentIndex < tabOrder.length - 1) {
      setActiveTab(tabOrder[currentIndex + 1]);
    } else if (direction === 'prev' && currentIndex > 0) {
      setActiveTab(tabOrder[currentIndex - 1]);
    }
  }, [activeTab]);

  // Swipe handlers for tab navigation
  const swipeHandlers = useSwipe({
    onSwipeLeft: () => navigateTab('next'),
    onSwipeRight: () => navigateTab('prev'),
    minSwipeDistance: 50,
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = lootPriority.indexOf(active.id as string);
      const newIndex = lootPriority.indexOf(over.id as string);
      setLootPriority(arrayMove(lootPriority, oldIndex, newIndex));
    }
  };

  const handleResetPriority = () => {
    setLootPriority([...DEFAULT_LOOT_PRIORITY]);
  };

  const handleSave = async () => {
    if (!hasChanges) {
      onClose();
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updateData: {
        name?: string;
        isPublic?: boolean;
        settings?: {
          lootPriority: string[];
          hideSetupBanners: boolean;
          hideBisBanners: boolean;
          priorityMode: PriorityMode;
          jobPriorityModifiers?: Record<string, number>;
          showPriorityScores: boolean;
          enableEnhancedScoring: boolean;
        };
      } = {};

      if (name !== group.name) {
        updateData.name = name;
      }
      if (isPublic !== group.isPublic) {
        updateData.isPublic = isPublic;
      }
      // Send complete settings object when any setting changes
      // This prevents the backend from losing existing values
      if (leadFieldsChanged) {
        // Clean up empty jobPriorityModifiers object
        const cleanedModifiers = Object.keys(jobPriorityModifiers).length > 0
          ? jobPriorityModifiers
          : undefined;
        updateData.settings = {
          lootPriority,
          hideSetupBanners,
          hideBisBanners,
          priorityMode,
          jobPriorityModifiers: cleanedModifiers,
          showPriorityScores,
          enableEnhancedScoring,
        };
      }

      await updateGroup(group.id, updateData);
      toast.success('Settings saved!');
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save changes';
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== group.name) return;

    setIsDeleting(true);
    setError(null);

    try {
      await deleteGroup(group.id);
      toast.success('Static deleted');
      navigate('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete group';
      setError(message);
      toast.error(message);
      setIsDeleting(false);
    }
  };

  const handleCopyShareCode = () => {
    navigator.clipboard.writeText(`${window.location.origin}/group/${group.shareCode}`);
    setCopied(true);
    toast.success('Share link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Static Settings
        </span>
      }
      size="lg"
    >
      <div className="flex flex-col h-full">
        {/* Tabs - scrollable on mobile, no scrollbar on desktop */}
        <div className="flex border-b border-border-default -mx-6 px-6 overflow-x-auto overflow-y-hidden sm:overflow-x-visible scrollbar-none">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'general'
                ? 'text-accent border-b-2 border-accent -mb-[1px]'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">General</span>
          </button>
          <button
            onClick={() => setActiveTab('priority')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'priority'
                ? 'text-accent border-b-2 border-accent -mb-[1px]'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            <span className="hidden sm:inline">Priority</span>
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'members'
                ? 'text-accent border-b-2 border-accent -mb-[1px]'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Members</span>
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'invitations'
                ? 'text-accent border-b-2 border-accent -mb-[1px]'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span className="hidden sm:inline">Invitations</span>
          </button>
        </div>

        {/* Content - swipeable on mobile */}
        <div className="pt-4 overflow-y-auto flex-1" {...swipeHandlers}>
          {error && <ErrorBox message={error} size="sm" className="mb-4" />}

          {activeTab === 'general' && !showDeleteConfirm && (
            <>
              {/* Static Name */}
              <div className="mb-4">
                <Label htmlFor="staticName">Static Name</Label>
                <Input
                  id="staticName"
                  value={name}
                  onChange={setName}
                  disabled={!isOwner}
                />
              </div>

              {/* Public/Private Toggle */}
              <div className="mb-4">
                <Checkbox
                  checked={isPublic}
                  onChange={setIsPublic}
                  disabled={!isOwner}
                  label="Public Static"
                />
                <p className="text-xs text-text-muted ml-6 mt-1">
                  Anyone with the share link can view this static (read-only)
                </p>
              </div>

              {/* Hide Setup Banners */}
              <div className="mb-4">
                <Checkbox
                  checked={hideSetupBanners}
                  onChange={setHideSetupBanners}
                  disabled={!canEdit}
                  label="Hide unclaimed banners"
                />
                <p className="text-xs text-text-muted ml-6 mt-1">
                  Hide "Unclaimed" prompts on player cards
                </p>
              </div>

              {/* Hide BiS Banners */}
              <div className="mb-4">
                <Checkbox
                  checked={hideBisBanners}
                  onChange={setHideBisBanners}
                  disabled={!canEdit}
                  label="Hide BiS banners"
                />
                <p className="text-xs text-text-muted ml-6 mt-1">
                  Hide "No BiS configured" prompts on player cards
                </p>
              </div>

              {/* Share Code */}
              <div className="mb-6">
                <Label>Share Link</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <Input
                      value={`${window.location.origin}/group/${group.shareCode}`}
                      onChange={() => {}}
                      className="font-mono text-sm"
                      fullWidth
                      disabled
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyShareCode}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between pt-4 border-t border-border-default">
                <div>
                  {isOwner && (
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 className="w-4 h-4 mr-1.5" />
                      Delete Static
                    </Button>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="secondary" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={!canSave}
                    loading={isSaving}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'general' && showDeleteConfirm && (
          /* Delete Confirmation */
          <div>
            <div className="mb-4 p-3 bg-status-error/10 border border-status-error/30 rounded-lg">
              <p className="text-status-error font-medium mb-2">Delete this static?</p>
              <p className="text-text-secondary text-sm">
                This will permanently delete <strong className="text-text-primary">{group.name}</strong> and all its tier snapshots.
                This action cannot be undone.
              </p>
            </div>

            <div className="mb-4">
              <Label htmlFor="deleteConfirm">
                Type <span className="font-mono text-text-primary">{group.name}</span> to confirm
              </Label>
              <Input
                id="deleteConfirm"
                value={deleteConfirmText}
                onChange={setDeleteConfirmText}
                placeholder={group.name}
                error={deleteConfirmText !== '' && deleteConfirmText !== group.name ? 'Name does not match' : undefined}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleDelete}
                disabled={deleteConfirmText !== group.name}
                loading={isDeleting}
              >
                Delete Static
              </Button>
            </div>
          </div>
          )}

          {activeTab === 'priority' && (
            <div>
              {!canEditPriority && (
                <div className="mb-4 p-3 bg-status-warning/10 border border-status-warning/30 rounded text-status-warning text-sm">
                  Only owners and leads can modify priority settings.
                </div>
              )}

              {/* Priority Mode Selection */}
              <div className="mb-6">
                <Label htmlFor="priorityMode">Priority Mode</Label>
                <Select
                  id="priorityMode"
                  value={priorityMode}
                  onChange={(value) => {
                    if (isPriorityMode(value)) {
                      setPriorityMode(value);
                    }
                  }}
                  disabled={!canEditPriority}
                  options={[
                    { value: 'automatic', label: 'Automatic (recommended)' },
                    { value: 'manual', label: 'Manual (show priority, I decide)' },
                    { value: 'disabled', label: 'Disabled (equal distribution)' },
                  ]}
                />
                <p className="text-xs text-text-muted mt-1">
                  {priorityMode === 'automatic' && 'System calculates and suggests top priority player for each drop.'}
                  {priorityMode === 'manual' && 'Priority scores shown but no automatic suggestions.'}
                  {priorityMode === 'disabled' && 'All players show equal priority (score: 0). Use for equal distribution groups.'}
                </p>
              </div>

              {/* Role Priority Order - only show if not disabled */}
              {priorityMode !== 'disabled' && (
                <div className="mb-6">
                  <Label>Role Priority Order</Label>
                  <p className="text-text-secondary text-sm mb-3">
                    Drag to reorder role priority for loot distribution. Higher priority roles appear first in priority lists.
                  </p>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext items={lootPriority} strategy={verticalListSortingStrategy}>
                      <div className={`space-y-2 ${!canEditPriority ? 'opacity-50 pointer-events-none' : ''}`}>
                        {lootPriority.map((role, index) => (
                          <SortableRoleItem key={role} role={role} index={index} />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetPriority}
                    disabled={!canEditPriority}
                    className="mt-2"
                  >
                    Reset to Default
                  </Button>
                </div>
              )}

              {/* Advanced Options - Collapsible */}
              <div className="border-t border-border-default pt-4">
                <button
                  type="button"
                  onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                  className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors w-full text-left"
                  disabled={!canEditPriority}
                >
                  {showAdvancedOptions ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium">Advanced Options</span>
                </button>

                {showAdvancedOptions && (
                  <div className={`mt-4 space-y-4 ${!canEditPriority ? 'opacity-50 pointer-events-none' : ''}`}>
                    {/* Show Priority Scores */}
                    <Checkbox
                      checked={showPriorityScores}
                      onChange={setShowPriorityScores}
                      disabled={!canEditPriority}
                      label="Show priority scores"
                      description="Display numeric priority scores in the loot panel"
                    />

                    {/* Enable Enhanced Scoring */}
                    <Checkbox
                      checked={enableEnhancedScoring}
                      onChange={setEnableEnhancedScoring}
                      disabled={!canEditPriority}
                      label="Enable enhanced fairness scoring"
                      description="Adds drought bonus (no drops in X weeks) and balance penalty (received more than average)"
                    />

                    {/* Job Priority Modifiers */}
                    <div>
                      <Label>Job Priority Adjustments</Label>
                      <p className="text-text-muted text-xs mb-2">
                        Fine-tune priority for specific jobs. Positive values increase priority, negative decrease.
                      </p>

                      {/* Existing modifiers */}
                      {Object.entries(jobPriorityModifiers).length > 0 && (
                        <div className="space-y-2 mb-3">
                          {Object.entries(jobPriorityModifiers).map(([job, modifier]) => (
                            <div key={job} className="flex items-center gap-2">
                              <span className="text-sm text-text-secondary w-16">{job}</span>
                              <NumberInput
                                value={modifier}
                                onChange={(value) => {
                                  const newModifiers = { ...jobPriorityModifiers };
                                  if (value === null || value === 0) {
                                    delete newModifiers[job];
                                  } else {
                                    newModifiers[job] = value;
                                  }
                                  setJobPriorityModifiers(newModifiers);
                                }}
                                min={-100}
                                max={100}
                                step={5}
                                size="sm"
                                disabled={!canEditPriority}
                                className="w-28"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const newModifiers = { ...jobPriorityModifiers };
                                  delete newModifiers[job];
                                  setJobPriorityModifiers(newModifiers);
                                }}
                                className="p-1 text-text-muted hover:text-status-error transition-colors"
                                disabled={!canEditPriority}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add new modifier */}
                      <div className="flex items-center gap-2">
                        <Select
                          value={newJobModifier}
                          onChange={setNewJobModifier}
                          disabled={!canEditPriority}
                          placeholder="Select job..."
                          options={RAID_JOBS
                            .filter((job) => !jobPriorityModifiers[job.abbreviation])
                            .map((job) => ({
                              value: job.abbreviation,
                              label: `${job.abbreviation} - ${job.name}`,
                            }))}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            if (newJobModifier) {
                              setJobPriorityModifiers({
                                ...jobPriorityModifiers,
                                [newJobModifier]: 0,
                              });
                              setNewJobModifier('');
                            }
                          }}
                          disabled={!canEditPriority || !newJobModifier}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-border-default">
                <Button type="button" variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!leadFieldsChanged || !canEditPriority}
                  loading={isSaving}
                >
                  Save
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'members' && (
            <MembersPanel groupId={group.id} currentUserRole={group.userRole} isAdmin={isAdmin} />
          )}

          {activeTab === 'invitations' && (
            <InvitationsPanel
              groupId={group.id}
              canManage={canManageInvitations}
              highlightCreateButton={highlightCreateInvite}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
