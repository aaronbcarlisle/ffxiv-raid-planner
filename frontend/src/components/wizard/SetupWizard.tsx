/**
 * SetupWizard - Main wizard orchestrator for static creation
 *
 * 4-step guided flow: Details → Roster → Review → Share
 * Static is created at step 3 (Review), step 4 (Share) shows the actual invite link.
 * Uses local state (not Zustand) - state discarded on cancel.
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wand2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { ConfirmModal } from '../ui/ConfirmModal';
import { WizardProgress } from './WizardProgress';
import { WizardNavigation } from './WizardNavigation';
import { StaticDetailsStep } from './steps/StaticDetailsStep';
import { RosterSetupStep } from './steps/RosterSetupStep';
import { ReviewStep } from './steps/ReviewStep';
import { ShareStep } from './steps/ShareStep';
import { INITIAL_ROSTER, type WizardState, type WizardStep } from './types';
import { RAID_TIERS } from '../../gamedata/raid-tiers';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { useTierStore } from '../../stores/tierStore';
import { useInvitationStore } from '../../stores/invitationStore';
import { getJobInfo } from '../../gamedata';

interface SetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (groupId: string, shareCode: string) => void;
}

const getInitialState = (): WizardState => ({
  step: 1,
  staticName: '',
  tierId: RAID_TIERS[0]?.id || '',
  isPublic: false,
  players: INITIAL_ROSTER,
  inviteCode: null,
});

export function SetupWizard({ isOpen, onClose, onComplete }: SetupWizardProps) {
  const navigate = useNavigate();
  const [state, setState] = useState<WizardState>(getInitialState());

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const nextButtonRef = useRef<HTMLButtonElement>(null);

  // Post-creation state
  const [isCreated, setIsCreated] = useState(false);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [createdShareCode, setCreatedShareCode] = useState<string | null>(null);
  const [createdInviteLink, setCreatedInviteLink] = useState<string | null>(null);

  // Partial completion tracking - allows retry to resume from where it failed
  // Only track groupId since that's the main source of duplicates; tier/player creation is idempotent
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);
  const [pendingShareCode, setPendingShareCode] = useState<string | null>(null);

  // Stores
  const createGroup = useStaticGroupStore((s) => s.createGroup);
  const createTier = useTierStore((s) => s.createTier);
  const updatePlayer = useTierStore((s) => s.updatePlayer);
  const createInvitation = useInvitationStore((s) => s.createInvitation);

  // Check if wizard has unsaved changes (only relevant before creation)
  const hasChanges = () => {
    if (isCreated) return false; // No unsaved changes after creation
    const initial = getInitialState();
    return (
      state.staticName.trim() !== '' ||
      state.tierId !== initial.tierId ||
      state.isPublic !== initial.isPublic ||
      state.players.some((p) => p.name.trim() !== '' || p.job !== '')
    );
  };

  // Focus the Next button (called when last roster slot is filled)
  const focusNextButton = () => {
    nextButtonRef.current?.focus();
  };

  // Validation for each step
  const canProceedFromStep = (step: WizardStep): boolean => {
    switch (step) {
      case 1:
        return state.staticName.trim().length > 0 && state.tierId.length > 0;
      case 2:
        return true;
      case 3:
        return true;
      case 4:
        return state.staticName.trim().length > 0 && state.tierId.length > 0;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (canProceedFromStep(state.step) && state.step < 4) {
      setState((prev) => ({ ...prev, step: (prev.step + 1) as WizardStep }));
    }
  };

  const handleBack = () => {
    if (state.step > 1) {
      setState((prev) => ({ ...prev, step: (prev.step - 1) as WizardStep }));
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Step 1: Create the static group (or reuse if already created on a previous attempt)
      // This prevents duplicate groups when retrying after partial failure
      let groupId = pendingGroupId;
      let shareCode = pendingShareCode;
      if (!groupId) {
        const group = await createGroup(state.staticName.trim(), state.isPublic);
        groupId = group.id;
        shareCode = group.shareCode;
        // Store immediately so retry can resume from here
        setPendingGroupId(groupId);
        setPendingShareCode(shareCode);
      } else if (!shareCode) {
        // Defensive check: groupId and shareCode are set atomically (lines 128-129), so this
        // should be unreachable under normal operation. However, it could occur if:
        // - React state updates are lost due to a browser bug or extension interference
        // - State was manually corrupted (e.g., React DevTools manipulation)
        // Throwing an error prompts the user to retry, which will create a fresh group.
        throw new Error('Inconsistent state: group created but share code missing. Please try again.');
      }

      // Step 2: Create the tier
      // Note: createTier is idempotent - calling it again for same tierId returns existing tier
      const tier = await createTier(groupId, state.tierId);

      // Step 3: Update players with names/jobs/BiS data
      // Player updates are idempotent, so re-running on retry is safe
      // Use Promise.all for parallel execution since updates are independent
      const tierPlayers = tier.players;
      if (tierPlayers && tierPlayers.length > 0) {
        const updatePromises: Promise<void>[] = [];

        for (const wizardPlayer of state.players) {
          // Find matching tier player by position
          const tierPlayer = tierPlayers.find((p) => p.position === wizardPlayer.position);
          if (!tierPlayer) continue;

          // Only update if there's something to update
          if (wizardPlayer.name.trim() || wizardPlayer.job || wizardPlayer.bisLink || wizardPlayer.gear) {
            const jobInfo = wizardPlayer.job ? getJobInfo(wizardPlayer.job) : null;

            updatePromises.push(
              updatePlayer(groupId, tier.tierId, tierPlayer.id, {
                name: wizardPlayer.name.trim() || tierPlayer.name,
                job: wizardPlayer.job || tierPlayer.job,
                role: jobInfo?.role || wizardPlayer.role || tierPlayer.role,
                bisLink: wizardPlayer.bisLink,
                gear: wizardPlayer.gear,
                configured: !!(wizardPlayer.name.trim() && wizardPlayer.job),
              })
            );
          }
        }

        await Promise.all(updatePromises);
      }

      // Step 4: Always create a member invite for sharing
      const invitation = await createInvitation(groupId, { role: 'member' });
      const inviteLink = `${window.location.origin}/invite/${invitation.inviteCode}`;

      // Store results and advance to step 4
      setCreatedGroupId(groupId);
      setCreatedShareCode(shareCode);
      setCreatedInviteLink(inviteLink);
      setIsCreated(true);
      // Clear pending state since we completed successfully
      setPendingGroupId(null);
      setPendingShareCode(null);
      setState((prev) => ({ ...prev, step: 4 }));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to create static');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle finishing the wizard (after creation)
  const handleFinish = () => {
    if (onComplete && createdGroupId && createdShareCode) {
      onComplete(createdGroupId, createdShareCode);
    } else if (createdShareCode) {
      navigate(`/group/${createdShareCode}`);
    }

    onClose();
    resetWizard();
  };

  const resetWizard = () => {
    setState(getInitialState());
    setSubmitError(null);
    setIsCreated(false);
    setCreatedGroupId(null);
    setCreatedShareCode(null);
    setCreatedInviteLink(null);
    // Clear partial completion state to prevent interference with future wizard sessions
    setPendingGroupId(null);
    setPendingShareCode(null);
  };

  const handleClose = () => {
    // Prevent closing while submission is in progress to avoid orphaned resources
    if (isSubmitting) {
      return;
    }
    // Show confirmation if there are unsaved changes
    if (hasChanges()) {
      setShowCancelConfirm(true);
    } else {
      onClose();
      // Reset state after modal closes
      setTimeout(resetWizard, 300);
    }
  };

  const handleConfirmCancel = () => {
    setShowCancelConfirm(false);
    onClose();
    setTimeout(resetWizard, 300);
  };

  // Keyboard navigation: Alt+Left = Back, Alt+Right = Next
  // Disabled after creation (isCreated) to prevent going back
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        // Disable going back after creation
        if (isCreated) return;
        setState((prev) => (prev.step > 1 ? { ...prev, step: (prev.step - 1) as WizardStep } : prev));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        // Disable navigation on step 4 (share step)
        if (isCreated) return;
        setState((prev) => {
          const canProceed =
            prev.step === 1
              ? prev.staticName.trim().length > 0 && prev.tierId.length > 0
              : prev.step < 3; // Stop at step 3 (review), submit advances to step 4
          if (canProceed && prev.step < 3) {
            return { ...prev, step: (prev.step + 1) as WizardStep };
          }
          return prev;
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isCreated]);

  // Modal title includes static name once set
  const modalTitle = (
    <span className="flex items-center gap-2">
      <Wand2 className="w-5 h-5 text-accent" />
      {state.staticName.trim() ? `Create Static: ${state.staticName.trim()}` : 'Create Static'}
    </span>
  );

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} title={modalTitle} size="4xl">
        <div className="space-y-6">
          {/* Progress indicator */}
          <WizardProgress currentStep={state.step} />

          {/* Step content */}
          {state.step === 1 && (
            <StaticDetailsStep
              staticName={state.staticName}
              tierId={state.tierId}
              isPublic={state.isPublic}
              onStaticNameChange={(name) => setState((prev) => ({ ...prev, staticName: name }))}
              onTierIdChange={(tierId) => setState((prev) => ({ ...prev, tierId }))}
              onIsPublicChange={(isPublic) => setState((prev) => ({ ...prev, isPublic }))}
            />
          )}

          {state.step === 2 && (
            <RosterSetupStep
              players={state.players}
              tierId={state.tierId}
              onPlayersChange={(players) => setState((prev) => ({ ...prev, players }))}
              onAllSlotsFilled={focusNextButton}
            />
          )}

          {state.step === 3 && (
            <ReviewStep
              staticName={state.staticName}
              tierId={state.tierId}
              isPublic={state.isPublic}
              players={state.players}
              isSubmitting={isSubmitting}
              error={submitError}
              onRetry={handleSubmit}
            />
          )}

          {state.step === 4 && createdInviteLink && (
            <ShareStep
              inviteLink={createdInviteLink}
              onGoToStatic={handleFinish}
            />
          )}

          {/* Navigation - hidden on share step (step 4) */}
          {state.step !== 4 && (
            <WizardNavigation
              ref={nextButtonRef}
              currentStep={state.step}
              canProceed={canProceedFromStep(state.step)}
              isSubmitting={isSubmitting}
              isCreated={isCreated}
              onBack={handleBack}
              onNext={handleNext}
              onSubmit={handleSubmit}
              onFinish={handleFinish}
            />
          )}
        </div>
      </Modal>

      {/* Cancel confirmation */}
      <ConfirmModal
        isOpen={showCancelConfirm}
        title="Discard Changes?"
        message="You have unsaved changes in the wizard. Are you sure you want to discard them?"
        confirmLabel="Discard"
        cancelLabel="Keep Editing"
        variant="warning"
        onConfirm={handleConfirmCancel}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </>
  );
}
