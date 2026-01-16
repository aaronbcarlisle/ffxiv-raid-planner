/**
 * RosterSetupStep - Step 2 of setup wizard
 *
 * 8 player slots in a 2x4 grid (responsive: 1 column on mobile).
 * Allows partial completion (not all slots required).
 */

import { useRef, useEffect } from 'react';
import { RosterSlot } from '../RosterSlot';
import type { WizardPlayer } from '../types';

interface RosterSetupStepProps {
  players: WizardPlayer[];
  tierId: string; // For BiS import context
  onPlayersChange: (players: WizardPlayer[]) => void;
  onAllSlotsFilled?: () => void; // Called when all 8 slots have jobs selected
}

export function RosterSetupStep({ players, tierId, onPlayersChange, onAllSlotsFilled }: RosterSetupStepProps) {
  // Refs for each slot's name input (for keyboard navigation)
  const slotRefs = useRef<Array<HTMLInputElement | null>>([null, null, null, null, null, null, null, null]);

  // Track if all slots were previously filled (to detect transition)
  const prevAllFilledRef = useRef(false);

  // Auto-focus first slot's name input when step mounts
  useEffect(() => {
    // Small delay to ensure DOM is ready after step transition
    const timer = setTimeout(() => {
      slotRefs.current[0]?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []); // Empty deps = only on mount

  // Check if all slots have jobs and trigger callback on transition
  useEffect(() => {
    const allFilled = players.every((p) => p.job);
    if (allFilled && !prevAllFilledRef.current) {
      onAllSlotsFilled?.();
    }
    prevAllFilledRef.current = allFilled;
  }, [players, onAllSlotsFilled]);

  const handlePlayerUpdate = (index: number, updates: Partial<WizardPlayer>) => {
    const newPlayers = [...players];
    newPlayers[index] = { ...newPlayers[index], ...updates };
    onPlayersChange(newPlayers);
  };

  const handleFocusNextSlot = (currentIndex: number) => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < 8 && slotRefs.current[nextIndex]) {
      slotRefs.current[nextIndex]?.focus();
    } else if (nextIndex >= 8) {
      // Last slot - focus the Next button directly
      onAllSlotsFilled?.();
    }
  };

  // Group players into pairs for 2-column layout
  const playerPairs = [
    [players[0], players[1]], // T1, T2
    [players[2], players[3]], // H1, H2
    [players[4], players[5]], // M1, M2
    [players[6], players[7]], // R1, R2
  ];

  return (
    <div className="space-y-4">
      {/* Roster grid - 2 columns on desktop, 1 on mobile */}
      {/* Scrollable container with max height to keep nav visible */}
      {/* Padding prevents ring highlights from being clipped by overflow */}
      <div className="space-y-4 max-h-[calc(100vh-22rem)] overflow-y-auto px-1 py-1 -mx-1 -my-1">
        {playerPairs.map((pair, pairIndex) => {
          const [player1, player2] = pair;
          const index1 = pairIndex * 2;
          const index2 = pairIndex * 2 + 1;

          return (
            <div key={pairIndex} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <RosterSlot
                player={player1}
                tierId={tierId}
                slotIndex={index1}
                nameInputRef={(el) => (slotRefs.current[index1] = el)}
                onUpdate={(updates) => handlePlayerUpdate(index1, updates)}
                onFocusNextSlot={() => handleFocusNextSlot(index1)}
              />
              <RosterSlot
                player={player2}
                tierId={tierId}
                slotIndex={index2}
                nameInputRef={(el) => (slotRefs.current[index2] = el)}
                onUpdate={(updates) => handlePlayerUpdate(index2, updates)}
                onFocusNextSlot={() => handleFocusNextSlot(index2)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
