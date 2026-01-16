/**
 * ShareStep - Step 4 of setup wizard
 *
 * Post-creation share page showing the actual invite link.
 * Allows copying the link and navigating to the new static.
 */

import { useState } from 'react';
import { CheckCircle2, Copy, Check, Link2, ExternalLink, Settings } from 'lucide-react';
import { Button } from '../../primitives';
import { ConfirmModal } from '../../ui/ConfirmModal';

interface ShareStepProps {
  inviteLink: string;
  onGoToStatic: () => void;
}

export function ShareStep({ inviteLink, onGoToStatic }: ShareStepProps) {
  const [copied, setCopied] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write failed - silently ignore
    }
  };

  const handleGoToStatic = () => {
    setShowConfirm(true);
  };

  const handleConfirmGoToStatic = () => {
    setShowConfirm(false);
    onGoToStatic();
  };

  return (
    <>
      <div className="space-y-6">
        {/* Success message */}
        <div className="flex flex-col items-center justify-center py-6">
          <div className="w-16 h-16 rounded-full bg-status-success/20 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-10 h-10 text-status-success" />
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Your static is ready!</h2>
          <p className="text-sm text-text-muted text-center max-w-md">
            Share the invite link below with your team members so they can join.
          </p>
        </div>

        {/* Invite link */}
        <div className="bg-surface-elevated rounded-lg border border-border-default p-4">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="w-5 h-5 text-accent" />
            <h3 className="text-sm font-medium text-text-primary">Invite Link</h3>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 px-4 py-2.5 bg-surface-raised border border-border-default rounded-lg overflow-hidden">
              <span className="text-sm text-text-primary font-mono truncate block">{inviteLink}</span>
            </div>
            <Button
              variant="secondary"
              onClick={handleCopy}
              className="flex-shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-text-muted mt-3">
            Members who use this link will join with the <strong>Member</strong> role.
          </p>
        </div>

        {/* Go to Static button */}
        <div className="flex items-center justify-center pt-4">
          <Button
            variant="primary"
            onClick={handleGoToStatic}
            rightIcon={<ExternalLink className="w-4 h-4" />}
          >
            Go to Static
          </Button>
        </div>
      </div>

      {/* Confirmation modal */}
      <ConfirmModal
        isOpen={showConfirm}
        title="Have you copied the invite link?"
        size="lg"
        message={
          <div className="space-y-3">
            <p>Make sure you've copied the invite link before leaving this page.</p>
            <div className="bg-surface-raised rounded-lg p-3 text-sm">
              <p className="text-text-muted mb-2">You can find this link again anytime:</p>
              <div className="flex items-center gap-2 text-text-primary">
                <Settings className="w-4 h-4 text-text-muted" aria-hidden="true" />
                <span>
                  <strong>Settings menu</strong> → <strong>Static Settings</strong> → <strong>Invites</strong> tab
                </span>
              </div>
            </div>
          </div>
        }
        confirmLabel="Yes, go to static"
        cancelLabel="Go back"
        variant="default"
        onConfirm={handleConfirmGoToStatic}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
