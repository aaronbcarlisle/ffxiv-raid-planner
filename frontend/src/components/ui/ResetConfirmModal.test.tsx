// R-44 (Phase D) — getResetDescription's week interpolation.
//
// This modal is rendered by BOTH shells: v2 via `Loot.tsx`, and V1 via
// `history/LootLogModals.tsx:20` <- `history/SectionedLogView.tsx:1794`. The two
// week-less configs asserted below are emitted by V1 TODAY — the all-time books
// column menu (`SectionedLogView.tsx:414`) and the all-time player books row menu
// (`:436`) — so the "Week undefined" strings these tests pin are a live V1 defect,
// not a v2 concern. R-44 approves the fix as an explicit V1-visible delta.
//
// Assertions go through the rendered description rather than the (unexported)
// helper: the ruling is about what a user reads before typing RESET.
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';

import { ResetConfirmModal, type ResetConfig } from './ResetConfirmModal';

// Modal -> useDevice reads matchMedia, which jsdom doesn't implement.
// Same stub as UserMenu.railfooter.test.tsx.
beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

function renderWith(config: ResetConfig) {
  return render(
    <ResetConfirmModal
      isOpen
      config={config}
      onConfirm={async () => {}}
      onCancel={() => {}}
    />,
  );
}

describe('ResetConfirmModal — reset description', () => {
  describe('week-less configs V1 emits today (R-44)', () => {
    it('states every-week scope for an all-time player book reset, never "Week undefined"', () => {
      // Verbatim shape from SectionedLogView.tsx:436 — no `week` key.
      renderWith({ scope: 'all', target: 'books', playerId: 'p1', playerName: 'Alice' });

      expect(screen.queryByText(/Week undefined/i)).toBeNull();
      expect(screen.getByText(/ALL of Alice's book entries for this tier \(every week\)/i)).toBeTruthy();
    });

    it('states every-week scope for an all-time floor book reset, never "Week undefined"', () => {
      // Verbatim shape from SectionedLogView.tsx:414 — no `week` key.
      renderWith({ scope: 'floor', target: 'books', floor: 2 });

      expect(screen.queryByText(/Week undefined/i)).toBeNull();
      expect(screen.getByText(/ALL book entries for Floor 2 \(every week\)/i)).toBeTruthy();
    });

    it('does not mis-state a floor-scoped loot reset as tier-wide', () => {
      renderWith({ scope: 'floor', target: 'loot', floor: 3 });

      expect(screen.queryByText(/for this tier/i)).toBeNull();
      expect(screen.getByText(/ALL loot entries for Floor 3 \(every week\)/i)).toBeTruthy();
    });
  });

  // These paths are already correct and must stay byte-identical: the freeze
  // permits R-44's correctness fix, not incidental copy churn in V1.
  describe('configs that already render correctly (unchanged)', () => {
    it('keeps the week-scoped player book string', () => {
      renderWith({ scope: 'week', target: 'books', week: 3, playerId: 'p1', playerName: 'Alice' });
      expect(screen.getByText(/Alice's book entries for Week 3/i)).toBeTruthy();
    });

    it('keeps the week-scoped floor strings', () => {
      renderWith({ scope: 'floor', target: 'loot', floor: 1, week: 2 });
      expect(screen.getByText(/loot entries for Floor 1 in Week 2/i)).toBeTruthy();
    });

    it('keeps the plain week strings', () => {
      renderWith({ scope: 'week', target: 'loot', week: 4 });
      expect(screen.getByText(/loot entries for Week 4/i)).toBeTruthy();
    });

    it('keeps the tier-wide book wording ("balances", not "entries")', () => {
      renderWith({ scope: 'all', target: 'books' });
      expect(screen.getByText(/ALL book balances for this tier/i)).toBeTruthy();
    });

    it('keeps the tier-wide loot and data wording', () => {
      const { unmount } = renderWith({ scope: 'all', target: 'loot' });
      expect(screen.getByText(/ALL loot entries for this tier/i)).toBeTruthy();
      unmount();

      renderWith({ scope: 'all', target: 'data' });
      expect(screen.getByText(/ALL data \(loot and books\) for this tier/i)).toBeTruthy();
    });
  });
});
