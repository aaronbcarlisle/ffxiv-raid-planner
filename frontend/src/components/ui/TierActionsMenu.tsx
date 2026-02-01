/**
 * Tier Actions Menu
 *
 * Kebab menu (⋮) for tier-specific actions.
 * Contains: New Tier, Copy to New Tier, Delete Tier
 * Uses Radix Dropdown for accessibility.
 */

import { MoreVertical, Keyboard } from 'lucide-react';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
  Tooltip,
  IconButton,
} from '../primitives';

interface TierAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  tooltip?: string;
  shortcut?: string;
  onClick: () => void;
}

interface TierActionsMenuProps {
  actions: TierAction[];
}

export function TierActionsMenu({ actions }: TierActionsMenuProps) {
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
            <div className="font-medium">Tier Actions</div>
            <div className="text-text-secondary text-xs mt-0.5">Create, copy, or delete tiers</div>
          </div>
        }
      >
        <span className="inline-flex">
          <DropdownTrigger asChild>
            <IconButton
              aria-label="Tier actions menu"
              icon={<MoreVertical className="w-5 h-5" />}
              variant="ghost"
              size="md"
            />
          </DropdownTrigger>
        </span>
      </Tooltip>

      <DropdownContent align="end" className="w-52">
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
