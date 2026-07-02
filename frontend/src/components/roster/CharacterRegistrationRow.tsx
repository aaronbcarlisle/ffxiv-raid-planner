import { useTranslation } from 'react-i18next';
import { Trash2, Edit3 } from 'lucide-react';
import { XivIcon } from '../ui/XivIcon';
import type { StaticCharacterRegistration } from '../../types';
import { Button } from '../primitives';
import { CharacterRoleBadge } from './CharacterRoleBadge';
import { CharacterSourceBadge } from './CharacterSourceBadge';
import { CharacterSyncBadge } from './CharacterSyncBadge';

interface CharacterRegistrationRowProps {
  reg: StaticCharacterRegistration;
  canEdit: boolean;
  onSetPrimary: (reg: StaticCharacterRegistration) => void;
  onEdit: (reg: StaticCharacterRegistration) => void;
  onDelete: (reg: StaticCharacterRegistration) => void;
}

export function CharacterRegistrationRow({
  reg,
  canEdit,
  onSetPrimary,
  onEdit,
  onDelete,
}: CharacterRegistrationRowProps) {
  const { t } = useTranslation();
  const name = reg.resolvedName ?? reg.manualCharacterName ?? '—';
  const world = reg.resolvedWorld ?? reg.manualWorld ?? null;
  const lastSynced = reg.linkedCharacter?.lastSyncedAt ?? null;

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-surface-elevated/40 group">
      {/* Name + world */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-text-primary truncate">{name}</span>
          {world && (
            <span className="text-xs text-text-muted">{world}</span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
          <CharacterRoleBadge role={reg.roleInStatic} isPrimary={reg.isPrimaryForStatic} />
          <CharacterSourceBadge source={reg.source} />
          {reg.job && (
            <span className="text-[10px] text-text-muted bg-surface-elevated px-1 py-0.5 rounded">
              {reg.job}
            </span>
          )}
          <CharacterSyncBadge lastSyncedAt={lastSynced} />
        </div>
      </div>

      {/* Actions */}
      {canEdit && (
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {!reg.isPrimaryForStatic && (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => onSetPrimary(reg)}
              title={t('roster.setAsPrimary')}
              aria-label={t('roster.setAsPrimaryAriaLabel', { name })}
            >
              <XivIcon name="earthlyStar" size={12} />
            </Button>
          )}
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => onEdit(reg)}
            title={t('common.edit')}
            aria-label={t('roster.editCharacterAriaLabel', { name })}
          >
            <Edit3 className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => onDelete(reg)}
            title={t('common.remove')}
            aria-label={t('roster.removeCharacterAriaLabel', { name })}
            className="text-status-error hover:bg-status-error/10"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
