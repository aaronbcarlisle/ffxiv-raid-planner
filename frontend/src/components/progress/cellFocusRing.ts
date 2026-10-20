/**
 * The ring on a grid cell the keyboard has focused and that is not itself a control (a read-only
 * `<td>` or `<th>` that is the roving grid's stop): the farm status cell, a blank or read-only
 * Progress cell, and the tier row's name, menu and no-card cells share it. The cells that hold a
 * `Button` take the Button's own ring instead.
 */
export const CELL_FOCUS_RING = 'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent';
