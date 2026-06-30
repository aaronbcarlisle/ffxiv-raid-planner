import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RoleInStatic, StaticCharacterRegistration, StaticCharacterRegistrationCreate } from '../../types';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Button } from '../primitives';

interface AddManualCharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  snapshotPlayerId: string;
  /** If provided, we're editing an existing registration. */
  editing?: StaticCharacterRegistration | null;
  onSave: (payload: StaticCharacterRegistrationCreate) => Promise<void>;
}

export function AddManualCharacterModal({
  isOpen,
  onClose,
  playerName,
  snapshotPlayerId,
  editing,
  onSave,
}: AddManualCharacterModalProps) {
  const { t } = useTranslation();

  const ROLE_OPTIONS: { value: RoleInStatic; label: string }[] = [
    { value: 'main', label: t('roster.roleMain') },
    { value: 'alt', label: t('roster.roleAlt') },
    { value: 'substitute', label: t('roster.roleSubstitute') },
    { value: 'manual', label: t('roster.roleManualNoRole') },
  ];

  const [name, setName] = useState(editing?.manualCharacterName ?? editing?.resolvedName ?? '');
  const [world, setWorld] = useState(editing?.manualWorld ?? editing?.resolvedWorld ?? '');
  const [dc, setDc] = useState(editing?.manualDataCenter ?? editing?.resolvedDataCenter ?? '');
  const [role, setRole] = useState<RoleInStatic>(editing?.roleInStatic ?? 'alt');
  const [job, setJob] = useState(editing?.job ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName(editing?.manualCharacterName ?? '');
    setWorld(editing?.manualWorld ?? '');
    setDc(editing?.manualDataCenter ?? '');
    setRole(editing?.roleInStatic ?? 'alt');
    setJob(editing?.job ?? '');
    setError(null);
  }

  async function handleSave() {
    if (!name.trim()) {
      setError(t('roster.characterNameRequired'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        snapshotPlayerId,
        manualCharacterName: name.trim(),
        manualWorld: world.trim() || null,
        manualDataCenter: dc.trim() || null,
        roleInStatic: role,
        job: job.trim() || null,
        source: 'manual',
      });
      reset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('roster.failedToSave'));
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (saving) return;
    reset();
    onClose();
  }

  const title = editing
    ? t('roster.editCharacterTitle', { playerName })
    : t('roster.addManualCharacterTitle', { playerName });

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={handleClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="accent-subtle"
            size="sm"
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? t('common.saving') : editing ? t('roster.saveChanges') : t('roster.addCharacter')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {error && (
          <p className="text-sm text-status-error bg-status-error/10 rounded-lg px-3 py-2">{error}</p>
        )}

        <div>
          <Label size="sm" required>{t('common.character')}</Label>
          <Input
            value={name}
            onChange={setName}
            placeholder={t('roster.characterNamePlaceholder')}
            aria-label={t('common.character')}
          />
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <Label size="sm">{t('roster.world')}</Label>
            <Input value={world} onChange={setWorld} placeholder={t('roster.worldPlaceholder')} aria-label={t('roster.world')} />
          </div>
          <div className="flex-1">
            <Label size="sm">{t('roster.dataCenter')}</Label>
            <Input value={dc} onChange={setDc} placeholder={t('roster.dataCenterPlaceholder')} aria-label={t('roster.dataCenter')} />
          </div>
        </div>

        <div>
          <Label size="sm">{t('roster.roleInStatic')}</Label>
          <div className="flex flex-wrap gap-1.5">
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
            placeholder="DRK"
            className="w-24"
            aria-label={t('roster.jobAbbreviation')}
          />
        </div>
      </div>
    </Modal>
  );
}
