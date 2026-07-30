/**
 * SortableHeader — keyboard-operable sortable column header (Phase-D R-46).
 *
 * Why this exists rather than a fix to `components/admin/SortableHeader.tsx`:
 * that component is a raw `<th onClick>` with no `tabIndex`, no `role` and no
 * key handler, and it is rendered by **V1's** All Weeks table
 * (`history/AllWeeksView.tsx:13,520-526`) plus ~20 admin headers. Adding tabbable
 * elements to it would change V1's tab order and focus rings on a frozen shell,
 * so R-46 rules two components until admin chooses to migrate.
 *
 * Keyboard operability is not optional here: R-29 makes sorting the mechanism
 * that absorbs BOTH the chronological axis (D-32) and the layout axis (D-33) in
 * v2's History, so shipping it mouse-only would strand a keyboard user with
 * neither.
 *
 * Pattern is the W3C APG sortable table: `aria-sort` lives on the `<th>` and
 * conveys state; a real `<button>` inside it is the control, so Enter/Space,
 * focus rings and AT activation all come from the platform rather than from
 * hand-rolled key handling.
 */
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export type SortDirection = 'asc' | 'desc';

export interface SortableHeaderProps<T extends string> {
  field: T;
  label: string;
  currentField: T;
  currentDirection: SortDirection;
  onSort: (field: T) => void;
  align?: 'left' | 'center' | 'right';
  className?: string;
  /** Column width/behaviour passthrough for `<th>` (e.g. `w-24`). */
  thClassName?: string;
}

export function SortableHeader<T extends string>({
  field,
  label,
  currentField,
  currentDirection,
  onSort,
  align = 'left',
  className = '',
  thClassName = '',
}: SortableHeaderProps<T>) {
  const isActive = currentField === field;
  const justifyClass =
    align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start';

  return (
    <th
      scope="col"
      // `none` (not undefined) on inactive columns: it is what tells AT the
      // column is sortable at all. The admin component omits it.
      aria-sort={isActive ? (currentDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`group px-4 py-3 ${thClassName}`}
    >
      {/* design-system-ignore: the APG sortable-table pattern needs a bare
          button inside the <th>; the Button primitive's rounded-lg /
          font-semibold / variant background / 44px min-height can't be
          overridden down to a column-header control. Same call as
          GroupViewToggle.tsx and MobileBottomNav.tsx. */}
      <button
        type="button"
        onClick={() => onSort(field)}
        className={
          'flex w-full items-center gap-1 text-xs font-medium uppercase tracking-wider ' +
          'text-text-secondary hover:text-text-primary ' +
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
          `rounded-sm cursor-pointer ${justifyClass} ${className}`
        }
      >
        {label}
        {isActive ? (
          <span className="text-accent" aria-hidden="true">
            {currentDirection === 'asc' ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </span>
        ) : (
          // Visible on hover AND on keyboard focus — the admin component reveals
          // this on hover only, which hides the affordance from keyboard users.
          <span
            className="opacity-0 transition-opacity group-hover:opacity-50 group-focus-within:opacity-50"
            aria-hidden="true"
          >
            <ChevronsUpDown className="w-3.5 h-3.5" />
          </span>
        )}
      </button>
    </th>
  );
}
