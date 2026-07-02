/**
 * Log Floating Actions
 *
 * Floating action buttons for Log Loot and Log Material on mobile.
 * Positioned above the bottom navigation for easy thumb access.
 * Horizontal layout with Material on left, Loot on right, both accent colored.
 */

import { XivIcon } from '../ui/XivIcon';

interface LogFloatingActionsProps {
  onLogLoot: () => void;
  onLogMaterial: () => void;
  visible: boolean;
}

export function LogFloatingActions({ onLogLoot, onLogMaterial, visible }: LogFloatingActionsProps) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-[4.5rem] right-4 flex flex-row gap-2 z-30 md:hidden backdrop-blur-md bg-black/40 rounded-full p-1.5">
      {/* design-system-ignore: FAB requires specific circular styling not available in IconButton */}
      <button
        onClick={onLogMaterial}
        className="w-12 h-12 rounded-full bg-accent shadow-xl shadow-black/50 ring-1 ring-white/10 flex items-center justify-center text-accent-contrast active:scale-95 transition-transform"
        aria-label="Log Material"
      >
        <XivIcon name="materia" size={20} />
      </button>
      {/* design-system-ignore: FAB requires specific circular styling not available in IconButton */}
      <button
        onClick={onLogLoot}
        className="w-12 h-12 rounded-full bg-accent shadow-xl shadow-black/50 ring-1 ring-white/10 flex items-center justify-center text-accent-contrast active:scale-95 transition-transform"
        aria-label="Log Loot"
      >
        <XivIcon name="loot" size={20} />
      </button>
    </div>
  );
}
