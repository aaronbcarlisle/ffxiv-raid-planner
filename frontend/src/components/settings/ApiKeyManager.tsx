/**
 * API Key Manager
 *
 * Manages API keys for external integrations (e.g., Dalamud plugin).
 * Allows creating, listing, and revoking API keys.
 */

import { useState, useEffect, useCallback } from 'react';
import { Key, Copy, Check, Trash2, Plus, AlertTriangle } from 'lucide-react';
import { useApiKeyStore, type ApiKey, type ApiKeyCreateResponse } from '../../stores/apiKeyStore';
import { Modal } from '../ui/Modal';
import { useModal } from '../../hooks/useModal';
import { ConfirmModal } from '../ui/ConfirmModal';
import { Button } from '../primitives/Button';
import { Input } from '../ui/Input';
import { Skeleton } from '../ui/Skeleton';
import { toast } from '../../stores/toastStore';

export function ApiKeyManager() {
  const { keys, isLoading, error, fetchKeys, createKey, revokeKey } = useApiKeyStore();
  const createModal = useModal();
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<ApiKeyCreateResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = useCallback(async () => {
    if (!newKeyName.trim()) return;
    setIsCreating(true);
    try {
      const result = await createKey(newKeyName.trim());
      setCreatedKey(result);
      setNewKeyName('');
      toast.success('API key created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  }, [newKeyName, createKey]);

  const handleCopyKey = useCallback(async () => {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
      toast.success('API key copied to clipboard');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  }, [createdKey]);

  const handleRevoke = useCallback(async () => {
    if (!revokeTarget) return;
    try {
      await revokeKey(revokeTarget.id);
      toast.success('API key revoked');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke API key');
    } finally {
      setRevokeTarget(null);
    }
  }, [revokeTarget, revokeKey]);

  const handleCloseCreatedKey = useCallback(() => {
    setCreatedKey(null);
    createModal.close();
  }, [createModal]);

  const activeKeys = keys.filter((k) => k.isActive);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Key className="w-5 h-5 text-accent" />
            API Keys
          </h3>
          <p className="text-sm text-text-secondary mt-1">
            API keys allow external tools like the Dalamud plugin to access your data.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={createModal.open}
          disabled={activeKeys.length >= 10}
        >
          <Plus className="w-4 h-4" />
          Create Key
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-status-error/10 text-status-error text-sm">
          {error}
        </div>
      )}

      {/* Key List */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : activeKeys.length === 0 ? (
        <div className="text-center py-8 text-text-muted">
          <Key className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No API keys yet</p>
          <p className="text-xs mt-1">Create one to use with external tools</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeKeys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between p-3 rounded-lg bg-surface-secondary border border-border-default"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary text-sm">{key.name}</span>
                  <code className="text-xs text-text-muted bg-surface-tertiary px-1.5 py-0.5 rounded">
                    {key.keyPrefix}...
                  </code>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                  <span>Created {formatDate(key.createdAt)}</span>
                  {key.lastUsedAt && (
                    <span>Last used {formatDate(key.lastUsedAt)}</span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRevokeTarget(key)}
                className="text-status-error hover:text-status-error"
                aria-label={`Revoke API key "${key.name}"`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Create Key Modal */}
      <Modal isOpen={createModal.isOpen} onClose={handleCloseCreatedKey} title="Create API Key">
        {createdKey ? (
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-status-warning/10 border border-status-warning/30">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-status-warning mt-0.5 flex-shrink-0" />
                <p className="text-sm text-status-warning">
                  Copy this key now. It will not be shown again.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {/* design-system-ignore */}<label className="text-sm font-medium text-text-secondary">API Key</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm bg-surface-tertiary p-2 rounded border border-border-default font-mono break-all text-text-primary">
                  {createdKey.key}
                </code>
                <Button variant="secondary" size="sm" onClick={handleCopyKey} aria-label="Copy API key">
                  {copied ? <Check className="w-4 h-4 text-status-success" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="primary" onClick={handleCloseCreatedKey}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              {/* design-system-ignore */}<label className="text-sm font-medium text-text-secondary">Key Name</label>
              <Input
                placeholder="e.g., Dalamud Plugin"
                value={newKeyName}
                onChange={(value) => setNewKeyName(value)}
                maxLength={100}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                }}
              />
            </div>
            <p className="text-xs text-text-muted">
              This key will have access to read priority data and write loot/material logs for your statics.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={createModal.close}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreate}
                disabled={!newKeyName.trim() || isCreating}
              >
                {isCreating ? 'Creating...' : 'Create Key'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Revoke Confirmation */}
      {revokeTarget && (
        <ConfirmModal
          isOpen={!!revokeTarget}
          onCancel={() => setRevokeTarget(null)}
          onConfirm={handleRevoke}
          title="Revoke API Key"
          message={`Are you sure you want to revoke "${revokeTarget.name}"? Any applications using this key will lose access immediately.`}
          variant="danger"
        />
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}
