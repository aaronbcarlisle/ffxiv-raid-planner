/**
 * JoinRequestReviewModal — AR 2.0 test suite
 *
 * Verifies:
 *   - All sections render when fitSnapshot present
 *   - Job fit section renders
 *   - Gear/BiS section renders or shows "No data"
 *   - Goal alignment shows counts (not text)
 *   - fitSnapshot=null shows "No fit snapshot" notice
 *   - Accept/decline buttons present for actionable requests
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JoinRequestReviewModal } from './JoinRequestReviewModal';
import type { JoinRequest } from '../../types';

// --- Mock motion to remove animation complexity ---
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// --- Mock GoalAlignmentSummary to isolate ---
vi.mock('./GoalAlignmentSummary', () => ({
  GoalAlignmentSummary: () => <div data-testid="goal-alignment-summary">GoalAlignmentSummary</div>,
}));

// --- Mock hooks ---
vi.mock('../../hooks/useModal', () => ({
  useModal: () => ({ isOpen: false, open: vi.fn(), close: vi.fn() }),
}));

vi.mock('../../hooks/useDevice', () => ({
  useDevice: () => ({ prefersReducedMotion: true }),
}));

// --- Shared noop handlers ---
const noop = async () => {};

// --- Shared request with fitSnapshot ---

const REQUEST_WITH_SNAPSHOT: JoinRequest = {
  id: 'req-snap',
  staticGroupId: 'g1',
  requesterUserId: 'u1',
  requester: { id: 'u1', displayName: 'Light Warrior' },
  status: 'pending',
  message: 'Hello, I want to join!',
  characterNameAtApply: 'Light Warrior',
  characterWorldAtApply: 'Gilgamesh',
  characterDcAtApply: 'Aether',
  selectedJob: 'dnc',
  selectedRole: 'ranged',
  readinessAtApply: 'ready',
  gearSnapshotSummary: {
    job: 'DNC',
    avgItemLevel: 710,
    source: 'lodestone',
    syncedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  fitSnapshot: {
    job: 'DNC',
    altJobs: ['BRD'],
    gearSummary: 'iL710 avg',
    selectedBisTargetName: 'Savage BiS',
    goalAlignment: { aligned: 2, partial: 1, conflicts: 0, missing: 0, unknown: 1 },
    scheduleOverlap: ['Tue', 'Thu'],
    languages: ['EN'],
    commsPreference: 'voice',
    snapshotAt: new Date().toISOString(),
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// --- Request WITHOUT fitSnapshot (legacy) ---

const LEGACY_REQUEST: JoinRequest = {
  id: 'req-legacy',
  staticGroupId: 'g1',
  requesterUserId: 'u2',
  requester: { id: 'u2', displayName: 'Old Adventurer' },
  status: 'pending',
  message: 'Looking for a static!',
  characterNameAtApply: 'Old Adventurer',
  characterWorldAtApply: 'Cactuar',
  selectedJob: 'war',
  selectedRole: 'tank',
  readinessAtApply: 'ready',
  createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
  updatedAt: new Date(Date.now() - 14 * 86400000).toISOString(),
};

// --- Request with fitSnapshot but no gear or BiS ---

const REQUEST_NO_GEAR: JoinRequest = {
  id: 'req-no-gear',
  staticGroupId: 'g1',
  requesterUserId: 'u3',
  requester: { id: 'u3', displayName: 'New Player' },
  status: 'pending',
  characterNameAtApply: 'New Player',
  selectedJob: 'whm',
  fitSnapshot: {
    job: 'WHM',
    altJobs: [],
    gearSummary: null,
    selectedBisTargetName: null,
    goalAlignment: null,
    scheduleOverlap: null,
    languages: [],
    commsPreference: null,
    snapshotAt: new Date().toISOString(),
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// --- Helper to render the modal ---

function renderModal(request: JoinRequest) {
  return render(
    <JoinRequestReviewModal
      isOpen
      onClose={vi.fn()}
      request={request}
      staticName="Test Static"
      onAccept={noop}
      onDecline={noop}
      onMarkUnderReview={noop}
    />
  );
}

describe('JoinRequestReviewModal — AR 2.0', () => {

  describe('when fitSnapshot is present', () => {
    it('renders the applicant section with character name', () => {
      renderModal(REQUEST_WITH_SNAPSHOT);
      // Character name appears (may appear multiple times in header + section)
      expect(screen.getAllByText('Light Warrior').length).toBeGreaterThan(0);
      // World appears somewhere in the applicant section
      expect(screen.getAllByText(/Gilgamesh/).length).toBeGreaterThan(0);
    });

    it('renders the applicant section with status badge', () => {
      renderModal(REQUEST_WITH_SNAPSHOT);
      expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
    });

    it('renders job fit section with applying job', () => {
      renderModal(REQUEST_WITH_SNAPSHOT);
      const section = document.querySelector('[data-testid="section-job-fit"]');
      expect(section).not.toBeNull();
      // DNC should appear in the section
      expect(section!.textContent).toContain('DNC');
    });

    it('renders job fit section with alt jobs', () => {
      renderModal(REQUEST_WITH_SNAPSHOT);
      const section = document.querySelector('[data-testid="section-job-fit"]');
      expect(section!.textContent).toContain('BRD');
    });

    it('renders gear/BiS section with gear summary', () => {
      renderModal(REQUEST_WITH_SNAPSHOT);
      const section = document.querySelector('[data-testid="section-gear-bis"]');
      expect(section).not.toBeNull();
      expect(section!.textContent).toContain('iL710 avg');
    });

    it('renders gear/BiS section with BiS target name', () => {
      renderModal(REQUEST_WITH_SNAPSHOT);
      const section = document.querySelector('[data-testid="section-gear-bis"]');
      expect(section!.textContent).toContain('Savage BiS');
    });

    it('renders goal alignment section with counts only (not text)', () => {
      renderModal(REQUEST_WITH_SNAPSHOT);
      const section = document.querySelector('[data-testid="section-goal-alignment"]');
      expect(section).not.toBeNull();
      // Shows counts
      expect(section!.textContent).toContain('2'); // aligned
      expect(section!.textContent).toContain('Aligned');
      expect(section!.textContent).toContain('Conflicts');
      // Does NOT show raw goal text (would only appear if we rendered goal descriptions)
      expect(section!.textContent).not.toContain('raid gear required');
    });

    it('renders goal alignment note about public goals', () => {
      renderModal(REQUEST_WITH_SNAPSHOT);
      const section = document.querySelector('[data-testid="section-goal-alignment"]');
      expect(section!.textContent).toContain('public goals');
    });

    it('renders schedule & comms section with schedule overlap', () => {
      renderModal(REQUEST_WITH_SNAPSHOT);
      const section = document.querySelector('[data-testid="section-schedule-comms"]');
      expect(section).not.toBeNull();
      expect(section!.textContent).toContain('Tue');
      expect(section!.textContent).toContain('Thu');
    });

    it('does NOT show "No fit snapshot" notice', () => {
      renderModal(REQUEST_WITH_SNAPSHOT);
      const notice = document.querySelector('[data-testid="no-fit-snapshot-notice"]');
      expect(notice).toBeNull();
    });
  });

  describe('when fitSnapshot is null (legacy application)', () => {
    it('shows "No fit snapshot" notice', () => {
      renderModal(LEGACY_REQUEST);
      const notice = document.querySelector('[data-testid="no-fit-snapshot-notice"]');
      expect(notice).not.toBeNull();
      expect(notice!.textContent).toContain('No fit snapshot');
    });

    it('does NOT render section-job-fit / section-gear-bis / section-goal-alignment / section-schedule-comms', () => {
      renderModal(LEGACY_REQUEST);
      expect(document.querySelector('[data-testid="section-job-fit"]')).toBeNull();
      expect(document.querySelector('[data-testid="section-gear-bis"]')).toBeNull();
      expect(document.querySelector('[data-testid="section-goal-alignment"]')).toBeNull();
      expect(document.querySelector('[data-testid="section-schedule-comms"]')).toBeNull();
    });

    it('still renders applicant section', () => {
      renderModal(LEGACY_REQUEST);
      const section = document.querySelector('[data-testid="section-applicant"]');
      expect(section).not.toBeNull();
      expect(section!.textContent).toContain('Old Adventurer');
    });
  });

  describe('when fitSnapshot present but no gear data', () => {
    it('shows "No data" for gear summary', () => {
      renderModal(REQUEST_NO_GEAR);
      const section = document.querySelector('[data-testid="section-gear-bis"]');
      expect(section).not.toBeNull();
      // No gear data → "No data" text
      expect(section!.textContent).toContain('No data');
    });
  });

  describe('decision panel (action buttons)', () => {
    it('shows Accept and Decline buttons for pending requests', () => {
      renderModal(REQUEST_WITH_SNAPSHOT);
      expect(screen.getByText('Accept')).toBeTruthy();
      expect(screen.getByText('Decline')).toBeTruthy();
    });

    it('shows Accept and Decline buttons even for legacy requests', () => {
      renderModal(LEGACY_REQUEST);
      expect(screen.getByText('Accept')).toBeTruthy();
      expect(screen.getByText('Decline')).toBeTruthy();
    });

    it('shows Close button for declined requests', () => {
      const declined: JoinRequest = {
        ...REQUEST_WITH_SNAPSHOT,
        id: 'req-declined',
        status: 'declined',
      };
      renderModal(declined);
      expect(screen.getByText('Close')).toBeTruthy();
      expect(screen.queryByText('Accept')).toBeNull();
    });

    it('shows fit indicator dot in action bar', () => {
      renderModal(REQUEST_WITH_SNAPSHOT);
      // Fit label should appear somewhere (varies by computed level)
      const fitLabels = ['Strong fit', 'Partial fit', 'Risk factors', 'Fit unknown'];
      const found = fitLabels.some((label) => screen.queryByText(label));
      expect(found).toBe(true);
    });
  });

});
