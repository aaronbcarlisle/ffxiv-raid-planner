/**
 * WizardNavigation - Back/Next/Create buttons for wizard
 *
 * Handles validation and navigation between wizard steps.
 */

import { Button } from '../primitives/Button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { WizardStep } from './types';

interface WizardNavigationProps {
  currentStep: WizardStep;
  canProceed: boolean; // Whether current step validation passes
  isSubmitting?: boolean; // True when creating static (step 4)
  onBack: () => void;
  onNext: () => void;
  onSubmit?: () => void; // Called on step 4 instead of onNext
}

export function WizardNavigation({
  currentStep,
  canProceed,
  isSubmitting = false,
  onBack,
  onNext,
  onSubmit,
}: WizardNavigationProps) {
  const isFirstStep = currentStep === 1;
  const isFinalStep = currentStep === 4;

  return (
    <div className="flex items-center justify-between pt-6 border-t border-border-default">
      {/* Back button */}
      <Button
        variant="secondary"
        onClick={onBack}
        disabled={isFirstStep || isSubmitting}
        leftIcon={<ChevronLeft className="w-4 h-4" />}
      >
        Back
      </Button>

      {/* Next or Create button */}
      {isFinalStep ? (
        <Button
          variant="primary"
          onClick={onSubmit}
          disabled={!canProceed || isSubmitting}
          loading={isSubmitting}
        >
          {isSubmitting ? 'Creating Static...' : 'Create Static'}
        </Button>
      ) : (
        <Button
          variant="primary"
          onClick={onNext}
          disabled={!canProceed}
          rightIcon={<ChevronRight className="w-4 h-4" />}
        >
          Next
        </Button>
      )}
    </div>
  );
}
