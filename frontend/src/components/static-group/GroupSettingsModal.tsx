/**
 * Static Settings Modal
 *
 * Allows owners to rename, toggle public/private, manage invitations, and delete their static.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { InvitationsPanel } from './InvitationsPanel';
import { MembersPanel } from './MembersPanel';
import type { StaticGroup } from '../../types';

type SettingsTab = 'general' | 'members' | 'invitations';

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
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isOwner = group.userRole === 'owner';
  const canManageInvitations = group.userRole === 'owner' || group.userRole === 'lead';
  const hasChanges = name !== group.name || isPublic !== group.isPublic;

  const handleSave = async () => {
    if (!hasChanges) {
      onClose();
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await updateGroup(group.id, { name, isPublic });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
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
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete group');
      setIsDeleting(false);
    }
  };

  const handleCopyShareCode = () => {
    navigator.clipboard.writeText(`${window.location.origin}/group/${group.shareCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-bg-card rounded-lg border border-white/10 w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-xl font-display text-accent">Static Settings</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
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
        <div className="p-4 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          {activeTab === 'general' && !showDeleteConfirm && (
            <>
              {/* Static Name */}
              <div className="mb-4">
                <label className="block text-sm text-text-secondary mb-1">Static Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!isOwner}
                  className="w-full bg-bg-primary border border-white/10 rounded px-3 py-2 text-text-primary focus:outline-none focus:border-accent disabled:opacity-50"
                />
              </div>

              {/* Public/Private Toggle */}
              <div className="mb-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    disabled={!isOwner}
                    className="w-4 h-4 rounded border-white/20 bg-bg-primary text-accent focus:ring-accent focus:ring-offset-0"
                  />
                  <div>
                    <span className="text-text-primary">Public Static</span>
                    <p className="text-xs text-text-muted">
                      Anyone with the share link can view this static (read-only)
                    </p>
                  </div>
                </label>
              </div>

              {/* Share Code */}
              <div className="mb-6">
                <label className="block text-sm text-text-secondary mb-1">Share Link</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={`${window.location.origin}/group/${group.shareCode}`}
                    readOnly
                    className="flex-1 bg-bg-primary border border-white/10 rounded px-3 py-2 text-text-primary text-sm font-mono"
                  />
                  <button
                    onClick={handleCopyShareCode}
                    className="px-3 py-2 bg-accent/20 text-accent rounded hover:bg-accent/30 text-sm"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between">
                <div>
                  {isOwner && (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Delete Static
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-text-secondary hover:text-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!hasChanges || isSaving || !isOwner}
                    className="bg-accent text-bg-primary px-4 py-2 rounded font-medium hover:bg-accent-bright disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'general' && showDeleteConfirm && (
          /* Delete Confirmation */
          <div>
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded">
              <p className="text-red-400 font-medium mb-2">Delete this static?</p>
              <p className="text-text-secondary text-sm">
                This will permanently delete <strong className="text-text-primary">{group.name}</strong> and all its tier snapshots.
                This action cannot be undone.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-text-secondary mb-1">
                Type <span className="font-mono text-text-primary">{group.name}</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full bg-bg-primary border border-red-500/30 rounded px-3 py-2 text-text-primary focus:outline-none focus:border-red-500"
                placeholder={group.name}
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2 text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirmText !== group.name || isDeleting}
                className="bg-red-500 text-white px-4 py-2 rounded font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Deleting...' : 'Delete Static'}
              </button>
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
    </div>
  );
}
