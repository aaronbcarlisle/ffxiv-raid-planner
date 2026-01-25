/**
 * WizardNavigation - Back/Next/Create buttons for wizard
 *
 * Handles validation and navigation between wizard steps.
 * Step 3 = Create Static, Step 4 = Go to Static
 */

import { forwardRef } from 'react';
import { Button } from '../primitives/Button';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import type { WizardStep } from './types';

interface WizardNavigationProps {
  currentStep: WizardStep;
  canProceed: boolean; // Whether current step validation passes
  isSubmitting?: boolean; // True when creating static (step 3)
  isCreated?: boolean; // True after static is created (step 4)
  onBack: () => void;
  onNext: () => void;
  onSubmit?: () => void; // Called on step 3 to create static
  onFinish?: () => void; // Called on step 4 to go to static
}

export const WizardNavigation = forwardRef<HTMLButtonElement, WizardNavigationProps>(
  function WizardNavigation(
    {
      currentStep,
      canProceed,
      isSubmitting = false,
      isCreated = false,
      onBack,
      onNext,
      onSubmit,
      onFinish,
    },
    ref
  ) {
    const isFirstStep = currentStep === 1;
    const isReviewStep = currentStep === 3;
    const isShareStep = currentStep === 4;

    // Determine which action button to show
    const renderActionButton = () => {
      if (isShareStep) {
        // Step 4: Go to Static button
        return (
          <Button
            ref={ref}
            variant="primary"
            onClick={onFinish}
            rightIcon={<ExternalLink className="w-4 h-4" />}
          >
            Go to Static
          </Button>
        );
      }

      if (isReviewStep) {
        // Step 3: Create Static button
        return (
          <Button
            ref={ref}
            variant="primary"
            onClick={onSubmit}
            disabled={!canProceed || isSubmitting}
            loading={isSubmitting}
          >
            {isSubmitting ? 'Creating Static...' : 'Create Static'}
          </Button>
        );
      }

      // Steps 1-2: Next button
      return (
        <Button
          ref={ref}
          variant="primary"
          onClick={onNext}
          disabled={!canProceed}
          rightIcon={<ChevronRight className="w-4 h-4" />}
        >
          Next
        </Button>
      );
    };

    return (
      <div className="flex items-center justify-between pt-6 border-t border-border-default">
        {/* Back button - disabled on first step or after creation */}
        <Button
          variant="secondary"
          onClick={onBack}
          disabled={isFirstStep || isSubmitting || isCreated}
          leftIcon={<ChevronLeft className="w-4 h-4" />}
        >
          Back
        </Button>

        {/* Keyboard shortcut hint - hidden on mobile and share step */}
        {!isShareStep && (
          <span className="hidden sm:inline text-xs text-text-muted">
            <kbd className="px-1.5 py-0.5 bg-surface-elevated rounded text-[10px] font-mono">Alt</kbd>
            {' + '}
            <kbd className="px-1.5 py-0.5 bg-surface-elevated rounded text-[10px] font-mono">←</kbd>
            <kbd className="px-1.5 py-0.5 bg-surface-elevated rounded text-[10px] font-mono">→</kbd>
            <span className="ml-1.5">to navigate</span>
          </span>
        )}

        {/* Action button */}
        {renderActionButton()}
      </div>
    );
  }
);
