/**
 * Platform-aware keyboard-shortcut labels (R-E1-G).
 *
 * Single author for the command-palette shortcut label: everywhere that
 * needs to show "how to open the palette" (the palette's own input chip,
 * its keyboard-shortcuts footer row) calls this instead of re-deriving the
 * Mac/other split locally. Computed at call time, not module load, so tests
 * can stub `navigator.platform` before rendering and see the correct value
 * with no module reset required between cases.
 */
export function getCommandPaletteShortcutLabel(): string {
  return typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform)
    ? '⌘K'
    : 'Ctrl+K';
}
