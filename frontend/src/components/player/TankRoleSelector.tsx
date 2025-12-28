import { useEffect, useRef } from 'react';
import type { TankRole } from '../../types';

interface TankRoleSelectorProps {
  tankRole: TankRole | null | undefined;
  onSelect: (role: TankRole | undefined) => void;
  onClose: () => void;
}

export function TankRoleSelector({
  tankRole,
  onSelect,
  onClose,
}: TankRoleSelectorProps) {
  const ref = useRef<HTMLDivElement>(null);

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

  const roles: TankRole[] = ['MT', 'OT'];

  return (
    <div
      ref={ref}
      className="absolute z-50 top-full left-0 mt-1 bg-bg-secondary border border-border-default rounded-lg shadow-lg p-2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex gap-1">
        {roles.map((role) => {
          const isSelected = tankRole === role;

          return (
            <button
              key={role}
              onClick={() => {
                onSelect(role);
                onClose();
              }}
              className={`
                px-3 py-1.5 rounded text-xs font-bold transition-colors
                ${isSelected
                  ? 'bg-accent text-bg-primary'
                  : 'bg-bg-primary text-text-muted hover:bg-bg-hover hover:text-text-secondary'
                }
              `}
            >
              {role}
            </button>
          );
        })}
      </div>

      {/* Clear button */}
      {tankRole && (
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
