/**
 * Reusable sortable table header for admin tables.
 *
 * Shows sort direction indicator (chevron) on the active column,
 * and a ghost indicator on hover for inactive columns.
 */

import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import type { SortDirection } from './sortUtils';

interface SortableHeaderProps<T extends string> {
  field: T;
  label: string;
  currentField: T;
  currentDirection: SortDirection;
  onSort: (field: T) => void;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export function SortableHeader<T extends string>({
  field,
  label,
  currentField,
  currentDirection,
  onSort,
  align = 'left',
  className = '',
}: SortableHeaderProps<T>) {
  const isActive = currentField === field;
  const justifyClass =
    align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : '';

  return (
    <th
      className={`group px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wider cursor-pointer hover:text-text-primary select-none ${className}`}
      onClick={() => onSort(field)}
      aria-sort={isActive ? (currentDirection === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <span className={`flex items-center gap-1 ${justifyClass}`}>
        {label}
        {isActive ? (
          <span className="text-accent">
            {currentDirection === 'asc' ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </span>
        ) : (
          <span className="opacity-0 group-hover:opacity-50 transition-opacity">
            <ChevronsUpDown className="w-3.5 h-3.5" />
          </span>
        )}
      </span>
    </th>
  );
}
