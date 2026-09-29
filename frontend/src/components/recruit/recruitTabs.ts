/**
 * recruitTabs — the V2 Recruiting route's URL vocabulary (R-RH-H).
 *
 * `/group/:shareCode/recruit` selects its section with `?rtab=` (omitted for
 * the default Applicants tab), opens the Invites create form with `?create=1`,
 * and carries `?tier=` so a re-entry lands on the same tier. The Settings
 * dock's four `RecruitmentSection` values map onto the three tabs here, which
 * is what the settings-store seam (R-RH-I) navigates by.
 */
import type { RecruitmentSection } from '../settings';
import type { OpenOptions } from '../../stores/settingsPanelStore';

export const RECRUIT_TAB_VALUES = ['applicants', 'listing', 'invites'] as const;
export type RecruitTab = (typeof RECRUIT_TAB_VALUES)[number];

/** Dock section → route tab. Overview and Requests both land on Applicants. */
export const RECRUIT_SECTION_MAP = {
  overview: 'applicants',
  requests: 'applicants',
  listing: 'listing',
  invitations: 'invites',
} as const satisfies Record<RecruitmentSection, RecruitTab>;

const RECRUITMENT_SECTIONS = Object.keys(RECRUIT_SECTION_MAP) as RecruitmentSection[];

/** The tab for a raw `?rcsub=` value (an old dock link); unknown → Applicants. */
export function recruitTabForSection(raw: string | null | undefined): RecruitTab {
  return raw !== null && raw !== undefined && RECRUITMENT_SECTIONS.includes(raw as RecruitmentSection)
    ? RECRUIT_SECTION_MAP[raw as RecruitmentSection]
    : 'applicants';
}

export interface RecruitUrlOptions {
  /** Open the Invites create form on arrival (`?create=1`). */
  create?: boolean;
  /** The tier to keep selected (`?tier=`); omitted when null/undefined. */
  tier?: string | null;
}

export function recruitUrl(shareCode: string, tab?: RecruitTab, opts?: RecruitUrlOptions): string {
  const params = new URLSearchParams();
  if (tab && tab !== 'applicants') params.set('rtab', tab);
  if (opts?.create) params.set('create', '1');
  if (opts?.tier) params.set('tier', opts.tier);
  const search = params.toString();
  return `/group/${shareCode}/recruit${search ? `?${search}` : ''}`;
}

/**
 * The route a Settings-dock `open({ tab: 'recruitment', … })` call lands on
 * (R-RH-I). `highlightCreateInvite` becomes `?create=1` only when the mapped tab
 * is Invites — it is the Invites create form's flag, and the V1 header bell
 * passes it with no section (SettingsPanelController computes it as
 * `tab === 'recruitment' && !section`), which must still land on Applicants.
 */
export function recruitUrlForOpen(shareCode: string, opts: OpenOptions, tier?: string | null): string {
  const tab = RECRUIT_SECTION_MAP[opts.section ?? 'overview'];
  return recruitUrl(shareCode, tab, { create: tab === 'invites' && !!opts.highlightCreateInvite, tier });
}
