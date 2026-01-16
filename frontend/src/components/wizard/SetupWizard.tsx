/**
 * SetupWizard - Main wizard orchestrator for static creation
 *
 * 4-step guided flow: Details → Roster → Invite → Review
 * Uses local state (not Zustand) - state discarded on cancel.
 */

import { useState, useRef, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { WizardProgress } from './WizardProgress';
import { WizardNavigation } from './WizardNavigation';
import { StaticDetailsStep } from './steps/StaticDetailsStep';
import { RosterSetupStep } from './steps/RosterSetupStep';
import { INITIAL_ROSTER, type WizardState, type WizardStep } from './types';
import { RAID_TIERS } from '../../gamedata/raid-tiers';

interface SetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (groupId: string, shareCode: string) => void;
}

export function SetupWizard({ isOpen, onClose }: SetupWizardProps) {
  const [state, setState] = useState<WizardState>({
    step: 1,
    staticName: '',
    tierId: RAID_TIERS[0]?.id || '', // Default to latest tier
    isPublic: false,
    players: INITIAL_ROSTER,
    inviteCode: null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const nextButtonRef = useRef<HTMLButtonElement>(null);

  // Focus the Next button (called when last roster slot is filled)
  const focusNextButton = () => {
    nextButtonRef.current?.focus();
  };

  // Validation for each step
  const canProceedFromStep = (step: WizardStep): boolean => {
    switch (step) {
      case 1:
        // Step 1: Require name and tier
        return state.staticName.trim().length > 0 && state.tierId.length > 0;
      case 2:
        // Step 2: Always allow (roster is optional)
        return true;
      case 3:
        // Step 3: Always allow (invite is optional)
        return true;
      case 4:
        // Step 4: Can create if step 1 was valid
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
    // Submission flow will be implemented in Session 2
    console.log('Submit wizard:', state);

    // Placeholder for now
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      alert('Wizard submission will be implemented in Session 2');
    }, 1000);
  };

  const handleClose = () => {
    // TODO: Add cancel confirmation in Session 2
    onClose();

    // Reset state after modal closes
    setTimeout(() => {
      setState({
        step: 1,
        staticName: '',
        tierId: RAID_TIERS[0]?.id || '', // Default to latest tier
        isPublic: false,
        players: INITIAL_ROSTER,
        inviteCode: null,
      });
    }, 300);
  };

  // Keyboard navigation: Alt+Left = Back, Alt+Right = Next
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault(); // Prevent browser back
        setState((prev) => (prev.step > 1 ? { ...prev, step: (prev.step - 1) as WizardStep } : prev));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault(); // Prevent browser forward
        setState((prev) => {
          // Check if can proceed from current step
          const canProceed =
            prev.step === 1
              ? prev.staticName.trim().length > 0 && prev.tierId.length > 0
              : prev.step < 4; // Steps 2 & 3 always allow proceeding
          if (canProceed && prev.step < 4) {
            return { ...prev, step: (prev.step + 1) as WizardStep };
          }
          return prev;
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Modal title includes static name once set
  const modalTitle = state.staticName.trim()
    ? `Create Static: ${state.staticName.trim()}`
    : 'Create Static';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={modalTitle} size="4xl">
      <div className="space-y-6">
        {/* Progress indicator */}
        <WizardProgress currentStep={state.step} />

        {/* Step content - each step handles its own scrolling if needed */}
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
          <div className="flex items-center justify-center py-12">
            <p className="text-text-muted">Step 3 (Invite Members) - To be implemented in Session 2</p>
          </div>
        )}

        {state.step === 4 && (
          <div className="flex items-center justify-center py-12">
            <p className="text-text-muted">Step 4 (Review) - To be implemented in Session 2</p>
          </div>
        )}

        {/* Navigation */}
        <WizardNavigation
          ref={nextButtonRef}
          currentStep={state.step}
          canProceed={canProceedFromStep(state.step)}
          isSubmitting={isSubmitting}
          onBack={handleBack}
          onNext={handleNext}
          onSubmit={handleSubmit}
        />
      </div>
    </Modal>
  );
}
