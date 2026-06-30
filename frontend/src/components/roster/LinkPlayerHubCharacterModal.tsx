import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LinkedCharacterSummary, RoleInStatic } from '../../types';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Button } from '../primitives';
import { CharacterSyncBadge } from './CharacterSyncBadge';

interface LinkPlayerHubCharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  available: LinkedCharacterSummary[];
  onLink: (characterId: string, role: RoleInStatic, job: string | null) => Promise<void>;
}

export function LinkPlayerHubCharacterModal({
  isOpen,
  onClose,
  playerName,
  available,
  onLink,
}: LinkPlayerHubCharacterModalProps) {
  const { t } = useTranslation();

  const ROLE_OPTIONS: { value: RoleInStatic; label: string }[] = [
    { value: 'main', label: t('roster.roleMain') },
    { value: 'alt', label: t('roster.roleAlt') },
    { value: 'substitute', label: t('roster.roleSubstitute') },
  ];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [role, setRole] = useState<RoleInStatic>('alt');
  const [job, setJob] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = available.find(c => c.id === selectedId);

  async function handleConfirm() {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      await onLink(selectedId, role, job.trim() || null);
      setSelectedId(null);
      setJob('');
      setRole('alt');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('roster.failedToLinkCharacter'));
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (saving) return;
    setSelectedId(null);
    setJob('');
    setRole('alt');
    setError(null);
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('roster.linkPlayerHubCharacterTitle', { playerName })}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={handleClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="accent-subtle"
            size="sm"
            onClick={handleConfirm}
            disabled={!selectedId || saving}
          >
            {saving ? t('roster.linking') : t('roster.linkCharacter')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <p className="text-sm text-status-error bg-status-error/10 rounded-lg px-3 py-2">{error}</p>
        )}

        {available.length === 0 ? (
          <div className="rounded-lg bg-surface-elevated p-4 text-center">
            <p className="text-sm text-text-muted">{t('roster.noPlayerHubCharactersAvailable')}</p>
            <p className="text-xs text-text-muted mt-1">
              {t('roster.allCharactersAlreadyRegistered')}
            </p>
          </div>
        ) : (
          <>
            <div>
              <p className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wide">
                {t('roster.selectCharacter')}
              </p>
              <div className="space-y-1.5">
                {available.map(char => (
                  // design-system-ignore: flex-col card toggle; Button layout conflicts with items-start/text-left
                  <button
                    key={char.id}
                    type="button"
                    onClick={() => setSelectedId(char.id)}
                    className={`w-full flex items-start justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                      selectedId === char.id
                        ? 'border-accent bg-accent/10'
                        : 'border-border-subtle bg-surface-base hover:border-accent/40'
                    }`}
                    aria-pressed={selectedId === char.id}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        {char.isMain && (
                          <span className="text-[9px] font-bold text-role-tank uppercase">{t('roster.roleMain')}</span>
                        )}
                        <span className="text-sm font-medium text-text-primary">{char.name}</span>
                      </div>
                      <p className="text-xs text-text-muted mt-0.5">
                        {char.server}{char.dataCenter ? ` · ${char.dataCenter}` : ''}
                      </p>
                    </div>
                    <CharacterSyncBadge lastSyncedAt={char.lastSyncedAt} />
                  </button>
                ))}
              </div>
            </div>

            {selected && (
              <div className="space-y-3 border-t border-border-subtle pt-3">
                <div>
                  <Label size="sm">{t('roster.roleInStatic')}</Label>
                  <div className="flex gap-2">
                    {ROLE_OPTIONS.map(opt => (
                      <Button
                        key={opt.value}
                        type="button"
                        size="sm"
                        variant={role === opt.value ? 'accent-subtle' : 'secondary'}
                        onClick={() => setRole(opt.value)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label size="sm">{t('roster.jobOptional')}</Label>
                  <Input
                    value={job}
                    onChange={v => setJob(v.toUpperCase().slice(0, 5))}
                    placeholder="e.g. DRK"
                    className="w-24"
                    aria-label={t('roster.jobAbbreviation')}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
