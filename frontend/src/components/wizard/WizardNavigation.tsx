/**
 * WizardNavigation - Back/Next/Create buttons for wizard
 *
 * Handles validation and navigation between wizard steps.
 */

import { forwardRef } from 'react';
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

export const WizardNavigation = forwardRef<HTMLButtonElement, WizardNavigationProps>(
  function WizardNavigation(
    {
      currentStep,
      canProceed,
      isSubmitting = false,
      onBack,
      onNext,
      onSubmit,
    },
    ref
  ) {
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

        {/* Keyboard shortcut hint */}
        <span className="text-xs text-text-muted">
          <kbd className="px-1.5 py-0.5 bg-surface-elevated rounded text-[10px] font-mono">Alt</kbd>
          {' + '}
          <kbd className="px-1.5 py-0.5 bg-surface-elevated rounded text-[10px] font-mono">←</kbd>
          <kbd className="px-1.5 py-0.5 bg-surface-elevated rounded text-[10px] font-mono">→</kbd>
          <span className="ml-1.5">to navigate</span>
        </span>

        {/* Next or Create button */}
        {isFinalStep ? (
          <Button
            ref={ref}
            variant="primary"
            onClick={onSubmit}
            disabled={!canProceed || isSubmitting}
            loading={isSubmitting}
          >
            {isSubmitting ? 'Creating Static...' : 'Create Static'}
          </Button>
        ) : (
          <Button
            ref={ref}
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
);
