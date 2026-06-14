/**
 * PromoteToGoalModal — lets leads/owners set priority and optional overrides
 * when promoting a content suggestion into a static objective goal.
 */

import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../primitives/Button';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import type { ContentSuggestion } from '../../stores/contentSuggestionStore';

const PRIORITY_OPTIONS = [
  { value: 'required',  label: 'Required' },
  { value: 'preferred', label: 'Preferred' },
  { value: 'optional',  label: 'Optional' },
  { value: 'not_doing', label: 'Not Doing' },
];

interface PromoteToGoalModalProps {
  suggestion: ContentSuggestion;
  onPromote: (data: { priority: string; title?: string; description?: string }) => Promise<void>;
  onClose: () => void;
}

export function PromoteToGoalModal({ suggestion, onPromote, onClose }: PromoteToGoalModalProps) {
  const [priority, setPriority] = useState('required');
  const [titleOverride, setTitleOverride] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : 'Failed to promote suggestion');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen title="Promote to Objective Goal" onClose={onClose} size="md">
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Promoting{' '}
          <span className="font-semibold text-text-primary">"{suggestion.title}"</span>{' '}
          will create a new static objective goal from this suggestion.
        </p>

        <div>
          <Label htmlFor="promote-priority">Priority</Label>
          <Select id="promote-priority" value={priority} onChange={setPriority} options={PRIORITY_OPTIONS} />
        </div>

        <div>
          <Label htmlFor="promote-title">
            Title override{' '}
            <span className="text-text-muted font-normal">(optional — uses suggestion title if blank)</span>
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
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Promoting…' : 'Promote to Goal'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
