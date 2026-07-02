/**
 * PromoteToGoalModal — lets leads/owners set priority and optional overrides
 * when promoting a content suggestion into a static objective goal.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../ui/Modal';
import { Button } from '../primitives/Button';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import type { ContentSuggestion } from '../../stores/contentSuggestionStore';

interface PromoteToGoalModalProps {
  suggestion: ContentSuggestion;
  onPromote: (data: { priority: string; title?: string; description?: string }) => Promise<void>;
  onClose: () => void;
}

export function PromoteToGoalModal({ suggestion, onPromote, onClose }: PromoteToGoalModalProps) {
  const { t } = useTranslation();
  const [priority, setPriority] = useState('required');
  const [titleOverride, setTitleOverride] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const PRIORITY_OPTIONS = [
    { value: 'required',  label: t('objectivePriority.required') },
    { value: 'preferred', label: t('objectivePriority.preferred') },
    { value: 'optional',  label: t('objectivePriority.optional') },
    { value: 'not_doing', label: t('objectivePriority.not_doing') },
  ];

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onPromote({
        priority,
        title: titleOverride.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.promoteSuggestionFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen title={t('settings.promoteToObjectiveGoal')} onClose={onClose} size="md">
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          {t('settings.promoteSuggestionDesc', { title: suggestion.title })}
        </p>

        <div>
          <Label htmlFor="promote-priority">{t('goalsPage.priority')}</Label>
          <Select id="promote-priority" value={priority} onChange={setPriority} options={PRIORITY_OPTIONS} />
        </div>

        <div>
          <Label htmlFor="promote-title">
            {t('settings.titleOverride')}{' '}
            <span className="text-text-muted font-normal">({t('settings.titleOverrideHint')})</span>
          </Label>
          <Input id="promote-title"
            value={titleOverride}
            onChange={setTitleOverride}
            placeholder={suggestion.title}
            maxLength={200}
          />
        </div>

        {error && (
          <p className="text-sm text-status-error bg-status-error/10 rounded px-3 py-2">{error}</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? t('settings.promoting') : t('settings.promoteToGoal')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
