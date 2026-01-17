/**
 * SearchableSelect Component
 *
 * A filterable dropdown that allows users to search through options.
 * Useful for large lists like user selection.
 *
 * @example
 * <SearchableSelect
 *   value={userId}
 *   onChange={setUserId}
 *   options={userOptions}
 *   placeholder="Search users..."
 * />
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import type { SelectOption } from './Select';

export interface GroupConfig {
  /** The group name (must match option.group values) */
  name: string;
  /** Optional color for the group header (CSS color value) */
  color?: string;
}

export interface SearchableSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  /** Show a clear button when a value is selected */
  clearable?: boolean;
  /** Custom empty state message */
  emptyMessage?: string;
  /** Order of groups to display with optional colors (options without groups appear first) */
  groupOrder?: (string | GroupConfig)[];
}

export function SearchableSelect({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  disabled,
  className = '',
  clearable = false,
  emptyMessage = 'No results found',
  groupOrder,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter out empty-value options and use as placeholder
  const emptyOption = options.find(opt => opt.value === '');
  const effectivePlaceholder = emptyOption?.label || placeholder;
  const validOptions = options.filter(opt => opt.value !== '');

  // Find selected option
  const selectedOption = validOptions.find(opt => opt.value === value);

  // Filter options based on search (matches label or group name)
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return validOptions;
    const searchLower = search.toLowerCase();
    return validOptions.filter(opt =>
      opt.label.toLowerCase().includes(searchLower) ||
      (opt.group && opt.group.toLowerCase().includes(searchLower))
    );
  }, [validOptions, search]);

  // Normalize groupOrder to always have GroupConfig objects
  const normalizedGroupOrder = useMemo(() => {
    if (!groupOrder) return null;
    return groupOrder.map(g => typeof g === 'string' ? { name: g } : g);
  }, [groupOrder]);

  // Group options by their group property
  const groupedOptions = useMemo(() => {
    if (!normalizedGroupOrder || normalizedGroupOrder.length === 0) {
      // No grouping - return flat list
      return null;
    }

    const groups = new Map<string | undefined, SelectOption[]>();
    const groupConfigs = new Map<string, GroupConfig>();

    // Initialize groups in order
    groups.set(undefined, []); // ungrouped options first
    for (const groupConfig of normalizedGroupOrder) {
      groups.set(groupConfig.name, []);
      groupConfigs.set(groupConfig.name, groupConfig);
    }

    // Distribute options into groups
    for (const opt of filteredOptions) {
      const group = opt.group;
      if (groups.has(group)) {
        groups.get(group)!.push(opt);
      } else {
        // Unknown group - add to ungrouped
        groups.get(undefined)!.push(opt);
      }
    }

    // Convert to array of { group, color, options } for rendering
    const result: { group: string | undefined; color?: string; options: SelectOption[] }[] = [];

    // Add ungrouped first
    const ungrouped = groups.get(undefined)!;
    if (ungrouped.length > 0) {
      result.push({ group: undefined, options: ungrouped });
    }

    // Add grouped in order
    for (const groupConfig of normalizedGroupOrder) {
      const opts = groups.get(groupConfig.name)!;
      if (opts.length > 0) {
        result.push({ group: groupConfig.name, color: groupConfig.color, options: opts });
      }
    }

    return result;
  }, [filteredOptions, normalizedGroupOrder]);

  // Flat list of all options for keyboard navigation (needed for arrow keys)
  const flatFilteredOptions = useMemo(() => {
    if (!groupedOptions) return filteredOptions;
    return groupedOptions.flatMap(g => g.options);
  }, [groupedOptions, filteredOptions]);

  // Handle search change - resets highlighted index when search changes
  const handleSearchChange = useCallback((newSearch: string) => {
    setSearch(newSearch);
    setHighlightedIndex(0);
  }, []);

  // Calculate dropdown position relative to viewport
  const updateDropdownPosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4, // 4px gap
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  // Update position when opening or on scroll/resize
  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();

      const handleScrollOrResize = () => updateDropdownPosition();
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [isOpen, updateDropdownPosition]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-option]');
      const highlightedItem = items[highlightedIndex];
      if (highlightedItem) {
        highlightedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Close on outside click (check both container and portal dropdown)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedInContainer = containerRef.current?.contains(target);
      const clickedInDropdown = dropdownRef.current?.contains(target);
      if (!clickedInContainer && !clickedInDropdown) {
        setIsOpen(false);
        setSearch('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleOpen = () => {
    if (!disabled) {
      setIsOpen(true);
      setSearch('');
      setHighlightedIndex(0);
    }
  };

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < flatFilteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (flatFilteredOptions[highlightedIndex]) {
          handleSelect(flatFilteredOptions[highlightedIndex].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearch('');
        break;
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${id || 'searchable-select'}-listbox` : undefined}
        className={`
          inline-flex items-center justify-between
          w-full
          bg-surface-elevated border border-border-default rounded-lg
          pl-4 pr-3 py-2
          text-sm text-left
          focus-visible:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base
          disabled:opacity-50 disabled:cursor-not-allowed
          hover:border-border-subtle
          transition-colors
        `}
      >
        {selectedOption ? (
          <span className="flex items-center gap-2 truncate flex-1 min-w-0">
            {selectedOption.icon && <span className="flex-shrink-0">{selectedOption.icon}</span>}
            <span className="truncate">{selectedOption.label}</span>
          </span>
        ) : (
          <span className="text-text-muted truncate">{effectivePlaceholder}</span>
        )}
        <span className="flex items-center gap-1 ml-2 flex-shrink-0">
          {clearable && value && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear selection"
              className="p-0.5 rounded hover:bg-surface-interactive text-text-muted hover:text-text-primary"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {/* Dropdown - rendered via portal to escape modal overflow clipping */}
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          id={`${id || 'searchable-select'}-listbox`}
          role="listbox"
          aria-label={placeholder}
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            zIndex: 9999,
          }}
          className="
            bg-surface-raised border border-border-default rounded-lg
            shadow-lg shadow-black/50
            overflow-hidden
          "
        >
          {/* Search input */}
          <div className="p-2 border-b border-border-default">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="
                  w-full pl-8 pr-3 py-1.5
                  bg-surface-base border border-border-default rounded
                  text-sm text-text-primary placeholder:text-text-muted
                  focus:outline-none focus:border-accent
                "
              />
            </div>
          </div>

          {/* Options list */}
          <div ref={listRef} className={`max-h-60 overflow-y-auto ${groupedOptions ? 'pb-1' : 'p-1'}`}>
            {flatFilteredOptions.length === 0 ? (
              <div className="px-3 py-6 text-sm text-text-muted text-center">
                {emptyMessage}
              </div>
            ) : groupedOptions ? (
              // Grouped rendering
              groupedOptions.map((groupData, groupIndex) => {
                // Calculate the starting index for this group in the flat list
                const startIndex = groupedOptions
                  .slice(0, groupIndex)
                  .reduce((acc, g) => acc + g.options.length, 0);

                return (
                  <div key={groupData.group ?? '__ungrouped__'}>
                    {/* Group header */}
                    {groupData.group && (
                      <div
                        className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider sticky top-0 z-10 bg-surface-raised border-b border-border-default"
                        style={groupData.color ? { color: groupData.color } : undefined}
                      >
                        {groupData.group}
                      </div>
                    )}
                    {/* Options in this group */}
                    {groupData.options.map((option, optionIndex) => {
                      const flatIndex = startIndex + optionIndex;
                      const isHighlighted = flatIndex === highlightedIndex;
                      return (
                        <div
                          key={option.value}
                          role="option"
                          aria-selected={option.value === value}
                          data-option
                          onClick={() => handleSelect(option.value)}
                          className={`
                            relative flex items-center
                            px-8 py-2
                            text-sm cursor-pointer select-none
                            ${option.value === value ? 'text-accent' : 'text-text-primary'}
                            hover:bg-white/5
                          `}
                          // Note: color-mix requires Safari 16.2+, Chrome 111+, Firefox 113+
                          // Fallback to rgba for browsers without color-mix or ungrouped options
                          style={isHighlighted && groupData.color ? {
                            backgroundColor: `color-mix(in srgb, ${groupData.color} 15%, transparent)`,
                          } : isHighlighted ? {
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          } : undefined}
                        >
                          {option.value === value && (
                            <span className="absolute left-2">
                              <Check className="w-4 h-4" />
                            </span>
                          )}
                          {option.icon && <span className="mr-2 flex-shrink-0">{option.icon}</span>}
                          <span className="truncate">{option.label}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            ) : (
              // Flat rendering (no groups)
              flatFilteredOptions.map((option, index) => (
                <div
                  key={option.value}
                  role="option"
                  aria-selected={option.value === value}
                  data-option
                  onClick={() => handleSelect(option.value)}
                  className={`
                    relative flex items-center
                    px-8 py-2
                    text-sm cursor-pointer select-none
                    ${option.value === value ? 'text-accent' : 'text-text-primary'}
                    hover:bg-white/5
                  `}
                  style={index === highlightedIndex ? {
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  } : undefined}
                >
                  {option.value === value && (
                    <span className="absolute left-2">
                      <Check className="w-4 h-4" />
                    </span>
                  )}
                  {option.icon && <span className="mr-2 flex-shrink-0">{option.icon}</span>}
                  <span className="truncate">{option.label}</span>
                </div>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default SearchableSelect;
