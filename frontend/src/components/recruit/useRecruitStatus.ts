/**
 * useRecruitStatus — the Recruiting header's status control (R-RH-L).
 *
 * `useRecruitmentStatus` is the READ-ONLY half: just the normalised status,
 * for callers that never write it (ApplicantsTab, the Listing tab's status
 * card — M9: the editor's own status cards are the single write path there).
 * `useRecruitStatus` adds the write path (`setStatus`, `isSaving`) for the
 * header's `Select`. A failed write surfaces as a toast (the action-error
 * pattern, R-RH-Q); the group store's error is cleared so the shell's error
 * modal does not double it.
 */
import { useCallback, useState } from 'react';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { toast } from '../../stores/toastStore';
import { normalizeRecruitmentStatus, STATUS_LABEL, type RecruitmentStatus } from '../../utils/recruitmentStatus';
import type { DiscoverySettings, StaticGroup } from '../../types';

export type { RecruitmentStatus };

export const RECRUITMENT_STATUS_LABEL = STATUS_LABEL;

export const RECRUITMENT_STATUS_OPTIONS = (Object.keys(RECRUITMENT_STATUS_LABEL) as RecruitmentStatus[]).map(
  (value) => ({ value, label: RECRUITMENT_STATUS_LABEL[value] }),
);

export function useRecruitmentStatus(group: StaticGroup): RecruitmentStatus {
  return normalizeRecruitmentStatus(group.settings?.discovery?.recruitmentStatus);
}

export function useRecruitStatus(group: StaticGroup) {
  const updateGroup = useStaticGroupStore((s) => s.updateGroup);
  const clearGroupError = useStaticGroupStore((s) => s.clearError);
  const [isSaving, setIsSaving] = useState(false);
  const status = useRecruitmentStatus(group);

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
      } catch {
        // Own copy, not the store's message (its fallback says "group").
        toast.error("Couldn't update the recruitment status.");
        clearGroupError();
      } finally {
        setIsSaving(false);
      }
    },
    [group.id, group.settings, status, updateGroup, clearGroupError],
  );

  return { status, setStatus, isSaving };
}
