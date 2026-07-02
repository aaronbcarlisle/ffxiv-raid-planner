/**
 * Static Tab - Static configuration (managers only)
 *
 * Contains: name, visibility, banner settings, auto-sync, share link, delete static.
 * (User-level navigation preferences live in the General tab.)
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { Label, Input, ErrorBox, Select, Toggle } from '../ui';
import { Button } from '../primitives';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { toast } from '../../stores/toastStore';
import type { StaticGroup } from '../../types';

interface StaticTabProps {
  group: StaticGroup;
  onClose: () => void;
}

export function StaticTab({ group, onClose }: StaticTabProps) {
  const navigate = useNavigate();
  const { updateGroup, deleteGroup } = useStaticGroupStore();

  const [name, setName] = useState(group.name);
  const [isPublic, setIsPublic] = useState(group.isPublic);
  const [hideSetupBanners, setHideSetupBanners] = useState(group.settings?.hideSetupBanners ?? false);
  const [hideBisBanners, setHideBisBanners] = useState(group.settings?.hideBisBanners ?? false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(group.settings?.autoSyncEnabled ?? false);
  const [autoSyncIntervalHours, setAutoSyncIntervalHours] = useState(group.settings?.autoSyncIntervalHours ?? 8);

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isOwner = group.userRole === 'owner';
  const canEdit = group.userRole === 'owner' || group.userRole === 'lead';

  // Check if settings have changed
  const ownerFieldsChanged = name !== group.name || isPublic !== group.isPublic;
  const leadFieldsChanged = hideSetupBanners !== (group.settings?.hideSetupBanners ?? false) ||
    hideBisBanners !== (group.settings?.hideBisBanners ?? false) ||
    autoSyncEnabled !== (group.settings?.autoSyncEnabled ?? false) ||
    autoSyncIntervalHours !== (group.settings?.autoSyncIntervalHours ?? 8);
  // Only count static-field changes the user is actually allowed to make. The
  // inputs are disabled without permission, but the live `group` prop can still
  // diverge from local state via a background refetch — which must not trigger a
  // forbidden group update.
  const savableStaticChange = (isOwner && ownerFieldsChanged) || (canEdit && leadFieldsChanged);
  const hasChanges = savableStaticChange;
  const canSave = hasChanges;

  const handleSave = async () => {
    if (!hasChanges) {
      return;
    }

    setIsSaving(true);
    setError(null);

    // The static-group update and the user-preference update hit independent
    // endpoints, so run them separately and report per-operation. That way a
    // failure in one doesn't hide that the other persisted (and the user knows
    // exactly what still needs saving), rather than a single "failed" message
    // implying nothing was saved.
    const failed: string[] = [];
    const saved: string[] = [];
    try {
      // Static fields — only push a group update for changes the user is
      // permitted to make. Skips the update entirely when only the user-scoped
      // nav prefs changed (or when a static field merely diverged via refetch),
      // so members without edit rights never hit a forbidden update.
      if (savableStaticChange) {
        const updateData: {
          name?: string;
          isPublic?: boolean;
          settings?: {
            hideSetupBanners: boolean;
            hideBisBanners: boolean;
            autoSyncEnabled: boolean;
            autoSyncIntervalHours: number;
          };
        } = {};

        if (name !== group.name) {
          updateData.name = name;
        }
        if (isPublic !== group.isPublic) {
          updateData.isPublic = isPublic;
        }
        if (leadFieldsChanged) {
          updateData.settings = {
            ...group.settings,
            hideSetupBanners,
            hideBisBanners,
            autoSyncEnabled,
            autoSyncIntervalHours,
          };
        }

        try {
          await updateGroup(group.id, updateData);
          saved.push('static settings');
        } catch {
          failed.push('static settings');
        }
      }

      if (failed.length === 0) {
        toast.success('Settings saved!');
      } else {
        const tail = saved.length ? ` ${saved.join(' and ')} saved.` : '';
        const message = `Failed to save ${failed.join(' and ')}.${tail}`;
        setError(message);
        toast.error(message);
      }
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
      navigate('/profile?tab=statics');
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

  if (showDeleteConfirm) {
    return (
      <div className="space-y-4">
        <div className="p-3 bg-status-error/10 border border-status-error/30 rounded-lg">
          <p className="text-status-error font-medium mb-2">Delete this static?</p>
          <p className="text-text-secondary text-sm">
            This will permanently delete <strong className="text-text-primary">{group.name}</strong> and all its tier snapshots.
            This action cannot be undone.
          </p>
        </div>

        <div>
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
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto space-y-6 min-h-0 ml-[3px]" style={{ scrollbarGutter: 'stable' }}>
        {error && <ErrorBox message={error} size="sm" />}

      {/* Static Name */}
      <div>
        <Label htmlFor="staticName">Static Name</Label>
        <Input
          id="staticName"
          value={name}
          onChange={setName}
          disabled={!isOwner}
        />
      </div>

      {/* Public/Private Toggle */}
      <Toggle
        checked={isPublic}
        onChange={setIsPublic}
        disabled={!isOwner}
        label="Public Static"
        hint="Anyone with the share link can view this static (read-only)"
      />

      {/* Hide Setup Banners */}
      <Toggle
        checked={hideSetupBanners}
        onChange={setHideSetupBanners}
        disabled={!canEdit}
        label="Hide unclaimed banners"
        hint="Hide 'Unclaimed' prompts on player cards"
      />

      {/* Hide BiS Banners */}
      <Toggle
        checked={hideBisBanners}
        onChange={setHideBisBanners}
        disabled={!canEdit}
        label="Hide BiS banners"
        hint="Hide 'No BiS configured' prompts on player cards"
      />

      {/* Auto-Sync Section */}
      <div className="border-t border-border-default pt-4">
        <p className="text-sm font-medium text-text-primary mb-3">Lodestone Auto-Sync</p>
        <Toggle
          checked={autoSyncEnabled}
          onChange={setAutoSyncEnabled}
          disabled={!canEdit}
          label="Auto-sync gear"
          hint="Periodically re-sync Lodestone gear for all linked players in this static"
        />
        {autoSyncEnabled && (
          <div className="mt-3">
            <Label htmlFor="syncInterval">Sync interval</Label>
            <Select
              id="syncInterval"
              value={String(autoSyncIntervalHours)}
              onChange={(val) => setAutoSyncIntervalHours(Number(val))}
              disabled={!canEdit}
              options={[
                { value: '4', label: 'Every 4 hours' },
                { value: '6', label: 'Every 6 hours' },
                { value: '8', label: 'Every 8 hours (recommended)' },
                { value: '12', label: 'Every 12 hours' },
                { value: '24', label: 'Once per day' },
              ]}
            />
            <p className="mt-1 text-xs text-text-muted">
              Only players with a linked Lodestone character will be synced. Gear is fetched from Lodestone/Tomestone.
            </p>
          </div>
        )}
      </div>

        {/* Share Code */}
        <div>
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
      </div>

      {/* Sticky Action Buttons footer */}
      <div className="flex-shrink-0 flex justify-between pt-4 pb-4 pr-4 border-t border-border-default">
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
    </div>
  );
}
