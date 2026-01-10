/**
 * Static Settings Modal
 *
 * Allows owners to rename, toggle public/private, manage invitations, and delete their static.
 * Also allows leads/owners to customize loot priority order.
 */

import { useState } from 'react';
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
import { Modal, Checkbox, Label, Input } from '../ui';
import { Button } from '../primitives';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { toast } from '../../stores/toastStore';
import { InvitationsPanel } from './InvitationsPanel';
import { MembersPanel } from './MembersPanel';
import { DEFAULT_LOOT_PRIORITY } from '../../utils/constants';
import type { StaticGroup } from '../../types';

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-4 py-3 bg-surface-elevated border border-border-default rounded-lg cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      }`}
      {...attributes}
      {...listeners}
    >
      <span className="text-text-muted">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </span>
      <span className="text-text-secondary font-medium w-6">{index + 1}.</span>
      <span className="text-text-primary">{ROLE_DISPLAY_NAMES[role] || role}</span>
    </div>
  );
}

interface GroupSettingsModalProps {
  group: StaticGroup;
  onClose: () => void;
}

export function GroupSettingsModal({ group, onClose }: GroupSettingsModalProps) {
  const navigate = useNavigate();
  const { updateGroup, deleteGroup } = useStaticGroupStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [name, setName] = useState(group.name);
  const [isPublic, setIsPublic] = useState(group.isPublic);
  const [lootPriority, setLootPriority] = useState<string[]>(
    group.settings?.lootPriority || DEFAULT_LOOT_PRIORITY
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isOwner = group.userRole === 'owner';
  const canEditPriority = group.userRole === 'owner' || group.userRole === 'lead';
  const canManageInvitations = group.userRole === 'owner' || group.userRole === 'lead';

  // Check if priority has changed
  const originalPriority = group.settings?.lootPriority || DEFAULT_LOOT_PRIORITY;
  const priorityChanged = JSON.stringify(lootPriority) !== JSON.stringify(originalPriority);
  const hasChanges = name !== group.name || isPublic !== group.isPublic || priorityChanged;

  // DnD sensors for priority reordering
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
      const updateData: { name?: string; isPublic?: boolean; settings?: { lootPriority: string[] } } = {};

      if (name !== group.name) {
        updateData.name = name;
      }
      if (isPublic !== group.isPublic) {
        updateData.isPublic = isPublic;
      }
      if (priorityChanged) {
        updateData.settings = { lootPriority };
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
    <Modal isOpen={true} onClose={onClose} title="Static Settings" size="lg">
      <div className="flex flex-col h-full">
        {/* Tabs */}
        <div className="flex border-b border-border-default -mx-6 px-6">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'general'
                ? 'text-accent border-b-2 border-accent -mb-[1px]'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('priority')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'priority'
                ? 'text-accent border-b-2 border-accent -mb-[1px]'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Priority
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'members'
                ? 'text-accent border-b-2 border-accent -mb-[1px]'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Members
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'invitations'
                ? 'text-accent border-b-2 border-accent -mb-[1px]'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Invitations
          </button>
        </div>

        {/* Content */}
        <div className="py-4 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-status-error/10 border border-status-error/30 rounded text-status-error text-sm">
              {error}
            </div>
          )}

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

              {/* Share Code */}
              <div className="mb-6">
                <Label>Share Link</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={`${window.location.origin}/group/${group.shareCode}`}
                    onChange={() => {}}
                    className="flex-1 font-mono text-sm"
                    disabled
                  />
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
                      variant="ghost"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-status-error hover:text-status-error/80"
                    >
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
                    disabled={!hasChanges || !isOwner}
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
            <div className="mb-4 p-3 bg-status-error/10 border border-status-error/30 rounded">
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
                error={deleteConfirmText !== '' && deleteConfirmText !== group.name}
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
              <p className="text-text-secondary text-sm mb-4">
                Drag to reorder role priority for loot distribution. Higher priority roles appear first in priority lists.
              </p>

              {!canEditPriority && (
                <div className="mb-4 p-3 bg-status-warning/10 border border-status-warning/30 rounded text-status-warning text-sm">
                  Only owners and leads can modify priority settings.
                </div>
              )}

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={lootPriority} strategy={verticalListSortingStrategy}>
                  <div className={`space-y-2 mb-6 ${!canEditPriority ? 'opacity-50 pointer-events-none' : ''}`}>
                    {lootPriority.map((role, index) => (
                      <SortableRoleItem key={role} role={role} index={index} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <div className="flex justify-between pt-4 border-t border-border-default">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleResetPriority}
                  disabled={!canEditPriority}
                >
                  Reset to Default
                </Button>
                <div className="flex gap-3">
                  <Button type="button" variant="secondary" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={!priorityChanged || !canEditPriority}
                    loading={isSaving}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'members' && (
            <MembersPanel groupId={group.id} currentUserRole={group.userRole} />
          )}

          {activeTab === 'invitations' && (
            <InvitationsPanel groupId={group.id} canManage={canManageInvitations} />
          )}
        </div>
      </div>
    </Modal>
  );
}
