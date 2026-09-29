/**
 * recruitmentStatus — the shared normaliser + label table for a static's
 * stored `discovery.recruitmentStatus` (RH1d, R-RH-L). Extracted from three
 * byte-identical copies (`JoinRequestBanner`, `settings/RecruitmentTab`,
 * `recruit/useRecruitStatus`) so there is one place to change.
 *
 * Reads the value exactly as the backend's `discovery_settings.normalize_status`
 * does: `limited` maps to `selective`; missing, empty, non-string or unknown
 * maps to `open`. V1 behaviour is byte-identical — this is a pure extraction.
 */
export type RecruitmentStatus = 'open' | 'selective' | 'paused' | 'closed';

export function normalizeRecruitmentStatus(raw: unknown): RecruitmentStatus {
  if (raw === 'limited') return 'selective';
  if (raw === 'open' || raw === 'selective' || raw === 'paused' || raw === 'closed') return raw;
  return 'open';
}

export const STATUS_LABEL: Record<RecruitmentStatus, string> = {
  open: 'Open',
  selective: 'Selective',
  paused: 'Paused',
  closed: 'Closed',
};
