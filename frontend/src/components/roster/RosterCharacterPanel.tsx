import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { SnapshotPlayer, StaticCharacterRegistrationCreate, StaticCharacterRegistrationUpdate } from '../../types';
import { useStaticCharacterStore } from '../../stores/staticCharacterStore';
import { RosterCharacterMemberCard } from './RosterCharacterMemberCard';

interface RosterCharacterPanelProps {
  groupId: string;
  players: SnapshotPlayer[];
  canEdit: boolean;
}

export function RosterCharacterPanel({ groupId, players, canEdit }: RosterCharacterPanelProps) {
  const { t } = useTranslation();
  const {
    registrationsByGroup,
    availableForLinkingByGroup,
    isLoading,
    error,
    fetchRegistrations,
    createRegistration,
    updateRegistration,
    setPrimaryRegistration,
    deleteRegistration,
  } = useStaticCharacterStore();

  const registrations = registrationsByGroup[groupId] ?? {};
  const availableForLinking = availableForLinkingByGroup[groupId] ?? {};

  useEffect(() => {
    void fetchRegistrations(groupId);
  }, [groupId, fetchRegistrations]);

  async function handleCreate(payload: StaticCharacterRegistrationCreate) {
    await createRegistration(groupId, payload);
  }

  async function handleUpdate(regId: string, payload: StaticCharacterRegistrationUpdate) {
    const snapshotPlayerId = Object.keys(registrations).find(pid =>
      (registrations[pid] ?? []).some(r => r.id === regId),
    );
    if (!snapshotPlayerId) return;
    await updateRegistration(groupId, regId, payload);
  }

  async function handleSetPrimary(regId: string) {
    const snapshotPlayerId = Object.keys(registrations).find(pid =>
      (registrations[pid] ?? []).some(r => r.id === regId),
    );
    if (!snapshotPlayerId) return;
    await setPrimaryRegistration(groupId, regId, snapshotPlayerId);
  }

  async function handleDelete(regId: string) {
    const snapshotPlayerId = Object.keys(registrations).find(pid =>
      (registrations[pid] ?? []).some(r => r.id === regId),
    );
    if (!snapshotPlayerId) return;
    await deleteRegistration(groupId, regId, snapshotPlayerId);
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-surface-raised animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-status-error/30 bg-status-error/5 p-4">
        <p className="text-sm text-status-error">{error}</p>
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface-raised p-6 text-center">
        <p className="text-sm text-text-muted">{t('roster.noRosterMembersFound')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
          {t('roster.registeredCharacters')}
        </h3>
        <p className="text-xs text-text-muted">
          {t('roster.configuredCount', {
            configured: players.filter(p => (registrations[p.id]?.length ?? 0) > 0).length,
            total: players.length,
          })}
        </p>
      </div>
      {players.map(player => (
        <RosterCharacterMemberCard
          key={player.id}
          player={player}
          registrations={registrations[player.id] ?? []}
          availableForLinking={availableForLinking[player.id] ?? []}
          canEdit={canEdit}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onSetPrimary={handleSetPrimary}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
}
