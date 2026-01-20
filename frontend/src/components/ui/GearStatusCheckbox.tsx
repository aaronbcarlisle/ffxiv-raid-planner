/**
 * GearStatusCheckbox - Triple-state checkbox for gear tracking
 *
 * States vary by BiS source:
 * - Raid/Crafted: Missing → Have (2 states)
 * - Tome (base is BiS): Missing → Have (2 states)
 * - Tome (needs aug): Missing → Have (unaugmented) → Augmented (3 states)
 *
 * Visual states:
 * - Empty box = Missing
 * - Half-filled (orange) = Have but needs augmentation
 * - Full checkmark (green) = Complete
 */

import { Check, Minus } from 'lucide-react';
import type { GearSource } from '../../types';
import type { GearState } from '../../utils/calculations';

interface GearStatusCheckboxProps {
  /** Current state of the gear */
  state: GearState;
  /** BiS source type */
  bisSource: GearSource;
  /** Whether augmentation is required for this tome slot */
  requiresAugmentation: boolean;
  /** Callback when state changes */
  onChange: (state: GearState) => void;
  /** Whether the checkbox is disabled */
  disabled?: boolean;
  /** Tooltip content for disabled state */
  disabledTooltip?: string;
}

/**
 * Get the next state in the cycle based on current state and BiS source
 */
function getNextState(
  currentState: GearState,
  bisSource: GearSource,
  requiresAug: boolean
): GearState {
  // Raid, Crafted, and Base Tome: 2-state cycle (missing → have → missing)
  // These sources never require augmentation
  if (bisSource === 'raid' || bisSource === 'crafted' || bisSource === 'base_tome') {
    return currentState === 'missing' ? 'have' : 'missing';
  }

  // Tome where base is BiS (no aug needed): 2-state cycle
  // This is for backward compatibility with 'tome' bisSource that doesn't need augmentation
  if (bisSource === 'tome' && !requiresAug) {
    return currentState === 'missing' ? 'have' : 'missing';
  }

  // Tome where augmentation is needed: 3-state cycle
  // missing → have → augmented → missing
  if (currentState === 'missing') return 'have';
  if (currentState === 'have') return 'augmented';
  return 'missing';
}

/**
 * Get visual properties for the current state
 */
function getStateVisuals(state: GearState, bisSource: GearSource, requiresAug: boolean) {
  if (state === 'missing') {
    return {
      bgClass: 'bg-surface-elevated border-border-default',
      icon: null,
      ariaLabel: 'Missing',
    };
  }

  if (state === 'have') {
    // If tome and needs aug, show partial state
    if (bisSource === 'tome' && requiresAug) {
      return {
        bgClass: 'bg-status-warning/80 border-status-warning',
        icon: <Minus className="w-3 h-3 text-white" strokeWidth={3} />,
        ariaLabel: 'Have (needs augmentation)',
      };
    }
    // Otherwise show complete
    return {
      bgClass: 'bg-status-success border-status-success',
      icon: <Check className="w-3 h-3 text-white" strokeWidth={3} />,
      ariaLabel: 'Complete',
    };
  }

  // Augmented state
  return {
    bgClass: 'bg-status-success border-status-success',
    icon: <Check className="w-3 h-3 text-white" strokeWidth={3} />,
    ariaLabel: 'Augmented (complete)',
  };
}

export function GearStatusCheckbox({
  state,
  bisSource,
  requiresAugmentation: requiresAug,
  onChange,
  disabled = false,
}: GearStatusCheckboxProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      onChange(getNextState(state, bisSource, requiresAug));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!disabled) {
        onChange(getNextState(state, bisSource, requiresAug));
      }
    }
  };

  const visuals = getStateVisuals(state, bisSource, requiresAug);

  return (
    <div
      role="checkbox"
      aria-checked={state === 'augmented' ? true : state === 'have' ? 'mixed' : false}
      aria-disabled={disabled}
      aria-label={visuals.ariaLabel}
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`
        w-4 h-4 rounded flex items-center justify-center
        border transition-colors
        ${visuals.bgClass}
        ${disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'cursor-pointer hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-0'
        }
      `}
    >
      {visuals.icon}
    </div>
  );
}
