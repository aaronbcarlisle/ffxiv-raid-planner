/**
 * YourStaticsCard — Overview's main card (cols 1-2).
 * Reads groups from useStaticGroupStore; Create/join row.
 * R-PH1-E: owner-only Settings/Delete; error banner above rows; fresh delete confirm.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { CardShell } from '../../ui/CardShell';
import { Button } from '../../primitives/Button';
import { IconButton } from '../../primitives/IconButton';
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from '../../primitives/Dropdown';
import { Modal } from '../../ui/Modal';
import { Input } from '../../ui/Input';
import { InitialsAvatar } from '../../ui/InitialsAvatar';
import { Tag } from '../../ui/Tag';
import { useStaticGroupStore } from '../../../stores/staticGroupStore';
import { useAuthStore } from '../../../stores/authStore';
import { useToastStore } from '../../../stores/toastStore';
import { getInitials } from '../../../utils/initials';
import { buildStaticNavHref, prefRememberTabs } from '../../../lib/navPreferences';
import type { StaticSuggestion } from '../../../stores/playerProfileStore';
import type { StaticGroupListItem } from '../../../types';

interface DeleteConfirmProps {
  group: StaticGroupListItem;
  onClose: () => void;
}

function DeleteConfirm({ group, onClose }: DeleteConfirmProps) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const { deleteGroup, fetchGroups } = useStaticGroupStore();
  const addToast = useToastStore((s) => s.addToast);

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteGroup(group.id);
      await fetchGroups();
      addToast({ type: 'success', message: `"${group.name}" deleted.`, duration: 3000 });
      onClose();
    } catch {
      addToast({ type: 'error', message: 'Delete failed. Please try again.', duration: 4000 });
      setBusy(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={<span className="flex items-center gap-2"><Trash2 className="w-5 h-5 text-status-error" /> Delete static</span>}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            size="sm"
            disabled={typed !== group.name || busy}
            loading={busy}
            onClick={() => void handleDelete()}
          >
            Delete
          </Button>
        </div>
      }
    >
      <p className="text-sm text-text-secondary mb-4">
        Type <span className="font-semibold text-text-primary">{group.name}</span> to confirm.
        This cannot be undone.
      </p>
      <Input value={typed} onChange={setTyped} placeholder={group.name} aria-label="Confirm static name" />
    </Modal>
  );
}

interface YourStaticsCardProps {
  staticSuggestions: StaticSuggestion[];
  onCreateStatic: () => void;
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner', lead: 'Lead', member: 'Member', viewer: 'Viewer',
};

export function YourStaticsCard({ staticSuggestions, onCreateStatic }: YourStaticsCardProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { groups, isLoading, error, fetchGroups, clearError, duplicateGroup } = useStaticGroupStore();
  const addToast = useToastStore((s) => s.addToast);
  const [deletingGroup, setDeletingGroup] = useState<StaticGroupListItem | null>(null);

  const remember = prefRememberTabs(user);

  async function handleDuplicate(g: StaticGroupListItem) {
    try {
      await duplicateGroup(g.id, `${g.name} (Copy)`);
      addToast({ type: 'success', message: `"${g.name} (Copy)" created.`, duration: 3000 });
    } catch {
      // store sets error; banner shows
    }
  }

  async function handleCopyCode(g: StaticGroupListItem) {
    await navigator.clipboard.writeText(g.shareCode);
    addToast({ type: 'success', message: 'Share code copied.', duration: 2000 });
  }

  async function handleCopyLink(g: StaticGroupListItem) {
    const url = `${window.location.origin}/group/${g.shareCode}`;
    await navigator.clipboard.writeText(url);
    addToast({ type: 'success', message: 'Share link copied.', duration: 2000 });
  }

  const hasGroups = groups.length > 0;
  const showErrorBanner = !!error;
  const errorReplacesBody = showErrorBanner && !hasGroups;
  const skeleton = isLoading && !hasGroups;

  return (
    <>
      {deletingGroup && (
        <DeleteConfirm group={deletingGroup} onClose={() => setDeletingGroup(null)} />
      )}
      <CardShell title="Your statics">
        {showErrorBanner && (
          <div
            role="alert"
            className="mb-3 flex items-center justify-between gap-2 rounded-md border border-status-error/30 bg-status-error/10 px-3 py-2 text-xs text-status-error"
          >
            <span>{error}</span>
            <div className="flex gap-1.5 flex-none">
              <Button variant="ghost" size="xs" onClick={() => void fetchGroups()}>Retry</Button>
              <Button variant="ghost" size="xs" onClick={clearError}>Dismiss</Button>
            </div>
          </div>
        )}

        {errorReplacesBody ? null : skeleton ? (
          <div className="flex flex-col gap-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-surface-interactive" />
            ))}
          </div>
        ) : hasGroups ? (
          <ul className="flex flex-col divide-y divide-border-subtle">
            {groups.map((g) => {
              const isOwner = g.userRole === 'owner';
              const isLinked = g.source === 'linked';
              const roleLabel = isLinked ? 'Linked' : (ROLE_LABEL[g.userRole ?? ''] ?? (g.userRole ?? ''));
              return (
                <li key={g.id} className="flex items-center gap-3 py-2">
                  <InitialsAvatar
                    initials={getInitials(g.name)}
                    size={32}
                    className="bg-accent/15 text-accent flex-none"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">{g.name}</p>
                    <p className="flex items-center gap-1.5 text-xs text-text-muted">
                      <Tag variant="label" tone={isLinked ? 'info' : 'muted'}>{roleLabel}</Tag>
                      {g.memberCount} member{g.memberCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => navigate(buildStaticNavHref(g.shareCode, { remember }))}
                  >
                    Enter →
                  </Button>
                  <Dropdown>
                    <DropdownTrigger>
                      <IconButton
                        icon={<MoreHorizontal className="w-4 h-4" />}
                        aria-label={`Actions for ${g.name}`}
                        variant="ghost"
                        size="sm"
                      />
                    </DropdownTrigger>
                    <DropdownContent align="end">
                      <DropdownItem onSelect={() => navigate(`/group/${g.shareCode}`)}>Open</DropdownItem>
                      <DropdownItem onSelect={() => void handleCopyCode(g)}>Copy share code</DropdownItem>
                      <DropdownItem onSelect={() => void handleCopyLink(g)}>Copy share link</DropdownItem>
                      <DropdownItem onSelect={() => void handleDuplicate(g)}>Duplicate</DropdownItem>
                      {isOwner && (
                        <DropdownItem onSelect={() => navigate(`/group/${g.shareCode}?showSettings=true`)}>Settings</DropdownItem>
                      )}
                      {isOwner && (
                        <DropdownItem danger onSelect={() => setDeletingGroup(g)}>Delete</DropdownItem>
                      )}
                    </DropdownContent>
                  </Dropdown>
                </li>
              );
            })}
          </ul>
        ) : (
          /* L-2 empty state */
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm font-medium text-text-primary">No statics yet</p>
            <p className="text-xs text-text-muted">Create a static to get started, or find one to join.</p>
            <div className="flex gap-2">
              <Button variant="accent-subtle" size="sm" onClick={onCreateStatic}>Create a static</Button>
              <Button variant="secondary" size="sm" onClick={() => navigate('/discover')}>Find a static</Button>
            </div>
          </div>
        )}

        {/* Create or join row — shown when statics exist and no body error */}
        {!errorReplacesBody && hasGroups && !skeleton && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3">
            <Button variant="accent-subtle" size="xs" onClick={onCreateStatic}>Create a static</Button>
            <Button variant="secondary" size="xs" onClick={() => navigate('/discover')}>Find a static</Button>
            {staticSuggestions.length > 0 && (
              <span className="ml-auto text-xs text-text-muted">
                {staticSuggestions.length} static{staticSuggestions.length !== 1 ? 's' : ''} in Static Finder match your jobs
              </span>
            )}
          </div>
        )}
      </CardShell>
    </>
  );
}
