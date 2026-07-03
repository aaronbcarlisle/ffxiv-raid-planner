/**
 * ShellContentStates (flip-P1 Task 3)
 *
 * The v2 shell's load / error / not-found / no-tiers states. `ShellContent`
 * renders this AROUND `GroupViewContent`, so these states fill the content area
 * BEFORE the happy-path content — while the shell chrome (rail / topbar / spine)
 * stays mounted. Legacy `GroupView` owns the same five branches around its own
 * body; this is the v2 twin.
 *
 * Contract: the COPY is verbatim-legacy (mirrors GroupView.tsx's loading / private
 * / not-found / no-tiers / error-modal strings byte-for-byte); the MARKUP is new
 * v2 (PageSkeleton / CardShell / EmptyState / Modal, tokens only). Precedence,
 * top → bottom:
 *   1. loading   — group fetch in flight, nothing loaded yet
 *   2. error     — group fetch failed and nothing loaded (private vs raw error)
 *   3. not-found — load finished, still no group
 *   4. no-tiers  — group loaded but it has zero tiers
 *   5. otherwise — render `children`, plus an error Modal overlay when a group is
 *                  loaded but a (subsequent) error is present.
 *
 * Store reads mirror the interface the legacy chrome uses: the group-scoped
 * loading/not-found gate reads `staticGroupStore`; the no-tiers gate reads the
 * tier list + its own loading flag from `tierStore` (plus the group store's
 * loading flag, so a static switch never flashes "No Raid Tiers" for a stale,
 * still-populated group — GroupView.tsx:271,382). The error surfaced by
 * branches 2 and 5 is `groupError || tierError` (GroupView.tsx:271-274) — a
 * tier-store failure (failed gear save, rollover, add/remove/reorder player,
 * claim/assign, etc.) raises the same modal legacy does; dismissing it clears
 * both stores (GroupView.tsx:293-297).
 */
import { useCallback, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Check, Copy, Layers, SearchX } from 'lucide-react';
import { Button, Tooltip } from '../components/primitives';
import { CardShell, DiscordIcon, EmptyState, Modal, PageSkeleton } from '../components/ui';
import { DISCORD_BUG_REPORT_URL } from '../config';
import { useStaticGroupStore } from '../stores/staticGroupStore';
import { useTierStore } from '../stores/tierStore';
import { useAuthStore } from '../stores/authStore';
import { useGroupActions } from './groupActionsContext';
import { useStaticPermissions } from '../hooks/useStaticPermissions';

