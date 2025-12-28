import { useEffect, useRef } from 'react';
import type { RaidPosition } from '../../types';
import { RAID_POSITIONS } from '../../types';

interface PositionSelectorProps {
  position: RaidPosition | null | undefined;
  role: string;
  onSelect: (position: RaidPosition | undefined) => void;
  onClose: () => void;
}

// Get suggested positions based on role
function getSuggestedPositions(role: string): RaidPosition[] {
  switch (role) {
    case 'tank':
      return ['T1', 'T2'];
    case 'healer':
      return ['H1', 'H2'];
    case 'melee':
      return ['M1', 'M2'];
    case 'ranged':
    case 'caster':
      return ['R1', 'R2'];
    default:
      return [];
  }
}

function getPositionBgClasses(pos: RaidPosition, isSelected: boolean, isSuggested: boolean): string {
  if (isSelected) {
    if (pos.startsWith('T')) return 'bg-role-tank text-white';
    if (pos.startsWith('H')) return 'bg-role-healer text-white';
    return 'bg-role-melee text-white';
  }
  if (isSuggested) {
    if (pos.startsWith('T')) return 'bg-role-tank/20 text-role-tank hover:bg-role-tank/30';
    if (pos.startsWith('H')) return 'bg-role-healer/20 text-role-healer hover:bg-role-healer/30';
    return 'bg-role-melee/20 text-role-melee hover:bg-role-melee/30';
  }
  return 'bg-bg-primary text-text-muted hover:bg-bg-hover hover:text-text-secondary';
}

export function PositionSelector({
  position,
  role,
  onSelect,
  onClose,
}: PositionSelectorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const suggested = getSuggestedPositions(role);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 top-full left-0 mt-1 bg-bg-secondary border border-border-default rounded-lg shadow-lg p-2 min-w-[140px]"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 4x2 grid of positions */}
      <div className="grid grid-cols-4 gap-1 w-max">
        {RAID_POSITIONS.map((pos) => {
          const isSelected = position === pos;
          const isSuggested = suggested.includes(pos);

          return (
            <button
              key={pos}
              onClick={() => {
                onSelect(pos);
                onClose();
              }}
              className={`
                px-2 py-1.5 rounded text-xs font-bold transition-colors
                ${getPositionBgClasses(pos, isSelected, isSuggested)}
              `}
              title={isSuggested ? `Suggested for ${role}` : undefined}
            >
              {pos}
            </button>
          );
        })}
      </div>

      {/* Clear button */}
      {position && (
        <button
          onClick={() => {
            onSelect(undefined);
            onClose();
          }}
          className="w-full mt-2 px-2 py-1 rounded text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}
