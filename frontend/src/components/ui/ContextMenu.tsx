/**
 * Context Menu - Right-click menu component
 *
 * Fixed-position menu that appears at cursor location.
 * Uses React Portal to render at document body level, preventing layout shift.
 * Uses design tokens for consistent styling.
 */

import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type ContextMenuItem = {
  label: string;
  icon?: string | ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  accent?: boolean; // Use accent color for positive/important actions
  keepOpen?: boolean; // Don't close menu after clicking
  tooltip?: string; // Tooltip shown on hover (especially useful for disabled items)
  separator?: never;
  sectionHeader?: never;
} | {
  separator: true;
  label?: never;
  icon?: never;
  onClick?: never;
  disabled?: never;
  danger?: never;
  accent?: never;
  keepOpen?: never;
  tooltip?: never;
  sectionHeader?: never;
} | {
  sectionHeader: string;
  label?: never;
  icon?: never;
  onClick?: never;
  disabled?: never;
  danger?: never;
  accent?: never;
  keepOpen?: never;
  tooltip?: never;
  separator?: never;
};

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Get actionable (non-separator, non-sectionHeader, non-disabled) item indices
  const getActionableIndices = useCallback(() => {
    return items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !('separator' in item && item.separator) && !('sectionHeader' in item && item.sectionHeader) && !item.disabled)
      .map(({ index }) => index);
  }, [items]);

  // Navigate to next/previous actionable item
  const navigateItems = useCallback((direction: 'next' | 'prev' | 'first' | 'last') => {
    const actionable = getActionableIndices();
    if (actionable.length === 0) return;

    let newIndex: number;
    const currentActionableIndex = actionable.indexOf(focusedIndex);

    if (direction === 'first') {
      newIndex = actionable[0];
    } else if (direction === 'last') {
      newIndex = actionable[actionable.length - 1];
    } else if (direction === 'next') {
      if (currentActionableIndex === -1 || currentActionableIndex === actionable.length - 1) {
        newIndex = actionable[0]; // Wrap to first
      } else {
        newIndex = actionable[currentActionableIndex + 1];
      }
    } else {
      if (currentActionableIndex === -1 || currentActionableIndex === 0) {
        newIndex = actionable[actionable.length - 1]; // Wrap to last
      } else {
        newIndex = actionable[currentActionableIndex - 1];
      }
    }

    setFocusedIndex(newIndex);
    itemRefs.current[newIndex]?.focus();
  }, [focusedIndex, getActionableIndices]);

  // Handle keyboard events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        onClose();
        break;
      case 'ArrowDown':
        event.preventDefault();
        navigateItems('next');
        break;
      case 'ArrowUp':
        event.preventDefault();
        navigateItems('prev');
        break;
      case 'Home':
        event.preventDefault();
        navigateItems('first');
        break;
      case 'End':
        event.preventDefault();
        navigateItems('last');
        break;
    }
  }, [onClose, navigateItems]);

  // Close on click outside, scroll, or resize
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleScrollOrResize() {
      onClose();
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, { capture: true, passive: true });
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, { capture: true });
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [onClose, handleKeyDown]);

  // Focus first actionable item on mount for accessibility (standard menu behavior)
  useEffect(() => {
    const actionable = getActionableIndices();
    if (actionable.length > 0) {
      const firstIndex = actionable[0];
      setFocusedIndex(firstIndex);
      // Delay focus to allow menu to render and position
      requestAnimationFrame(() => {
        itemRefs.current[firstIndex]?.focus();
      });
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Adjust position if menu would go off screen
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (rect.right > viewportWidth) {
        menuRef.current.style.left = `${x - rect.width}px`;
      }
      if (rect.bottom > viewportHeight) {
        menuRef.current.style.top = `${y - rect.height}px`;
      }
    }
  }, [x, y]);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-orientation="vertical"
      className="fixed z-50 bg-surface-overlay border border-border-default rounded-lg shadow-xl py-1 min-w-40
                 animate-in fade-in-0 zoom-in-95"
      style={{ left: x, top: y }}
    >
      {items.map((item, index) => {
        // Render separator
        if ('separator' in item && item.separator) {
          return (
            <div
              key={index}
              role="separator"
              className="my-1 border-t border-border-default"
            />
          );
        }

        // Render section header
        if ('sectionHeader' in item && item.sectionHeader) {
          return (
            <div
              key={index}
              className="px-4 pt-2 pb-1 text-xs font-medium text-text-muted uppercase tracking-wide"
            >
              {item.sectionHeader}
            </div>
          );
        }

        // Render menu item
        return (
          <button
            key={index}
            ref={(el) => { itemRefs.current[index] = el; }}
            role="menuitem"
            onClick={() => {
              if (!item.disabled && item.onClick) {
                item.onClick();
                if (!item.keepOpen) {
                  onClose();
                }
              }
            }}
            onFocus={() => setFocusedIndex(index)}
            disabled={item.disabled}
            title={item.tooltip}
            tabIndex={focusedIndex === index ? 0 : -1}
            className={`
              w-full px-4 py-2 text-left text-sm flex items-center gap-3 transition-colors
              focus:outline-none
              ${item.disabled ? 'text-text-muted cursor-not-allowed' : ''}
              ${item.danger && !item.disabled ? 'text-status-error hover:bg-status-error/10 focus:bg-status-error/10' : ''}
              ${item.accent && !item.disabled ? 'text-accent hover:bg-accent/10 focus:bg-accent/10' : ''}
              ${!item.disabled && !item.danger && !item.accent ? 'text-text-primary hover:bg-surface-interactive focus:bg-surface-interactive' : ''}
            `}
          >
            {item.icon && (
              typeof item.icon === 'string' ? (
                item.icon.startsWith('http') || item.icon.startsWith('/') ? (
                  <img
                    src={item.icon}
                    alt=""
                    width={20}
                    height={20}
                    className={item.disabled ? 'grayscale opacity-50' : ''}
                  />
                ) : (
                  <span className={item.disabled ? 'grayscale opacity-50' : ''}>{item.icon}</span>
                )
              ) : (
                <span className={`flex items-center justify-center w-5 h-5 ${item.disabled ? 'grayscale opacity-50' : ''}`}>{item.icon}</span>
              )
            )}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>,
    document.body
  );
}
