/**
 * CommandPalette (F6a, Task 11) — minimal navigate-only palette.
 *
 * Scope: v2 shell only — mounted from NewShell, which only renders for ?shell=v2.
 *
 * Navigate targets:
 *   - Go to Home / Roster / Loot / Schedule (via useGroupViewState().setPageMode)
 *   - Open Settings (via useGroupViewState().setShowSettingsModal)
 *   - Switch static — one row per group (via useNavigate, preserving ?shell=v2)
 *
 * Also renders a "Keyboard Shortcuts" reference absorbed from keyboardShortcutGroups.
 *
 * Built on Modal (hideDefaultHeader). No cmdk dependency.
 * Platform-aware ⌘K (Mac) / Ctrl K (Windows/other) label.
 * Actions (log a drop, etc.) are DEFERRED — navigate-only is the scope.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Search,
  LayoutDashboard,
  Users,
  Shield,
  Calendar,
  Settings,
  ChevronRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { SHORTCUT_GROUPS } from '../ui/keyboardShortcutGroups';
import { useGroupViewState } from '../../hooks/useGroupViewState';
import { useStaticGroupStore } from '../../stores/staticGroupStore';

// ── Platform label ──────────────────────────────────────────────────────────

/**
 * Compute the platform-correct keyboard label at call time (not at module load)
 * so tests can stub `navigator.platform` before rendering and see the
 * correct value — no module resets required between test cases.
 */
function computeCmdkLabel(): string {
  return typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform)
    ? '⌘K'
    : 'Ctrl K';
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PaletteCommand {
  id: string;
  label: string;
  /** Optional sub-label (e.g. share code for switch-static rows). */
  sub?: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { setPageMode, setShowSettingsModal } = useGroupViewState();
  const groups = useStaticGroupStore((s) => s.groups);

  // Compute at render time so tests can stub navigator.platform.
  const cmdkLabel = computeCmdkLabel();

  // Wrapper that resets the search query AND closes the palette.
  // Using a handler (not useEffect) avoids cascading-render lint violations.
  const handleClose = useCallback(() => {
    setQuery('');
    onClose();
  }, [onClose]);

  const commands = useMemo<PaletteCommand[]>(
    () => [
      // ── Tab navigation ───────────────────────────────────────────────
      {
        id: 'go-overview',
        label: 'Go to Home',
        icon: <LayoutDashboard className="w-4 h-4" aria-hidden="true" />,
        onSelect: () => { setPageMode('overview'); handleClose(); },
      },
      {
        id: 'go-roster',
        label: 'Go to Roster',
        icon: <Users className="w-4 h-4" aria-hidden="true" />,
        onSelect: () => { setPageMode('roster'); handleClose(); },
      },
      {
        id: 'go-loot',
        label: 'Go to Loot',
        icon: <Shield className="w-4 h-4" aria-hidden="true" />,
        onSelect: () => { setPageMode('gear'); handleClose(); },
      },
      {
        id: 'go-schedule',
        label: 'Go to Schedule',
        icon: <Calendar className="w-4 h-4" aria-hidden="true" />,
        onSelect: () => { setPageMode('schedule'); handleClose(); },
      },
      // ── Settings ─────────────────────────────────────────────────────
      {
        id: 'open-settings',
        label: 'Open Settings',
        icon: <Settings className="w-4 h-4" aria-hidden="true" />,
        onSelect: () => { setShowSettingsModal(true); handleClose(); },
      },
      // ── Switch static — one row per group ────────────────────────────
      ...groups.map((g) => ({
        id: `switch-${g.id}`,
        label: `Switch to ${g.name}`,
        sub: g.shareCode,
        icon: <ChevronRight className="w-4 h-4" aria-hidden="true" />,
        onSelect: () => { navigate(`/group/${g.shareCode}?shell=v2`); handleClose(); },
      })),
    ],
    [setPageMode, setShowSettingsModal, groups, navigate, handleClose],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        (c.sub?.toLowerCase().includes(q) ?? false),
    );
  }, [commands, query]);

  const handleSelect = useCallback((cmd: PaletteCommand) => {
    cmd.onSelect();
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Command palette"
      size="2xl"
      hideDefaultHeader
    >
      {/* ── Search row ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border-default">
        {/* Magnifier — decorative, not interactive */}
        <Search
          className="w-5 h-5 flex-shrink-0 text-text-muted"
          aria-hidden="true"
        />
        {/* design-system-ignore: borderless inline palette input — the palette surface IS the input; a standard <Input> variant would add unwanted chrome */}
        <input
          type="text"
          className="flex-1 bg-transparent outline-none text-sm text-text-primary
                     placeholder:text-text-muted min-w-0"
          placeholder="Search commands…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search commands"
          autoComplete="off"
          spellCheck={false}
        />
        <kbd
          className="font-mono text-xs px-1.5 py-0.5 bg-surface-elevated
                     border border-border-default rounded text-text-muted
                     flex-shrink-0 select-none"
        >
          {cmdkLabel}
        </kbd>
      </div>

      {/* ── Command list ───────────────────────────────────────────────── */}
      <div role="listbox" aria-label="Commands" className="overflow-y-auto max-h-72">
        {filtered.length === 0 ? (
          <p className="px-4 py-3 text-sm text-text-muted">No commands found.</p>
        ) : (
          filtered.map((cmd) => (
            // design-system-ignore: styled command row — listbox option with full-row click target; not a Button variant
            <div
              key={cmd.id}
              role="option"
              aria-selected={false}
              tabIndex={0}
              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer
                         text-sm text-text-primary select-none
                         hover:bg-surface-elevated
                         focus-visible:bg-surface-elevated focus-visible:outline-none
                         border-b border-border-subtle last:border-none
                         transition-colors"
              onClick={() => handleSelect(cmd)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelect(cmd);
                }
              }}
            >
              <span className="text-text-muted flex-shrink-0">{cmd.icon}</span>
              <span className="flex-1 min-w-0 truncate">
                {cmd.label}
                {cmd.sub && (
                  <span className="ml-2 text-xs text-text-muted">{cmd.sub}</span>
                )}
              </span>
            </div>
          ))
        )}
      </div>

      {/* ── Keyboard shortcuts reference ───────────────────────────────── */}
      <div className="border-t border-border-default px-4 pt-3 pb-2">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
          Keyboard Shortcuts
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5 max-h-40 overflow-y-auto">
          {SHORTCUT_GROUPS.flatMap((group) =>
            group.shortcuts.map((s) => (
              <div
                key={`${group.title}-${s.key}`}
                className="flex items-center justify-between gap-2 py-0.5"
              >
                <span className="text-xs text-text-secondary truncate">
                  {s.description}
                </span>
                <kbd
                  className="font-mono text-xs px-1.5 py-0.5 bg-surface-elevated
                             border border-border-default rounded text-text-muted
                             whitespace-nowrap flex-shrink-0"
                >
                  {s.key}
                </kbd>
              </div>
            )),
          )}
        </div>
      </div>
    </Modal>
  );
}
