export interface SyncWarningInput {
  upstreamJob: string | null;
  playerJob: string | null;
  upstreamAvgIlv: number | null;
  storedAvgIlv: number | null;
  upstreamSlotCount: number;
  upstreamServer: string | null;
  linkedServer: string | null;
  upstreamName: string | null;
  linkedName: string | null;
}

export function computeSyncWarnings(input: SyncWarningInput): string[] {
  const warnings: string[] = [];

  if (input.upstreamJob && input.playerJob && input.upstreamJob.toUpperCase() !== input.playerJob.toUpperCase()) {
    warnings.push(`This appears to be a different active job (${input.upstreamJob} instead of ${input.playerJob}).`);
  }

  if (input.upstreamAvgIlv != null && input.storedAvgIlv != null && input.upstreamAvgIlv < input.storedAvgIlv) {
    warnings.push(`This looks like lower item level gear than your saved set (avg iLv ${input.upstreamAvgIlv} vs ${input.storedAvgIlv}).`);
  }

  if (input.upstreamSlotCount > 0 && input.upstreamSlotCount < 8) {
    warnings.push(`Upstream data has only ${input.upstreamSlotCount} gear slots — missing slots will be cleared.`);
  }

  if (input.linkedServer && input.upstreamServer && input.linkedServer.toLowerCase() !== input.upstreamServer.toLowerCase()) {
    warnings.push(`Server mismatch: expected ${input.linkedServer}, provider returned ${input.upstreamServer}. The provider data may be stale.`);
  }

  if (input.linkedName && input.upstreamName && input.linkedName.toLowerCase() !== input.upstreamName.toLowerCase()) {
    warnings.push(`Name mismatch: expected ${input.linkedName}, provider returned ${input.upstreamName}. The provider data may be stale.`);
  }

  return warnings;
}

export function parseLodestoneCharacterId(input: string): number | null {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  try {
    const url = new URL(trimmed);
    if (!url.hostname.endsWith('finalfantasyxiv.com')) {
      return null;
    }

    const match = url.pathname.match(/^\/lodestone\/character\/(\d+)\/?$/i);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}
