/**
 * Settings Popover
 *
 * Consolidated actions menu for static group management.
 * Contains: Add Player, New Tier, Rollover, Settings, Delete Tier
 * Uses Radix Dropdown for accessibility.
 */

import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
} from '../primitives';

interface PopoverAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  danger?: boolean;
  disabled?: boolean;
  tooltip?: string;
  onClick: () => void;
}

interface SettingsPopoverProps {
  actions: PopoverAction[];
}

export function SettingsPopover({ actions }: SettingsPopoverProps) {
  // Group actions to add separator before danger items
  const items = actions.map((action, index) => ({
    action,
    showSeparator: action.danger && index > 0 && !actions[index - 1].danger,
  }));

  return (
    <Dropdown>
      <DropdownTrigger>
        <button
          className="p-2 rounded transition-colors text-text-secondary hover:bg-surface-interactive hover:text-text-primary"
          title="Actions"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </DropdownTrigger>

      <DropdownContent align="end" className="w-56">
        {items.map(({ action, showSeparator }) => (
          <div key={action.id}>
            {showSeparator && <DropdownSeparator />}
            <DropdownItem
              icon={<span className="w-5 flex-shrink-0">{action.icon}</span>}
              onSelect={action.onClick}
              disabled={action.disabled}
              title={action.tooltip}
              className={action.danger ? 'text-status-error focus:text-status-error' : ''}
            >
              <span className="flex-1">{action.label}</span>
              {action.badge && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-surface-interactive text-text-muted">
                  {action.badge}
                </span>
              )}
            </DropdownItem>
          </div>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}