/** Format error details for the copy-to-clipboard block (mirrors GroupView). */
function formatErrorDetails(message: string, stack: string | null): string {
  return [
    `Error: ${message}`,
    `URL: ${window.location.href}`,
    `Timestamp: ${new Date().toISOString()}`,
    stack ? `\nStack Trace:\n${stack}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function ShellContentStates({ children }: { children: ReactNode }): ReactElement {
  const navigate = useNavigate();
  const currentGroup = useStaticGroupStore((s) => s.currentGroup);
  const isLoading = useStaticGroupStore((s) => s.isLoading);
  const groupError = useStaticGroupStore((s) => s.error);
  const groupErrorStack = useStaticGroupStore((s) => s.errorStack);
  const clearGroupError = useStaticGroupStore((s) => s.clearError);
  // Single non-selector read (mirrors legacy GroupView.tsx:108-118) rather than
  // per-field selectors — the error/errorStack/clearError fields are destructured
  // off the one returned state object below.
  const {
    tiers,
    isLoading: tiersLoading,
    error: tierError,
    errorStack: tierErrorStack,
    clearError: clearTierError,
  } = useTierStore();
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const { onNewTier } = useGroupActions();
  const { canEdit } = useStaticPermissions();

  // Fold both stores' errors into one, matching legacy (GroupView.tsx:271-274):
  // group error takes precedence, and the technical-details stack follows
  // whichever error is actually being displayed.
  const error = groupError || tierError;
  const errorStack = error === groupError ? groupErrorStack : tierErrorStack;

  const [errorCopied, setErrorCopied] = useState(false);

  // Reset errorCopied whenever the combined error clears — from any path, not
  // only explicit dismiss (mirrors legacy GroupView.tsx:277-280).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset derived state when error clears
    if (!error) setErrorCopied(false);
  }, [error]);

  const handleCopyError = useCallback(() => {
    if (!error) return;
    navigator.clipboard.writeText(formatErrorDetails(error, errorStack));
    setErrorCopied(true);
    setTimeout(() => setErrorCopied(false), 2000);
  }, [error, errorStack]);

  const handleDismissError = useCallback(() => {
    clearGroupError();
    clearTierError();
    setErrorCopied(false);
  }, [clearGroupError, clearTierError]);

  // ── 1. Loading ──
  if (isLoading && !currentGroup) {
    return (
      <div data-testid="shell-state-loading">
        <PageSkeleton />
      </div>
    );
  }

  // ── 2. Error / private page ──
  if (error && !currentGroup) {
    const isPrivate = error.toLowerCase().includes('private');
    return (
      <div data-testid="shell-state-error" className="mx-auto w-full max-w-2xl p-6">
        <CardShell className="text-center">
          <h2 className={`font-display text-xl mb-2 ${isPrivate ? 'text-accent' : 'text-status-error'}`}>
            {isPrivate ? 'Private Static' : 'Error'}
          </h2>
          <p className="text-text-secondary mb-4">
            {isPrivate ? 'This static is private. Please log in to view it.' : error}
          </p>
          <div className="flex justify-center gap-3">
            {isPrivate && !user && (
              <Button leftIcon={<DiscordIcon className="w-4 h-4" />} onClick={() => login()}>
                Log In with Discord
              </Button>
            )}
            <Button
              variant={isPrivate && !user ? 'secondary' : 'primary'}
              onClick={() => navigate('/profile?tab=statics')}
            >
              Go to My Statics
            </Button>
          </div>
        </CardShell>
      </div>
    );
  }

  // ── 3. Not found ──
  if (!currentGroup) {
    return (
      <div data-testid="shell-state-not-found" className="mx-auto w-full max-w-2xl p-6">
        <EmptyState
          icon={<SearchX className="w-6 h-6" />}
          heading="Group Not Found"
          description="The static group you're looking for doesn't exist."
        />
      </div>
    );
  }

  // ── 4. No tiers ──
  // The `!isLoading` guard mirrors legacy (GroupView.tsx:271,382): on a static
  // switch, `fetchGroupByShareCode` sets the group store's isLoading:true
  // WITHOUT nulling the stale currentGroup, so without this guard a still-
  // populated static would flash "No Raid Tiers" for the roundtrip.
  if (tiers.length === 0 && !tiersLoading && !isLoading) {
    return (
      <div data-testid="shell-state-no-tiers" className="mx-auto w-full max-w-2xl p-6">
        <EmptyState
          icon={<Layers className="w-6 h-6" />}
          heading="No Raid Tiers"
          description="Create your first tier snapshot to start tracking gear progress."
          action={canEdit ? { label: 'Create First Tier', onClick: () => onNewTier() } : undefined}
        />
      </div>
    );
  }

  // ── 5. Otherwise: content, plus an error Modal overlay when a group is loaded
  //    but an error surfaced. Rendered conditionally (not just isOpen-gated) so
  //    the happy path never mounts the Modal. ──
  return (
    <>
      {children}
      {error && currentGroup && (
        <Modal
          isOpen
          onClose={handleDismissError}
          title={
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-status-error" />
              <span className="text-status-error">Error</span>
            </span>
          }
          size="lg"
        >
          <div className="space-y-4">
            {/* Main error message */}
            <p className="text-text-primary text-center text-lg">{error}</p>

            {/* Technical details with label + copy button */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-text-muted uppercase tracking-wide">Technical Details</span>
                <Tooltip content={errorCopied ? 'Copied to clipboard' : 'Copy error details'}>
                  <Button
                    type="button"
                    size="xs"
                    variant="secondary"
                    onClick={handleCopyError}
                    aria-label={errorCopied ? 'Copied to clipboard' : 'Copy error details'}
                    leftIcon={
                      errorCopied ? (
                        <Check className="w-3.5 h-3.5 text-status-success" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )
                    }
                  >
                    {errorCopied ? 'Copied!' : 'Copy'}
                  </Button>
                </Tooltip>
              </div>
              <pre className="bg-surface-elevated border border-border-default rounded-lg p-3 text-xs text-text-muted overflow-x-auto max-h-32">
                <code>{formatErrorDetails(error, errorStack)}</code>
              </pre>
            </div>

            {/* Report Bug link — external, users can also X / Esc to dismiss */}
            <div className="flex justify-center pt-2">
              <a
                href={DISCORD_BUG_REPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-discord hover:bg-discord-hover text-white font-medium rounded transition-colors"
              >
                <DiscordIcon className="w-5 h-5" />
                Report Bug
              </a>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
