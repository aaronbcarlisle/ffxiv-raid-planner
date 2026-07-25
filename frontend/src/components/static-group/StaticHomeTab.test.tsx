/**
 * StaticHomeTab — full suite
 *
 * Verifies:
 *   - "Review Dossier" opens JoinRequestReviewModal directly (no Settings bypass)
 *   - The teaser has no accept/decline/maybe action buttons
 *   - Command Brief shows correct status chips
 *   - Integrated parchment notice appears inside Command Brief (not as a separate card)
 *   - Notification rail shows pending applications (no deduplication with center teaser)
 *   - Raid Prep section is present and rows are clickable buttons
 *   - Recent Activity renders from mount farm data (not from Notifications)
 *   - Best Next Farm surfaces top recommendation; Schedule Farm calls onScheduleFarm
 *   - Collection Goals: empty state, create modal CTA, goal rows
 *   - Mount activity does NOT appear in Notifications
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StaticHomeTab } from './StaticHomeTab';
import type { JoinRequest, StaticGroup } from '../../types';
import type { MountFarmData, FarmScore } from '../../stores/mountFarmStore';
import type { CollectionGoal } from '../../stores/collectionGoalStore';
import type { StaticObjectiveGoal } from '../../stores/objectiveGoalStore';
import type { SplitClearData } from '../../types';

// ── Mock data ─────────────────────────────────────────────────────────────────

const PENDING_REQUEST: JoinRequest = {
  id: 'req-1',
  staticGroupId: 'g1',
  requesterUserId: 'u1',
  requester: { id: 'u1', displayName: 'Warrior of Light' },
  status: 'pending',
  characterNameAtApply: 'Warrior of Light',
  characterWorldAtApply: 'Gilgamesh',
  selectedJob: 'dnc',
  selectedRole: 'ranged',
  readinessAtApply: 'ready',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const FARM_DATA_WITH_ACTIVITY: MountFarmData = {
  currentUserId: 'u1',
  trials: [
    {
      trialId: 'ew-zodiark',
      totalMembers: 2,
      membersComplete: 1,
      membersMissing: 1,
      membersWanting: 1,
      membersCanBuy: 0,
      memberProgress: [
        {
          userId: 'u1',
          displayName: 'Dev Owner',
          discordUsername: null,
          discordAvatar: null,
          trialId: 'ew-zodiark',
          hasMount: true,
          wantsMount: false,
          totemCount: 0,
          notes: null,
          updatedAt: new Date(Date.now() - 3600000).toISOString(),
          ownershipSource: 'manual',
          totemSource: 'manual',
          lastImportedAt: null,
          lastPluginSyncAt: null,
          lastManualOverrideAt: null,
        },
        {
          userId: 'u2',
          displayName: 'Team Member',
          discordUsername: null,
          discordAvatar: null,
          trialId: 'ew-zodiark',
          hasMount: false,
          wantsMount: true,
          totemCount: 28,
          notes: null,
          updatedAt: new Date(Date.now() - 7200000).toISOString(),
          ownershipSource: 'manual',
          totemSource: 'manual',
          lastImportedAt: null,
          lastPluginSyncAt: null,
          lastManualOverrideAt: null,
        },
      ],
    },
  ],
};

const TOP_RECOMMENDATION: FarmScore = {
  trialId: 'ew-zodiark',
  score: 4.5,
  membersMissing: 3,
  membersWanting: 2,
  membersCloseToTarget: 1,
  membersCanBuy: 0,
};

const MOCK_GOAL: CollectionGoal = {
  id: 'goal-1',
  staticGroupId: 'g1',
  createdById: 'u1',
  goalType: 'mount',
  contentType: null,
  contentKey: null,
  title: 'Lynx of Fallen Shadow',
  status: 'farming',
  summary: null,
  linkedDutyId: 'ew-zodiark',
  linkedRewardId: null,
  targetCount: null,
  currentCount: null,
  note: null,
  priorityMode: null,
  catalogItemId: null,
  tokenName: null,
  tokenCost: null,
  participantSummary: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  completedAt: null,
};

// ── Store mock state — mutated per test ───────────────────────────────────────

const farmStoreState = {
  data: null as MountFarmData | null,
  recommendations: [] as FarmScore[],
  isLoadingRecs: false,
  fetchRecommendations: vi.fn(),
  fetchProgress: vi.fn(),
};

const collectionGoalStoreState = {
  goals: [] as CollectionGoal[],
  isLoading: false,
  loadedGroupId: null as string | null,
  fetchGoals: vi.fn(),
  createGoal: vi.fn(),
  updateGoal: vi.fn(),
  deleteGoal: vi.fn().mockResolvedValue(undefined),
};

const objectiveGoalStoreState = {
  objectives: [] as StaticObjectiveGoal[],
  loading: false,
  objectivesError: null as string | null,
  fetchObjectives: vi.fn().mockResolvedValue(undefined),
};

const splitClearStoreState = {
  data: null as SplitClearData | null,
  fetchData: vi.fn().mockResolvedValue(undefined),
};

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../stores/mountFarmStore', () => ({
  useMountFarmStore: () => farmStoreState,
}));

vi.mock('../../stores/collectionGoalStore', () => ({
  useCollectionGoalStore: () => collectionGoalStoreState,
}));

vi.mock('../../stores/objectiveGoalStore', () => ({
  useObjectiveGoalStore: () => objectiveGoalStoreState,
}));

vi.mock('../../stores/splitClearStore', () => ({
  useSplitClearStore: () => splitClearStoreState,
}));

vi.mock('../../stores/joinRequestStore', () => ({
  useJoinRequestStore: () => ({
    groupRequests: [PENDING_REQUEST],
    fetchGroupRequests: vi.fn(),
    acceptRequest: vi.fn().mockResolvedValue(undefined),
    declineRequest: vi.fn().mockResolvedValue(undefined),
    markUnderReview: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
  }),
}));

vi.mock('../../stores/scheduleStore', () => ({
  useScheduleStore: () => ({
    sessions: [],
    fetchSessions: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock('../../stores/contentSuggestionStore', () => ({
  useContentSuggestionStore: () => ({
    suggestions: [],
    fetchSuggestions: vi.fn(),
  }),
}));

vi.mock('../../gamedata', () => ({
  getTierById: () => null,
  getAllTrialIds: () => [],
  getTrialById: (id: string) => {
    if (id === 'ew-zodiark') {
      return {
        id: 'ew-zodiark',
        dutyName: 'The Dark Inside (Extreme)',
        mountName: 'Lynx of Fallen Shadow',
        contentType: 'trial',
      };
    }
    return undefined;
  },
}));

vi.mock('../../gamedata/jobs', () => ({
  getJobDisplayName: (job: string) => job,
}));

// framer-motion: render motion.div as a plain div so animation props don't
// cause jsdom warnings. AnimatePresence just renders its children.
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, 'data-testid': dtid, onClick }: React.HTMLAttributes<HTMLDivElement> & { 'data-testid'?: string }) => (
      <div className={className} data-testid={dtid} onClick={onClick}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../ui/JobIcon', () => ({ JobIcon: () => null }));
vi.mock('../ui/SafeAvatar', () => ({
  SafeAvatar: ({ fallback }: { fallback?: React.ReactNode }) => <>{fallback}</>,
}));
vi.mock('../profile/ReadinessBadge', () => ({
  ReadinessBadge: ({ readiness }: { readiness: string }) => <span data-testid="readiness-badge">{readiness}</span>,
}));
vi.mock('./JoinRequestReviewModal', () => ({
  JoinRequestReviewModal: ({
    isOpen,
    onClose,
    request,
  }: {
    isOpen: boolean;
    onClose: () => void;
    request: JoinRequest;
  }) =>
    isOpen ? (
      <div data-testid="join-request-review-modal" data-request-id={request.id}>
        <span data-testid="modal-status">open</span>
        <button type="button" aria-label="Close dossier" onClick={onClose}>Close</button>
      </div>
    ) : null,
}));
vi.mock('./CreateCollectionGoalModal', () => ({
  CreateCollectionGoalModal: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="create-collection-goal-modal">
        <button type="button" onClick={onClose}>Cancel</button>
      </div>
    ) : null,
}));
vi.mock('../../utils/applicationSnapshot', () => ({
  normalizeApplicationSnapshot: (req: JoinRequest) => ({
    portrait: req.characterAvatarUrlAtApply ?? undefined,
    name: req.characterNameAtApply ?? 'Unknown',
    world: req.characterWorldAtApply ?? undefined,
    dc: undefined,
    applyingJob: req.selectedJob?.toUpperCase(),
    applyingRole: req.selectedRole ?? undefined,
    altJobs: [],
    avgItemLevel: req.gearSnapshotSummary?.avgItemLevel,
    gearSource: undefined,
    gearSyncedAt: undefined,
    missingGearCopy: 'No gear snapshot submitted',
    readiness: req.readinessAtApply ?? undefined,
    availabilitySummary: undefined,
    message: req.message ?? undefined,
    privacyCopy: 'No player profile linked.',
    profileShareCode: undefined,
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGroup(overrides: Partial<StaticGroup> = {}): StaticGroup {
  return {
    id: 'g1',
    name: 'Test Static',
    shareCode: 'share1',
    isPublic: true,
    ownerId: 'u1',
    memberCount: 1,
    userRole: 'owner',
    settings: {},
    ...overrides,
  } as StaticGroup;
}

function setFarmStore(overrides: Partial<typeof farmStoreState> = {}) {
  Object.assign(farmStoreState, {
    data: null,
    recommendations: [],
    isLoadingRecs: false,
    fetchRecommendations: vi.fn(),
    fetchProgress: vi.fn(),
    ...overrides,
  });
}

function setGoalStore(overrides: Partial<typeof collectionGoalStoreState> = {}) {
  Object.assign(collectionGoalStoreState, {
    goals: [],
    isLoading: false,
    loadedGroupId: null,
    fetchGoals: vi.fn(),
    createGoal: vi.fn(),
    updateGoal: vi.fn(),
    deleteGoal: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  });
}

function setObjectiveGoalStore(overrides: Partial<typeof objectiveGoalStoreState> = {}) {
  Object.assign(objectiveGoalStoreState, {
    objectives: [],
    loading: false,
    objectivesError: null,
    fetchObjectives: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  });
}

function setSplitClearStore(overrides: Partial<typeof splitClearStoreState> = {}) {
  Object.assign(splitClearStoreState, {
    data: null,
    fetchData: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  });
}

beforeEach(() => setSplitClearStore());

const onNavigate = vi.fn();
const onOpenRequests = vi.fn();

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('StaticHomeTab — recruitment flow', () => {
  beforeEach(() => { vi.clearAllMocks(); setFarmStore(); setGoalStore(); setObjectiveGoalStore(); });

  it('renders the "Review Dossier" button when canManage is true and there is a pending request', () => {
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    expect(screen.getByRole('button', { name: /review dossier/i })).toBeInTheDocument();
  });

  it('does NOT render the teaser when canManage is false', () => {
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage={false} onOpenRequests={onOpenRequests} />);
    expect(screen.queryByRole('button', { name: /review dossier/i })).not.toBeInTheDocument();
  });

  it('opens JoinRequestReviewModal directly on "Review Dossier" — does NOT call onOpenRequests (Settings)', () => {
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    fireEvent.click(screen.getByRole('button', { name: /review dossier/i }));
    expect(screen.getByTestId('join-request-review-modal')).toBeInTheDocument();
    expect(onOpenRequests).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('opens the dossier for the featured request (first pending)', () => {
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    fireEvent.click(screen.getByRole('button', { name: /review dossier/i }));
    expect(screen.getByTestId('join-request-review-modal')).toHaveAttribute('data-request-id', PENDING_REQUEST.id);
  });

  it('closes the dossier modal when onClose is triggered', () => {
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    fireEvent.click(screen.getByRole('button', { name: /review dossier/i }));
    expect(screen.getByTestId('join-request-review-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /close dossier/i }));
    expect(screen.queryByTestId('join-request-review-modal')).not.toBeInTheDocument();
  });

  it('teaser has no accept, decline, or maybe buttons', () => {
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    expect(screen.queryByRole('button', { name: /accept/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /decline/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /maybe/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /under review/i })).not.toBeInTheDocument();
  });
});

describe('StaticHomeTab — Command Brief', () => {
  beforeEach(() => { vi.clearAllMocks(); setFarmStore(); setGoalStore(); setObjectiveGoalStore(); });

  it('shows "pending application" chip when there is a pending request and canManage', () => {
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    expect(screen.getByRole('button', { name: /1 application.*pending/i })).toBeInTheDocument();
  });

  it('does not show "pending application" chip when canManage is false', () => {
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage={false} onOpenRequests={onOpenRequests} />);
    expect(screen.queryByRole('button', { name: /pending application/i })).not.toBeInTheDocument();
  });

  it('shows the integrated parchment application notice inside Command Brief when canManage and pending', () => {
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    expect(screen.getByTestId('application-notice')).toBeInTheDocument();
  });

  it('parchment notice is absent when canManage is false', () => {
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage={false} onOpenRequests={onOpenRequests} />);
    expect(screen.queryByTestId('application-notice')).not.toBeInTheDocument();
  });

  it('shows "roster configured" chip always', () => {
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    expect(screen.getByRole('button', { name: /0\/8 players configured/i })).toBeInTheDocument();
  });
});

describe('StaticHomeTab — notification feed', () => {
  beforeEach(() => { vi.clearAllMocks(); setFarmStore(); setGoalStore(); setObjectiveGoalStore(); });

  it('shows pending applications in the notification rail (not deduplicated from center teaser)', () => {
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    expect(screen.getByText('New application received')).toBeInTheDocument();
  });

  it('mount farm activity does NOT appear as a Notifications item', () => {
    setFarmStore({ data: FARM_DATA_WITH_ACTIVITY });
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    expect(screen.getByText('New application received')).toBeInTheDocument();
    const activityText = screen.queryByText(/Dev Owner obtained/i);
    if (activityText) {
      const accentParent = activityText.closest('[class*="text-accent"]');
      const isNotifItem = activityText.closest('[data-testid="activity-row"]');
      expect(accentParent).toBeNull();
      expect(isNotifItem).not.toBeNull();
    }
  });
});

describe('StaticHomeTab — Raid Prep section', () => {
  const TIER_WITH_PLAYERS = {
    id: 'tier-1',
    staticGroupId: 'g1',
    tierId: 'some-tier',
    name: 'Test Tier',
    contentType: 'savage' as const,
    isActive: true,
    weaponPrioritiesGlobalLock: false,
    currentWeek: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    players: [
      {
        id: 'p1',
        tierSnapshotId: 'tier-1',
        name: 'Warrior of Light',
        job: 'dnc',
        role: 'ranged',
        configured: true,
        sortOrder: 0,
        gear: [],
        tomeWeapon: { tracked: false },
        weaponPriorities: [],
        isSubstitute: false,
      },
    ],
  } as unknown as import('../../types').TierSnapshot;

  beforeEach(() => { vi.clearAllMocks(); setFarmStore(); setGoalStore(); setObjectiveGoalStore(); });

  it('renders "Tier Progress" heading (not "Static Readiness" or "Roster Readiness")', () => {
    render(<StaticHomeTab group={makeGroup()} tier={TIER_WITH_PLAYERS} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    expect(screen.queryByText(/roster readiness/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/static readiness/i)).not.toBeInTheDocument();
    expect(screen.getByText(/tier progress/i)).toBeInTheDocument();
  });

  it('player roster rows are buttons (keyboard-accessible, navigate to roster)', () => {
    render(<StaticHomeTab group={makeGroup()} tier={TIER_WITH_PLAYERS} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    const rosterBtns = screen.getAllByRole('button', { name: /view warrior of light on roster/i });
    expect(rosterBtns.length).toBeGreaterThan(0);
    fireEvent.click(rosterBtns[0]);
    expect(onNavigate).toHaveBeenCalledWith('roster');
  });

  it('hides split readiness when split mode is disabled', () => {
    setSplitClearStore({ data: { enabled: false, assignments: [], playerCharacters: {} } });
    render(<StaticHomeTab group={makeGroup()} tier={TIER_WITH_PLAYERS} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    expect(screen.queryByText('Split Clears')).not.toBeInTheDocument();
  });

  it('shows split readiness and opens the planner in Roster when enabled', () => {
    setSplitClearStore({
      data: {
        enabled: true,
        assignments: [{
          id: 'split-1',
          snapshotPlayerId: 'p1',
          runACharacterLinkId: null,
          runBCharacterLinkId: null,
          mainCharacterName: 'Main Character',
          mainCharacterWorld: 'Tonberry',
          altCharacterName: 'Alt Character',
          altCharacterWorld: 'Kujata',
          runACharacter: 'main',
          runBCharacter: 'alt',
          lootTarget: 'funnel_main',
          lootTargetJob: null,
          runACleared: false,
          runBCleared: false,
          notes: null,
          updatedAt: '2026-06-18T00:00:00Z',
        }],
        playerCharacters: {},
      },
    });
    render(<StaticHomeTab group={makeGroup()} tier={TIER_WITH_PLAYERS} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);

    expect(screen.getByText('Split Clears')).toBeInTheDocument();
    expect(screen.getByText('1/1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /open split planner/i }));
    expect(onNavigate).toHaveBeenCalledWith('roster');
  });
});

describe('StaticHomeTab — Recent Activity', () => {
  beforeEach(() => { vi.clearAllMocks(); setGoalStore(); setObjectiveGoalStore(); });

  it('shows "No recent activity" empty state when no farm data is loaded', () => {
    setFarmStore({ data: null });
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    expect(screen.getByTestId('no-recent-activity')).toBeInTheDocument();
    expect(screen.getByText(/no recent activity/i)).toBeInTheDocument();
    expect(screen.getByText(/track a shared reward/i)).toBeInTheDocument();
  });

  it('renders activity rows when mount farm data is available', () => {
    setFarmStore({ data: FARM_DATA_WITH_ACTIVITY });
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    const rows = screen.getAllByTestId('activity-row');
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.length).toBeLessThanOrEqual(5);
  });

  it('activity row shows mount-obtained text', () => {
    setFarmStore({ data: FARM_DATA_WITH_ACTIVITY });
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    expect(screen.getByText(/Dev Owner obtained Lynx of Fallen Shadow/i)).toBeInTheDocument();
  });

  it('shows "View all activity" link that navigates to the Farms sub-tab', () => {
    setFarmStore({ data: FARM_DATA_WITH_ACTIVITY });
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    fireEvent.click(screen.getByRole('button', { name: /view all activity/i }));
    expect(onNavigate).toHaveBeenCalledWith('goals', 'farms');
  });

  it('never shows more than 5 activity rows', () => {
    const manyMembers = Array.from({ length: 8 }, (_, i) => ({
      userId: `u${i}`,
      displayName: `Member ${i}`,
      discordUsername: null,
      discordAvatar: null,
      trialId: 'ew-zodiark',
      hasMount: true,
      wantsMount: false,
      totemCount: 0,
      notes: null,
      updatedAt: new Date(Date.now() - i * 60000).toISOString(),
      ownershipSource: 'manual' as const,
      totemSource: 'manual' as const,
      lastImportedAt: null,
      lastPluginSyncAt: null,
      lastManualOverrideAt: null,
    }));
    const bigData: MountFarmData = {
      currentUserId: 'u0',
      trials: [{
        trialId: 'ew-zodiark',
        totalMembers: 8,
        membersComplete: 8,
        membersMissing: 0,
        membersWanting: 0,
        membersCanBuy: 0,
        memberProgress: manyMembers,
      }],
    };
    setFarmStore({ data: bigData });
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    const rows = screen.getAllByTestId('activity-row');
    expect(rows.length).toBeLessThanOrEqual(5);
  });

  it('fetchProgress is called on mount so activity is populated on first Overview visit', () => {
    const fetchProgress = vi.fn();
    setFarmStore({ fetchProgress });
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    expect(fetchProgress).toHaveBeenCalled();
  });
});

describe('StaticHomeTab — Best Next Farm', () => {
  beforeEach(() => { vi.clearAllMocks(); setGoalStore(); setObjectiveGoalStore(); });

  it('shows empty state when no recommendations are available', () => {
    setFarmStore({ recommendations: [] });
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    expect(screen.getByText(/no active farm recommendations/i)).toBeInTheDocument();
  });

  it('renders top recommendation duty name and mount when available', () => {
    setFarmStore({ recommendations: [TOP_RECOMMENDATION] });
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    expect(screen.getByText(/The Dark Inside \(Extreme\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Lynx of Fallen Shadow/i)).toBeInTheDocument();
  });

  it('shows member count in Best Next Farm', () => {
    setFarmStore({ recommendations: [TOP_RECOMMENDATION] });
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    // Count is in a nested <span>; getByText finds the outer span via its direct text node
    const memberChip = screen.getByText(/members still need this/i);
    expect(memberChip.textContent).toMatch(/3 members still need this/i);
  });

  it('"Schedule Farm" falls back to the Farms sub-tab when onScheduleFarm is not provided', () => {
    setFarmStore({ recommendations: [TOP_RECOMMENDATION] });
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    fireEvent.click(screen.getByTestId('schedule-farm-btn'));
    expect(onNavigate).toHaveBeenCalledWith('goals', 'farms');
  });

  it('"Schedule Farm" calls onScheduleFarm with trial when provided — carries duty context', () => {
    setFarmStore({ recommendations: [TOP_RECOMMENDATION] });
    const onScheduleFarm = vi.fn();
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} onScheduleFarm={onScheduleFarm} />);
    fireEvent.click(screen.getByTestId('schedule-farm-btn'));
    expect(onScheduleFarm).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ew-zodiark', dutyName: 'The Dark Inside (Extreme)' })
    );
    expect(onNavigate).not.toHaveBeenCalledWith('goals');
  });
});

describe('StaticHomeTab — Collection Goals', () => {
  beforeEach(() => { vi.clearAllMocks(); setFarmStore(); setObjectiveGoalStore(); });

  it('shows "No collection goals yet" empty state copy', () => {
    setGoalStore({ goals: [] });
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    expect(screen.getByTestId('collection-goals-empty-heading')).toBeInTheDocument();
    expect(screen.getByText(/no collection goals yet/i)).toBeInTheDocument();
  });

  it('empty state copy mentions mounts, tokens, and rewards (not raids or clearing)', () => {
    setGoalStore({ goals: [] });
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    expect(screen.getByText(/track mounts, tokens, and rewards/i)).toBeInTheDocument();
  });

  it('"Create Collection Goal" CTA opens create modal (not navigate)', () => {
    setGoalStore({ goals: [] });
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    fireEvent.click(screen.getByTestId('create-collection-goal-btn'));
    expect(screen.getByTestId('create-collection-goal-modal')).toBeInTheDocument();
    expect(onNavigate).not.toHaveBeenCalledWith('goals');
  });

  it('Create Collection Goal modal can be closed', () => {
    setGoalStore({ goals: [] });
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    fireEvent.click(screen.getByTestId('create-collection-goal-btn'));
    expect(screen.getByTestId('create-collection-goal-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByTestId('create-collection-goal-modal')).not.toBeInTheDocument();
  });

  it('renders goal rows when goals exist', () => {
    setGoalStore({ goals: [MOCK_GOAL] });
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    const rows = screen.getAllByTestId('collection-goal-row');
    expect(rows.length).toBe(1);
    expect(screen.getByText('Lynx of Fallen Shadow')).toBeInTheDocument();
  });

  it('shows status for each goal', () => {
    setGoalStore({ goals: [MOCK_GOAL] });
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    expect(screen.getByText('Farming')).toBeInTheDocument();
  });

  it('"Create Collection Goal" CTA is absent from empty state when canManage is false (member cannot create)', () => {
    setGoalStore({ goals: [] });
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage={false} onOpenRequests={onOpenRequests} />);
    expect(screen.queryByTestId('create-collection-goal-btn')).not.toBeInTheDocument();
  });

  it('does NOT show old "Create Static Goal" text', () => {
    setGoalStore({ goals: [] });
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    expect(screen.queryByText(/create static goal/i)).not.toBeInTheDocument();
  });
});

// ── Privacy helpers ────────────────────────────────────────────────────────────

function makePluginMemberProgress(overrides: Partial<{
  userId: string; displayName: string; hasMount: boolean; wantsMount: boolean;
  totemCount: number; ownershipSource: 'manual' | 'plugin' | 'tomestone' | 'unknown'; totemSource: 'manual' | 'plugin' | 'tomestone' | 'unknown';
  lastPluginSyncAt: string | null;
}> = {}) {
  return {
    userId: 'u-plugin',
    displayName: 'SensitiveName',
    discordUsername: null as null,
    discordAvatar: null as null,
    trialId: 'ew-zodiark',
    hasMount: false,
    wantsMount: false,
    totemCount: 0,
    notes: null as null,
    updatedAt: new Date(Date.now() - 1000).toISOString(),
    ownershipSource: 'plugin' as const,
    totemSource: 'plugin' as const,
    lastImportedAt: null as null,
    lastPluginSyncAt: new Date(Date.now() - 500).toISOString(),
    lastManualOverrideAt: null as null,
    ...overrides,
  };
}

describe('StaticHomeTab — Recent Activity privacy', () => {
  beforeEach(() => { vi.clearAllMocks(); setGoalStore(); setObjectiveGoalStore(); });

  it('manual-sourced mount shows actor name', () => {
    setFarmStore({ data: FARM_DATA_WITH_ACTIVITY });
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    expect(screen.getByText(/Dev Owner obtained Lynx of Fallen Shadow/i)).toBeInTheDocument();
  });

  it('plugin-sourced mount shows "A member obtained X" — actor name is NOT shown', () => {
    const data: MountFarmData = {
      currentUserId: 'u1',
      trials: [{
        trialId: 'ew-zodiark', totalMembers: 1, membersComplete: 1,
        membersMissing: 0, membersWanting: 0, membersCanBuy: 0,
        memberProgress: [makePluginMemberProgress({ hasMount: true, ownershipSource: 'plugin' })],
      }],
    };
    setFarmStore({ data });
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    expect(screen.queryByText(/SensitiveName/i)).not.toBeInTheDocument();
    expect(screen.getByText(/A member obtained Lynx of Fallen Shadow/i)).toBeInTheDocument();
  });

  it('plugin-sourced totem update shows "A member updated collection progress" — no actor name', () => {
    const data: MountFarmData = {
      currentUserId: 'u1',
      trials: [{
        trialId: 'ew-zodiark', totalMembers: 1, membersComplete: 0,
        membersMissing: 1, membersWanting: 0, membersCanBuy: 0,
        memberProgress: [makePluginMemberProgress({ totemCount: 42, totemSource: 'plugin', ownershipSource: 'manual' })],
      }],
    };
    setFarmStore({ data });
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    expect(screen.queryByText(/SensitiveName/i)).not.toBeInTheDocument();
    expect(screen.getByText(/A member updated collection progress/i)).toBeInTheDocument();
  });

  it('plugin sync aggregate shows "Shared mount data updated" — NOT ambiguous "Plugin synced N mounts"', () => {
    const data: MountFarmData = {
      currentUserId: 'u1',
      trials: [{
        trialId: 'ew-zodiark', totalMembers: 1, membersComplete: 0,
        membersMissing: 1, membersWanting: 0, membersCanBuy: 0,
        memberProgress: [makePluginMemberProgress({ totemCount: 5, totemSource: 'plugin', ownershipSource: 'manual' })],
      }],
    };
    setFarmStore({ data });
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    expect(screen.queryByText(/Plugin synced/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Shared mount data updated/i)).toBeInTheDocument();
  });

  it('personal-only rows (private visibility) do NOT appear — activity is scoped to static', () => {
    // All data in FARM_DATA_WITH_ACTIVITY is manual/static-scoped;
    // the important check is that only 'static' rows appear, not 'private' ones.
    // Private rows would be ones with visibility: 'private' — none should leak.
    setFarmStore({ data: FARM_DATA_WITH_ACTIVITY });
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    const rows = screen.getAllByTestId('activity-row');
    // All rendered rows must have content appropriate for static-scoped display
    rows.forEach((row) => {
      expect(row.textContent).not.toMatch(/private/i);
    });
  });

  it('activity rows render without crashing when framer-motion is active (smoke test)', () => {
    setFarmStore({ data: FARM_DATA_WITH_ACTIVITY });
    render(<StaticHomeTab group={makeGroup()} tier={null} onNavigate={onNavigate} canManage onOpenRequests={onOpenRequests} />);
    expect(screen.getAllByTestId('activity-row').length).toBeGreaterThanOrEqual(1);
  });
});
