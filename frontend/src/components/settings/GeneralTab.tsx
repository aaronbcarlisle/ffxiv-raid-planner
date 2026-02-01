/**
 * General Tab - Static general settings
 *
 * Contains: name, visibility, banner settings, share link, delete static
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { Checkbox, Label, Input, ErrorBox } from '../ui';
import { Button } from '../primitives';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { toast } from '../../stores/toastStore';
import type { StaticGroup } from '../../types';

interface GeneralTabProps {
  group: StaticGroup;
  onClose: () => void;
}

export function GeneralTab({ group, onClose }: GeneralTabProps) {
  const navigate = useNavigate();
  const { updateGroup, deleteGroup } = useStaticGroupStore();

  const [name, setName] = useState(group.name);
  const [isPublic, setIsPublic] = useState(group.isPublic);
  const [hideSetupBanners, setHideSetupBanners] = useState(group.settings?.hideSetupBanners ?? false);
  const [hideBisBanners, setHideBisBanners] = useState(group.settings?.hideBisBanners ?? false);

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
    hideBisBanners !== (group.settings?.hideBisBanners ?? false);
  const hasChanges = ownerFieldsChanged || leadFieldsChanged;
  const canSave = hasChanges && (!ownerFieldsChanged || isOwner) && (!leadFieldsChanged || canEdit);

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
          hideSetupBanners: boolean;
          hideBisBanners: boolean;
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
      {/* Scrollable content - use scroll to prevent layout shift */}
      <div className="flex-1 overflow-y-scroll space-y-6 min-h-0 -mr-4 pr-4">
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
      <div>
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
      <div>
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
      <div>
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
      <div className="flex-shrink-0 flex justify-between py-4 mt-4 border-t border-border-default">
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
