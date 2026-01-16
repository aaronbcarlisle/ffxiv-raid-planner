/**
 * ThreeStateCheckbox - Cycling checkbox with three states
 *
 * Used for tome BiS gear to cycle: empty → have → augmented → empty
 *
 * Visual states:
 * - 'none': Empty checkbox (no item)
 * - 'have': Single checkmark (have tome gear)
 * - 'augmented': Double checkmark (augmented tome gear)
 */

/* eslint-disable react-refresh/only-export-components -- Intentionally exports both component and type */

export type ThreeState = 'none' | 'have' | 'augmented';

interface ThreeStateCheckboxProps {
  state: ThreeState;
  onChange: (newState: ThreeState) => void;
  disabled?: boolean;
  title?: string;
}

// Cycle to next state: none → have → augmented → none
function cycleState(current: ThreeState): ThreeState {
  switch (current) {
    case 'none': return 'have';
    case 'have': return 'augmented';
    case 'augmented': return 'none';
  }
}

export function ThreeStateCheckbox({
  state,
  onChange,
  disabled = false,
  title,
}: ThreeStateCheckboxProps) {
  const handleClick = () => {
    if (!disabled) {
      onChange(cycleState(state));
    }
  };

  // Build the visual indicator based on state
  let content: React.ReactNode;
  let bgClass: string;

  switch (state) {
    case 'none':
      content = null;
      bgClass = 'bg-surface-interactive border-border-default';
      break;
    case 'have':
      content = (
        <svg className="w-3 h-3 text-gear-tome" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      );
      bgClass = 'bg-gear-tome/20 border-gear-tome';
      break;
    case 'augmented':
      // Solid teal background with dark checkmark for proper contrast
      content = (
        <svg className="w-3 h-3 text-accent-contrast" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      );
      bgClass = 'bg-gear-tome border-gear-tome';
      break;
  }

  // State labels for accessibility and tooltip
  const stateLabels: Record<ThreeState, string> = {
    none: 'No item',
    have: 'Have tome gear',
    augmented: 'Augmented',
  };

  const nextStateLabels: Record<ThreeState, string> = {
    none: 'Mark as have',
    have: 'Mark as augmented',
    augmented: 'Clear',
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${bgClass} ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:brightness-110'
      }`}
      title={title || `${stateLabels[state]} - Click to ${nextStateLabels[state]}`}
      aria-label={stateLabels[state]}
    >
      {content}
    </button>
  );
}

// Helper to convert hasItem/isAugmented to ThreeState
export function toThreeState(hasItem: boolean, isAugmented: boolean): ThreeState {
  if (!hasItem) return 'none';
  if (isAugmented) return 'augmented';
  return 'have';
}

// Helper to convert ThreeState back to hasItem/isAugmented
export function fromThreeState(state: ThreeState): { hasItem: boolean; isAugmented: boolean } {
  switch (state) {
    case 'none': return { hasItem: false, isAugmented: false };
    case 'have': return { hasItem: true, isAugmented: false };
    case 'augmented': return { hasItem: true, isAugmented: true };
  }
}
