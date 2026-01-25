/**
 * WizardProgress - Step indicator for setup wizard
 *
 * Shows 4 steps with labels and visual indicators for active/completed states.
 */

import { STEP_TITLES, type WizardStep } from './types';

interface WizardProgressProps {
  currentStep: WizardStep;
}

export function WizardProgress({ currentStep }: WizardProgressProps) {
  const steps: WizardStep[] = [1, 2, 3, 4];

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-8 mb-4 sm:mb-8">
      {steps.map((step, index) => {
        const isActive = step === currentStep;
        const isCompleted = step < currentStep;
        const isLast = index === steps.length - 1;

        return (
          <div key={step} className="flex items-center gap-1 sm:gap-2">
            <div className="flex flex-col items-center gap-1 sm:gap-2">
              {/* Step circle */}
              <div
                className={`
                  w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm
                  transition-all duration-300
                  ${
                    isCompleted
                      ? 'bg-accent text-accent-contrast'
                      : isActive
                      ? 'bg-accent/30 text-accent ring-2 ring-accent'
                      : 'bg-surface-elevated text-text-muted border border-border-default'
                  }
                `}
              >
                {isCompleted ? (
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  step
                )}
              </div>

              {/* Step label - hidden on mobile, only show for active step */}
              <span
                className={`
                  text-[10px] sm:text-xs font-medium whitespace-nowrap
                  ${isActive ? 'block' : 'hidden sm:block'}
                  ${
                    isActive
                      ? 'text-accent'
                      : isCompleted
                      ? 'text-text-primary'
                      : 'text-text-muted'
                  }
                `}
              >
                {STEP_TITLES[step]}
              </span>
            </div>

            {/* Connector line (not after last step) */}
            {!isLast && (
              <div
                className={`
                  w-4 sm:w-16 h-0.5 transition-all duration-300 -mb-4 sm:-mb-6
                  ${isCompleted ? 'bg-accent' : 'bg-border-default'}
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
