/**
 * Static Finder V2 types (Stage 4 SF1). Mirrors the Pydantic response
 * contract in `backend/app/schemas/discovery.py` (plan R-SF-A) in camelCase.
 * Where the plan's copy and the schema code differ, the schema code wins.
 */

// ─── Fit dimensions (additive, null without fitV2) ────────────

export interface FitNight {
  /** The listing's own iCal day code. */
  day: string;
  /** Viewer's iCal code of the raid start; null when the window isn't placed. */
  localDay: string | null;
  /** "HH:MM" in the viewer's display zone. */
  localStart: string | null;
  localEnd: string | null;
  /** null: no typical week to test against (R-SF-C). */
  coverage: 'full' | 'part' | 'none' | null;
}

// Not exported: only FitV2's own `role`/`schedule` fields need this shape
// today (Task 3 can export these if a later file needs them by name).
interface FitV2Role {
  status: 'match' | 'partial' | 'none' | 'unknown';
  matchedJob: string | null;
  matchedRole: string | null;
  priority: 'needed' | 'nice_to_have' | null;
  isMain: boolean;
  asRole: string | null;
}

interface FitV2Schedule {
  status: 'match' | 'partial' | 'conflict' | 'unknown';
  basis: 'time' | 'day';
  nights: FitNight[];
}

/**
 * One reason row. Carries no English — the frontend owns the copy (R-SF-P).
 * Note: a role reason's own `status` is `"conflict"` for a role miss, but
 * `params.status` (the hand-camelCased FitV2Role) still reads `"none"`
 * (backend/app/services/finder_fit.py:~392-400, `_role_params`).
 */
export interface FitReason {
  kind: 'role' | 'schedule' | 'goals' | 'comms' | 'bis';
  status: 'match' | 'partial' | 'conflict';
  params: Record<string, unknown>;
}

export interface FitV2 {
  tier: 'strong' | 'good' | 'partial' | 'weak' | 'unknown';
  missing: ('template' | 'jobs')[];
  role: FitV2Role;
  schedule: FitV2Schedule;
  reasons: FitReason[];
}

export interface FitCounts {
  strong: number;
  good: number;
  partial: number;
  weak: number;
  unknown: number;
}

export interface FitViewer {
  mainJob: string | null;
  mainRole: string | null;
  /** Duplicates fitV2.missing per listing (R-SF-A). */
  missing: ('template' | 'jobs')[];
}

// ─── V1 fit summary (kept for parity; the V2 card reads fitV2 instead) ─
// Not exported: only FinderItem's own fields need these shapes today.

interface GoalAlignmentSummarySlim {
  aligned: number;
  partial: number;
  conflicts: number;
  missing: number;
  unknown: number;
}

interface FinderFitSummary {
  overall: 'strong' | 'good' | 'partial' | 'weak' | 'unknown';
  goals: { aligned: number; partial: number; conflicts: number; missing: number };
  jobs: { status: 'match' | 'partial' | 'none' | 'unknown'; matchedJobs: string[] };
  schedule: { status: 'match' | 'partial' | 'conflict' | 'unknown' };
  comms: { status: 'match' | 'partial' | 'conflict' | 'unknown' };
  bis: { status: 'ready' | 'partial' | 'unknown' };
}

// ─── The list item and response ───────────────────────────────

export interface FinderItem {
  /** Present only for a signed-in fitV2 caller (R-SF-A, OWNER-3). */
  id?: string;
  name: string;
  shareCode: string;
  recruitmentStatus: string;
  description: string | null;
  contactMethod: string | null;
  contactValue: string | null;
  neededRoles: string[] | null;
  neededJobs: string[] | null;
  scheduleDays: string[] | null;
  scheduleStartTime: string | null;
  scheduleEndTime: string | null;
  timezone: string | null;
  languages: string[] | null;
  intensity: string | null;
  dataCenter: string | null;
  server: string | null;
  memberCount: number;
  lastUpdated: string | null;
  recruitingRoles: Record<string, unknown>[] | null;
  communicationStyle: Record<string, unknown> | null;
  objectiveCategories: string[];
  goalAlignment: GoalAlignmentSummarySlim | null;
  fitSummary: FinderFitSummary | null;
  /** null for guests or without fitV2 (R-SF-A). */
  fitV2: FitV2 | null;
}

export interface FinderResponse {
  items: FinderItem[];
  total: number;
  /** Whole filtered set, before pagination; null without fitV2 (R-SF-F). */
  fitCounts: FitCounts | null;
  viewer: FitViewer | null;
}

// ─── Role copy (R-SF-P) ────────────────────────────────────────

export const ROLE_KEYS = ['tank', 'healer', 'melee', 'ranged', 'caster'] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

/** "My role" chip labels. */
export const ROLE_CHIP_LABELS: Record<RoleKey, string> = {
  tank: 'Tank',
  healer: 'Healer',
  melee: 'Melee',
  ranged: 'Ranged',
  caster: 'Caster',
};

/** Role labels used in prose (the summary's "as a {role}", reason copy). */
export const ROLE_FIT_LABELS: Record<RoleKey, string> = {
  tank: 'tank',
  healer: 'healer',
  melee: 'melee DPS',
  ranged: 'physical ranged DPS',
  caster: 'caster',
};
