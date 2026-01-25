/**
 * Log Floating Actions
 *
 * Floating action buttons for Log Loot and Log Material on mobile.
 * Positioned above the bottom navigation for easy thumb access.
 * Horizontal layout with Material on left, Loot on right, both accent colored.
 */

import { Package, Gem } from 'lucide-react';

interface LogFloatingActionsProps {
  onLogLoot: () => void;
  onLogMaterial: () => void;
  visible: boolean;
}

export function LogFloatingActions({ onLogLoot, onLogMaterial, visible }: LogFloatingActionsProps) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-20 right-4 flex flex-row gap-2 z-30 md:hidden">
      {/* design-system-ignore: FAB requires specific circular styling not available in IconButton */}
      <button
        onClick={onLogMaterial}
        className="w-12 h-12 rounded-full bg-accent ring-2 ring-accent/50 shadow-[0_0_20px_rgba(20,184,166,0.4)] flex items-center justify-center text-accent-contrast active:scale-95 transition-transform"
        aria-label="Log Material"
      >
        <Gem className="w-5 h-5" />
      </button>
      {/* design-system-ignore: FAB requires specific circular styling not available in IconButton */}
      <button
        onClick={onLogLoot}
        className="w-12 h-12 rounded-full bg-accent ring-2 ring-accent/50 shadow-[0_0_20px_rgba(20,184,166,0.4)] flex items-center justify-center text-accent-contrast active:scale-95 transition-transform"
        aria-label="Log Loot"
      >
        <Package className="w-5 h-5" />
      </button>
    </div>
  );
}
