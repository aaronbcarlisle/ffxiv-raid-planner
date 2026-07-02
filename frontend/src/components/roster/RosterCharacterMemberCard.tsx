import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link2, PenLine } from 'lucide-react';
import type {
  LinkedCharacterSummary,
  SnapshotPlayer,
  StaticCharacterRegistration,
  StaticCharacterRegistrationCreate,
  StaticCharacterRegistrationUpdate,
} from '../../types';
import { Button } from '../primitives';
import { JobIcon } from '../ui/JobIcon';
import { CharacterRegistrationRow } from './CharacterRegistrationRow';
import { LinkPlayerHubCharacterModal } from './LinkPlayerHubCharacterModal';
import { AddManualCharacterModal } from './AddManualCharacterModal';

interface RosterCharacterMemberCardProps {
  player: SnapshotPlayer;
  registrations: StaticCharacterRegistration[];
  availableForLinking: LinkedCharacterSummary[];
  canEdit: boolean;
  onCreate: (payload: StaticCharacterRegistrationCreate) => Promise<void>;
  onUpdate: (regId: string, payload: StaticCharacterRegistrationUpdate) => Promise<void>;
  onSetPrimary: (regId: string) => Promise<void>;
  onDelete: (regId: string) => Promise<void>;
}

export function RosterCharacterMemberCard({
  player,
  registrations,
  availableForLinking,
  canEdit,
  onCreate,
  onUpdate,
  onSetPrimary,
  onDelete,
}: RosterCharacterMemberCardProps) {
  const { t } = useTranslation();
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [editingReg, setEditingReg] = useState<StaticCharacterRegistration | null>(null);

  const hasLinkedChars = availableForLinking.length > 0;

  async function handleLink(characterId: string, role: import('../../types').RoleInStatic, job: string | null) {
    await onCreate({
      snapshotPlayerId: player.id,
      playerCharacterId: characterId,
      roleInStatic: role,
      job,
    });
  }

  async function handleManualSave(payload: StaticCharacterRegistrationCreate) {
    await onCreate(payload);
  }

  async function handleEditSave(payload: StaticCharacterRegistrationCreate) {
    if (!editingReg) return;
    await onUpdate(editingReg.id, {
      roleInStatic: payload.roleInStatic,
      job: payload.job,
      manualCharacterName: payload.manualCharacterName,
      manualWorld: payload.manualWorld,
      manualDataCenter: payload.manualDataCenter,
    });
    setEditingReg(null);
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-3 space-y-2">
      {/* Player header */}
      <div className="flex items-center gap-2">
        {player.job && <JobIcon job={player.job} size="sm" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary">{player.name || '—'}</p>
          {player.job && (
            <p className="text-xs text-text-muted">{player.job}</p>
          )}
        </div>
        {canEdit && (
          <div className="flex gap-1 shrink-0">
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => setShowLinkModal(true)}
              disabled={!hasLinkedChars && availableForLinking.length === 0}
              title={hasLinkedChars ? t('roster.linkPlayerHubCharacter') : t('roster.noPlayerHubCharactersAvailableShort')}
              aria-label={t('roster.linkPlayerHubCharacterForAriaLabel', { name: player.name })}
            >
              <Link2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => setShowManualModal(true)}
              title={t('roster.addManualCharacter')}
              aria-label={t('roster.addManualCharacterForAriaLabel', { name: player.name })}
            >
              <PenLine className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Registrations */}
      {registrations.length === 0 ? (
        <div className="rounded-lg bg-surface-base px-3 py-2 text-center">
          <p className="text-xs text-text-muted">{t('roster.noCharactersRegistered')}</p>
          {canEdit && (
            <div className="flex justify-center gap-2 mt-1.5">
              {hasLinkedChars && (
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  onClick={() => setShowLinkModal(true)}
                >
                  {t('roster.linkPlayerHubCharacter')}
                </Button>
              )}
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => setShowManualModal(true)}
              >
                {t('roster.addManually')}
              </Button>
            </div>
          )}
          {!canEdit && !hasLinkedChars && (
            <p className="text-xs text-text-muted mt-1">
              {t('roster.noPlayerHubCharactersFoundAskPlayer')}
            </p>
          )}
        </div>
      ) : (
        <div className="divide-y divide-border-subtle/50">
          {registrations.map(reg => (
            <CharacterRegistrationRow
              key={reg.id}
              reg={reg}
              canEdit={canEdit}
              onSetPrimary={() => onSetPrimary(reg.id)}
              onEdit={() => setEditingReg(reg)}
              onDelete={() => onDelete(reg.id)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <LinkPlayerHubCharacterModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        playerName={player.name}
        available={availableForLinking}
        onLink={handleLink}
      />

      <AddManualCharacterModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        playerName={player.name}
        snapshotPlayerId={player.id}
        onSave={handleManualSave}
      />

      {editingReg && (
        <AddManualCharacterModal
          isOpen
          onClose={() => setEditingReg(null)}
          playerName={player.name}
          snapshotPlayerId={player.id}
          editing={editingReg}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
}
