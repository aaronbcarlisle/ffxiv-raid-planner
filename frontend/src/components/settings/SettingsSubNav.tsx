/* eslint-disable design-system/no-raw-button */
/**
 * SettingsSubNav
 *
 * Shared sub-navigation for the settings panel tabs (Priority, Goals & Farms,
 * Recruitment). Using one component guarantees every tab's sub-tabs share the
 * exact same pill styling and sit in the same position, so switching settings
 * tabs no longer nudges the sub-nav around.
 */

import { Tooltip } from '../primitives';

export interface SettingsSubNavItem<T extends string> {
  id: T;
  label: string;
  /** Disable the item (non-interactive, muted). */
  disabled?: boolean;
  /** Hover tooltip. */
  tooltip?: string;
  /** Optional count badge (e.g. pending requests). */
  badge?: number;
}

interface SettingsSubNavProps<T extends string> {
  items: SettingsSubNavItem<T>[];
  active: T;
  onChange: (id: T) => void;
}

export function SettingsSubNav<T extends string>({ items, active, onChange }: SettingsSubNavProps<T>) {
  return (
    <div
      className="flex-shrink-0 flex items-center gap-1 mb-4 w-fit max-w-full bg-surface-raised rounded-lg p-0.5 border border-surface-overlay overflow-x-auto scrollbar-none"
      role="tablist"
    >
      {items.map((item) => {
        const button = (
          <button
            type="button"
            role="tab"
            aria-selected={active === item.id}
            disabled={item.disabled}
            onClick={() => !item.disabled && onChange(item.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors font-medium whitespace-nowrap ${
              item.disabled
                ? 'text-text-disabled cursor-not-allowed'
                : active === item.id
                  ? 'bg-accent/20 text-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'
            }`}
          >
            {item.label}
            {item.badge != null && item.badge > 0 && (
              <span className="inline-flex items-center justify-center min-w-[15px] h-[15px] px-0.5 text-[9px] font-bold rounded-full bg-accent text-accent-contrast">
                {item.badge > 9 ? '9+' : item.badge}
              </span>
            )}
          </button>
        );
        return item.tooltip ? (
          <Tooltip key={item.id} content={item.tooltip}>
            {button}
          </Tooltip>
        ) : (
          <span key={item.id} className="contents">
            {button}
          </span>
        );
      })}
    </div>
  );
}
