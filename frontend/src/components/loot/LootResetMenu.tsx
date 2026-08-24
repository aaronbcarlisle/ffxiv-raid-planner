/**
 * LootResetMenu — the Log view's destructive Reset dropdown (F6d, spec §5.9;
 * cut-order item 1; moved off History to Log in D7, R-16) — bound to the
 * DISPLAYED week, the one entry point that isn't surface-attached. A ghost
 * trigger opens a menu of six scoped resets; each item calls `onSelect(config)`
 * with the `ResetConfig` the host feeds to `ResetConfirmModal` (which enforces
 * the type-to-confirm RESET gate). The host (`Loot`) owns the confirm +
 * coordination — this is presentational routing only.
 */
import { RotateCcw } from 'lucide-react';
import { Button } from '../primitives/Button';
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from '../primitives/Dropdown';
import type { ResetConfig } from '../ui/ResetConfirmModal';

export interface LootResetMenuProps {
  /** The Log view's displayed week — scopes the "week" resets. */
  week: number;
  onSelect: (config: ResetConfig) => void;
}

export function LootResetMenu({ week, onSelect }: LootResetMenuProps) {
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<RotateCcw className="h-3.5 w-3.5" aria-hidden />}
        >
          Reset
        </Button>
      </DropdownTrigger>
      <DropdownContent align="end" className="w-48">
        <DropdownItem onSelect={() => onSelect({ scope: 'week', target: 'loot', week })}>
          Reset Week {week} loot
        </DropdownItem>
        <DropdownItem onSelect={() => onSelect({ scope: 'week', target: 'books', week })}>
          Reset Week {week} books
        </DropdownItem>
        <DropdownItem onSelect={() => onSelect({ scope: 'week', target: 'data', week })}>
          Reset Week {week} data
        </DropdownItem>
        <DropdownSeparator />
        <DropdownItem danger onSelect={() => onSelect({ scope: 'all', target: 'loot' })}>
          Reset ALL loot
        </DropdownItem>
        <DropdownItem danger onSelect={() => onSelect({ scope: 'all', target: 'books' })}>
          Reset ALL books
        </DropdownItem>
        <DropdownItem danger onSelect={() => onSelect({ scope: 'all', target: 'data' })}>
          Reset ALL data
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}
