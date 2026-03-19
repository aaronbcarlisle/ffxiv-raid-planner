/** Sort direction type for admin tables. */
export type SortDirection = 'asc' | 'desc';

/** Toggle sort: same field flips direction, new field starts descending. */
export function toggleSort<T extends string>(
  field: T,
  currentField: T,
  currentDirection: SortDirection,
): { field: T; direction: SortDirection } {
  if (field === currentField) {
    return { field, direction: currentDirection === 'asc' ? 'desc' : 'asc' };
  }
  return { field, direction: 'desc' };
}
