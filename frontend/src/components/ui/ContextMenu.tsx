import { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  label: string;
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  keepOpen?: boolean; // Don't close menu after clicking
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside or escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

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

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-bg-secondary border border-border-default rounded-lg shadow-lg py-1 min-w-40"
      style={{ left: x, top: y }}
    >
      {items.map((item, index) => (
        <button
          key={index}
          onClick={() => {
            if (!item.disabled) {
              item.onClick();
              if (!item.keepOpen) {
                onClose();
              }
            }
          }}
          disabled={item.disabled}
          className={`
            w-full px-4 py-2 text-left text-sm flex items-center gap-3 transition-colors
            ${item.disabled ? 'text-text-muted cursor-not-allowed' : ''}
            ${item.danger && !item.disabled ? 'text-status-error hover:bg-status-error/10' : ''}
            ${!item.disabled && !item.danger ? 'text-text-primary hover:bg-bg-hover' : ''}
          `}
        >
          {item.icon && (
            item.icon.startsWith('http') || item.icon.startsWith('/') ? (
              <img
                src={item.icon}
                alt=""
                width={20}
                height={20}
              />
            ) : (
              <span>{item.icon}</span>
            )
          )}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
