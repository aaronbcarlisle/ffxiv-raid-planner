/* eslint-disable design-system/no-raw-button */
/**
 * Tabs — an **in-surface view switch only**. It deliberately has no `href`/route
 * API, so tabs can never masquerade as navigation; switching routes must use a
 * `LinkText`/`NavRow`/`Link`. Controlled via `value`/`onChange` — wire it to
 * `useUrlTabState` at the call site for deep-linkable, back/forward-friendly tabs.
 */
import type { ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  'aria-label'?: string;
}

export function Tabs({ tabs, value, onChange, className = '', 'aria-label': ariaLabel }: TabsProps) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={`flex items-center gap-1 ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? 'bg-accent/15 text-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.04]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
