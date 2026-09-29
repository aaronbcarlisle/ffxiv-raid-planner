/**
 * useRecruitStatus — the Recruiting header's status control (R-RH-L).
 *
 * Reads the stored `discovery.recruitmentStatus` exactly as the backend's
 * `discovery_settings.normalize_status` does (`limited` → `selective`;
 * missing, empty, non-string or unknown → `open`) and writes a change back
 * through `updateGroup` with the rest of the settings untouched. A failed
 * write surfaces as a toast (the action-error pattern, R-RH-Q); the group
 * store's error is cleared so the shell's error modal does not double it.
 */
import { useCallback, useState } from 'react';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { toast } from '../../stores/toastStore';
import type { DiscoverySettings, StaticGroup } from '../../types';

export type RecruitmentStatus = 'open' | 'selective' | 'paused' | 'closed';

export const RECRUITMENT_STATUS_LABEL: Record<RecruitmentStatus, string> = {
  open: 'Open',
  selective: 'Selective',
  paused: 'Paused',
  closed: 'Closed',
};

export const RECRUITMENT_STATUS_OPTIONS = (Object.keys(RECRUITMENT_STATUS_LABEL) as RecruitmentStatus[]).map(
  (value) => ({ value, label: RECRUITMENT_STATUS_LABEL[value] }),
);

export function normalizeRecruitmentStatus(raw: unknown): RecruitmentStatus {
  if (raw === 'limited') return 'selective';
  if (raw === 'open' || raw === 'selective' || raw === 'paused' || raw === 'closed') return raw;
  return 'open';
}

export function useRecruitStatus(group: StaticGroup) {
  const updateGroup = useStaticGroupStore((s) => s.updateGroup);
  const clearGroupError = useStaticGroupStore((s) => s.clearError);
  const [isSaving, setIsSaving] = useState(false);
  const status = normalizeRecruitmentStatus(group.settings?.discovery?.recruitmentStatus);

  const setStatus = useCallback(
    async (next: RecruitmentStatus) => {
      if (next === status) return;
      const discovery = group.settings?.discovery;
      const nextDiscovery: DiscoverySettings = discovery
        ? { ...discovery, recruitmentStatus: next }
        : { enabled: false, recruitmentStatus: next };
      setIsSaving(true);
      try {
        await updateGroup(group.id, { settings: { ...group.settings, discovery: nextDiscovery } });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not update the recruitment status');
        clearGroupError();
      } finally {
        setIsSaving(false);
      }
    },
    [group.id, group.settings, status, updateGroup, clearGroupError],
  );

  return { status, setStatus, isSaving };
}
