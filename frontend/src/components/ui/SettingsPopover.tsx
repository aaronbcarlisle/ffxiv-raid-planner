/**
 * Settings Popover
 *
 * Consolidated actions menu for static group management.
 * Contains: Add Player, New Tier, Rollover, Settings, Delete Tier
 * Uses Radix Dropdown for accessibility.
 */

import { Keyboard, Settings } from 'lucide-react';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
  Tooltip,
  IconButton,
} from '../primitives';

interface PopoverAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  danger?: boolean;
  disabled?: boolean;
  tooltip?: string;
  shortcut?: string;
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
      <Tooltip
        content={
          <div>
            <div className="font-medium">Actions</div>
            <div className="text-text-secondary text-xs mt-0.5">Manage players, tiers, and static settings</div>
          </div>
        }
      >
        <span className="inline-flex">
          <DropdownTrigger asChild>
            <IconButton
              aria-label="Actions menu"
              icon={<Settings className="w-5 h-5" />}
              variant="ghost"
              size="md"
            />
          </DropdownTrigger>
        </span>
      </Tooltip>

      <DropdownContent align="end" className="w-56">
        {items.map(({ action, showSeparator }) => (
          <div key={action.id} title={action.tooltip}>
            {showSeparator && <DropdownSeparator />}
            <DropdownItem
              icon={<span className="w-5 flex-shrink-0">{action.icon}</span>}
              onSelect={action.onClick}
              disabled={action.disabled}
              danger={action.danger}
            >
              <span className="flex-1">{action.label}</span>
              {action.badge && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-surface-interactive text-text-muted">
                  {action.badge}
                </span>
              )}
              {action.shortcut && (
                <Tooltip content={action.shortcut} side="right" delayDuration={100}>
                  <span className="ml-2 text-text-muted hover:text-text-secondary">
                    <Keyboard className="w-3.5 h-3.5" />
                  </span>
                </Tooltip>
              )}
            </DropdownItem>
          </div>
        ))}
      </DropdownContent>
    </Dropdown>
  );
}
