/**
 * General Tab - Static general settings
 *
 * Contains: name, visibility, banner settings, share link, delete static
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { Label, Input, ErrorBox, Select, Toggle } from '../ui';
import { Button } from '../primitives';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { useAuthStore } from '../../stores/authStore';
import { prefRememberSubTabs, prefRememberStaticTab } from '../../lib/navPreferences';
import { toast } from '../../stores/toastStore';
import type { StaticGroup } from '../../types';

interface GeneralTabProps {
  group: StaticGroup;
  onClose: () => void;
}

export function GeneralTab({ group, onClose }: GeneralTabProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { updateGroup, deleteGroup } = useStaticGroupStore();

  const [name, setName] = useState(group.name);
  const [isPublic, setIsPublic] = useState(group.isPublic);
  const [hideSetupBanners, setHideSetupBanners] = useState(group.settings?.hideSetupBanners ?? false);
  const [hideBisBanners, setHideBisBanners] = useState(group.settings?.hideBisBanners ?? false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(group.settings?.autoSyncEnabled ?? false);
  const [autoSyncIntervalHours, setAutoSyncIntervalHours] = useState(group.settings?.autoSyncIntervalHours ?? 8);

  // User-level navigation preferences (apply to YOUR account across all statics,
  // not to the static). Staged in local state and persisted on the Save button,
  // same as the static fields below. They're user-scoped, so any member may save
  // them regardless of their role in this static.
  const user = useAuthStore((s) => s.user);
  const updatePreferences = useAuthStore((s) => s.updatePreferences);
  const [rememberSubTabs, setRememberSubTabs] = useState(prefRememberSubTabs(user));
  const [rememberStaticTab, setRememberStaticTab] = useState(prefRememberStaticTab(user));
  // The toggles seed from `user` at mount; if the account loads (or switches)
  // after mount, resync so they reflect the real saved prefs instead of the
  // defaults. Keyed on the user id (not the pref values), so saving — which
  // updates the same user object — never re-fires and clobbers a staged edit.
  useEffect(() => {
    setRememberSubTabs(prefRememberSubTabs(user));
    setRememberStaticTab(prefRememberStaticTab(user));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);


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
  // User-scoped nav prefs — any member can change/save their own, no role gate.
  const navPrefsChanged = rememberSubTabs !== prefRememberSubTabs(user) ||
    rememberStaticTab !== prefRememberStaticTab(user);
  // Only count static-field changes the user is actually allowed to make. The
  // inputs are disabled without permission, but the live `group` prop can still
  // diverge from local state via a background refetch — which must not block a
  // user-scoped nav-pref save or trigger a forbidden group update.
  const savableStaticChange = (isOwner && ownerFieldsChanged) || (canEdit && leadFieldsChanged);
  const hasChanges = savableStaticChange || navPrefsChanged;
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

      // User-scoped navigation preferences.
      if (navPrefsChanged) {
        try {
          await updatePreferences({ rememberSubTabs, rememberStaticTab });
          saved.push('navigation preferences');
        } catch {
          failed.push('navigation preferences');
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
            {t('common.cancel')}
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

      {/* Your navigation preferences — user-scoped, saved with the Save button */}
      <div className="border-t border-border-default pt-4">
        <p className="text-sm font-medium text-text-primary mb-1">Your Navigation</p>
        <p className="text-xs text-text-muted mb-3">
          These apply to your account across all your statics — they don't affect other members.
        </p>
        <div className="space-y-4">
          <Toggle
            checked={rememberSubTabs}
            onChange={setRememberSubTabs}
            label={t('settings.rememberSubTabs')}
            hint="Keep the last sub-tab when you return to a view. Turn off to always reset to the default sub-tab (e.g. Roster → Members)."
          />
          <Toggle
            checked={rememberStaticTab}
            onChange={setRememberStaticTab}
            label={t('settings.rememberTabPerStatic')}
            hint="When switching statics, return to that static's last tab. Turn off to stay on the tab you're currently viewing."
          />
        </div>
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
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            loading={isSaving}
          >
            {isSaving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
