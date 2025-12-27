/**
 * Settings Popover
 *
 * Consolidated actions menu for static group management.
 * Contains: Add Player, New Tier, Rollover, Settings, Delete Tier
 */

import { useState, useRef, useEffect } from 'react';

interface PopoverAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

interface SettingsPopoverProps {
  actions: PopoverAction[];
}

export function SettingsPopover({ actions }: SettingsPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded transition-colors ${
          isOpen
            ? 'bg-bg-hover text-text-primary'
            : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
        }`}
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

      {/* Popover menu */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-56 rounded-lg shadow-xl z-50 bg-bg-elevated border border-border-subtle overflow-hidden"
        >
          <div className="p-1">
            {actions.map((action, index) => {
              // Add separator before danger items
              const showSeparator =
                action.danger && index > 0 && !actions[index - 1].danger;

              return (
                <div key={action.id}>
                  {showSeparator && (
                    <hr className="my-1 border-border-subtle" />
                  )}
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      action.onClick();
                    }}
                    disabled={action.disabled}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded transition-colors ${
                      action.disabled
                        ? 'opacity-50 cursor-not-allowed'
                        : action.danger
                          ? 'text-red-400 hover:bg-red-500/10'
                          : 'text-text-primary hover:bg-bg-hover'
                    }`}
                  >
                    <span className="w-5 flex-shrink-0">{action.icon}</span>
                    <span className="flex-1">{action.label}</span>
                    {action.badge && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-bg-hover text-text-muted">
                        {action.badge}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
