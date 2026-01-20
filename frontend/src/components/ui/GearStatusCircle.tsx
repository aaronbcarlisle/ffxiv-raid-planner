/**
 * GearStatusCircle - Target-style status indicator for gear tracking
 *
 * Visual states:
 * - Missing: Solid gray filled circle (no ring)
 * - Have (needs aug): Colored ring only, no inner fill
 * - Complete: Colored ring + filled inner circle
 *
 * State cycles vary by BiS source:
 * - Raid/Base Tome/Crafted: 2-state (missing ↔ complete)
 * - Tome: 3-state (missing → have → augmented → missing)
 */

import type { GearSource } from '../../types';
import type { GearState } from '../../utils/calculations';

interface GearStatusCircleProps {
  /** Current state of the gear */
  state: GearState;
  /** BiS source type (null for unset) */
  bisSource: GearSource | null;
  /** Whether augmentation is required for this tome slot */
  requiresAugmentation: boolean;
  /** Callback when state changes */
  onChange: (state: GearState) => void;
  /** Whether the circle is disabled */
  disabled?: boolean;
  /** Size of the circle (default: 'md') */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Get the next state in the cycle based on current state and BiS source
 */
function getNextState(
  currentState: GearState,
  bisSource: GearSource | null,
  requiresAug: boolean
): GearState {
  // Unset BiS source - no state changes allowed
  if (!bisSource) {
    return currentState;
  }

  // Raid, Base Tome, and Crafted: 2-state cycle (missing → have → missing)
  if (bisSource === 'raid' || bisSource === 'base_tome' || bisSource === 'crafted') {
    return currentState === 'missing' ? 'have' : 'missing';
  }

  // Tome where base is BiS (no aug needed): 2-state cycle
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
 * Get ring color class based on BiS source
 */
function getRingColor(bisSource: GearSource | null): string {
  if (!bisSource) return 'border-text-muted';
  if (bisSource === 'raid') return 'border-gear-raid';
  if (bisSource === 'tome' || bisSource === 'base_tome') return 'border-gear-tome';
  return 'border-orange-400'; // crafted
}

/**
 * Get fill color class based on BiS source
 */
function getFillColor(bisSource: GearSource | null): string {
  if (!bisSource) return 'bg-text-muted';
  if (bisSource === 'raid') return 'bg-gear-raid';
  if (bisSource === 'tome' || bisSource === 'base_tome') return 'bg-gear-tome';
  return 'bg-orange-400'; // crafted
}

/**
 * Get size classes
 */
function getSizeClasses(size: 'sm' | 'md' | 'lg'): { outer: string; inner: string; border: string } {
  switch (size) {
    case 'sm':
      return { outer: 'w-3 h-3', inner: 'w-1.5 h-1.5', border: 'border' };
    case 'lg':
      return { outer: 'w-5 h-5', inner: 'w-2.5 h-2.5', border: 'border-2' };
    default: // md
      return { outer: 'w-4 h-4', inner: 'w-2 h-2', border: 'border-[1.5px]' };
  }
}

export function GearStatusCircle({
  state,
  bisSource,
  requiresAugmentation: requiresAug,
  onChange,
  disabled = false,
  size = 'md',
}: GearStatusCircleProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && bisSource) {
      onChange(getNextState(state, bisSource, requiresAug));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!disabled && bisSource) {
        onChange(getNextState(state, bisSource, requiresAug));
      }
    }
  };

  const ringColor = getRingColor(bisSource);
  const fillColor = getFillColor(bisSource);
  const sizeClasses = getSizeClasses(size);

  // Determine visual state
  const isMissing = state === 'missing';
  const isComplete = state === 'augmented' || (state === 'have' && (!bisSource || bisSource !== 'tome' || !requiresAug));
  const isPartial = state === 'have' && bisSource === 'tome' && requiresAug;

  // Build aria label
  let ariaLabel = 'Missing';
  if (isComplete) {
    ariaLabel = 'Complete';
  } else if (isPartial) {
    ariaLabel = 'Have (needs augmentation)';
  }

  // If unset, show gray/disabled state
  if (!bisSource) {
    return (
      <div
        role="checkbox"
        aria-checked={false}
        aria-disabled={true}
        aria-label="BiS source not set"
        className={`
          ${sizeClasses.outer} rounded-full
          bg-text-muted/40
          flex items-center justify-center
          opacity-30 cursor-not-allowed
        `}
      />
    );
  }

  // Missing state: solid gray filled circle (no ring)
  if (isMissing) {
    return (
      <div
        role="checkbox"
        aria-checked={false}
        aria-disabled={disabled}
        aria-label={ariaLabel}
        tabIndex={disabled ? -1 : 0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={`
          ${sizeClasses.outer} rounded-full
          bg-text-muted/50
          flex items-center justify-center
          transition-all duration-150
          ${disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'cursor-pointer hover:scale-110 hover:bg-text-muted/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-1'
          }
        `}
      />
    );
  }

  // Have or Complete state: colored ring with optional inner fill
  return (
    <div
      role="checkbox"
      aria-checked={isComplete ? true : 'mixed'}
      aria-disabled={disabled}
      aria-label={ariaLabel}
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`
        ${sizeClasses.outer} rounded-full
        ${sizeClasses.border} ${ringColor}
        bg-transparent
        flex items-center justify-center
        transition-all duration-150
        ${disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'cursor-pointer hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-1'
        }
      `}
    >
      {/* Inner fill circle - only shown when complete (not partial) */}
      {isComplete && (
        <div
          className={`
            ${sizeClasses.inner} rounded-full
            transition-all duration-150
            ${fillColor}
          `}
        />
      )}
    </div>
  );
}
