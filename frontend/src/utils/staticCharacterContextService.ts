import type { StaticCharacterRegistration } from '../types';

export function getPrimaryRegistration(
  regs: StaticCharacterRegistration[],
): StaticCharacterRegistration | null {
  return regs.find(r => r.isPrimaryForStatic) ?? regs[0] ?? null;
}

export function getMainRegistrations(
  regs: StaticCharacterRegistration[],
): StaticCharacterRegistration[] {
  return regs.filter(r => r.roleInStatic === 'main');
}

export function getAltRegistrations(
  regs: StaticCharacterRegistration[],
): StaticCharacterRegistration[] {
  return regs.filter(r => r.roleInStatic === 'alt');
}

export function formatCharacterLabel(reg: StaticCharacterRegistration): string {
  const name = reg.resolvedName ?? reg.manualCharacterName ?? '(unknown)';
  const world = reg.resolvedWorld ?? reg.manualWorld;
  return world ? `${name} @ ${world}` : name;
}

export function resolveCharacterForPlayer(
  playerId: string,
  registrationsByPlayer: Record<string, StaticCharacterRegistration[]>,
): StaticCharacterRegistration | null {
  const regs = registrationsByPlayer[playerId];
  if (!regs?.length) return null;
  return getPrimaryRegistration(regs);
}

/** Return the registration for a specific job, falling back to primary. */
export function getRegistrationForJob(
  regs: StaticCharacterRegistration[],
  job: string,
): StaticCharacterRegistration | null {
  return regs.find(r => r.job === job) ?? getPrimaryRegistration(regs);
}

/** True if the player has any registration whose roleInStatic is 'main'. */
export function playerHasMainRole(
  playerId: string,
  registrationsByPlayer: Record<string, StaticCharacterRegistration[]>,
): boolean {
  return (registrationsByPlayer[playerId] ?? []).some(r => r.roleInStatic === 'main');
}
