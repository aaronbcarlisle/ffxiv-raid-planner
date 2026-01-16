/**
 * SetupWizard - Main wizard orchestrator for static creation
 *
 * 4-step guided flow: Details → Roster → Invite → Review
 * Uses local state (not Zustand) - state discarded on cancel.
 */

import { useState } from 'react';
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

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Static" size="4xl">
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
