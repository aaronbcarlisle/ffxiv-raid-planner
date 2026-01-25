import { Tooltip } from '../primitives/Tooltip';

interface GroupViewToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  disabled?: boolean;
}

export function GroupViewToggle({ enabled, onToggle, disabled = false }: GroupViewToggleProps) {
  return (
    <Tooltip
      content={
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <div>
            <div className="flex items-center gap-2 font-medium">
              {enabled ? 'Switch to Standard View' : 'Enable Light Party View'}
              <kbd className="px-1.5 py-0.5 text-xs bg-surface-base rounded border border-border-default">G</kbd>
            </div>
            <div className="text-text-secondary text-xs mt-0.5">
              {enabled
                ? 'Show all players in a single grid'
                : 'Split roster by G1 (T1/H1/M1/R1) and G2 (T2/H2/M2/R2)'}
            </div>
          </div>
        </div>
      }
    >
      {/* design-system-ignore: Toggle button requires specific styling */}
      <button
        onClick={() => onToggle(!enabled)}
        disabled={disabled}
        className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          enabled
            ? 'bg-accent/20 text-accent border border-accent/50'
            : 'bg-surface-raised border border-border-default text-text-secondary hover:text-text-primary hover:border-accent'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <span>G1/G2</span>
      </button>
    </Tooltip>
  );
}
