import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../primitives/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { TextArea } from '../ui/TextArea';

const CATEGORY_OPTIONS = [
  { value: 'ultimate_clear',     label: 'Ultimate — Clear' },
  { value: 'ultimate_farm',      label: 'Ultimate — Farm' },
  { value: 'savage_bis',         label: 'Savage — BiS' },
  { value: 'savage_mount',       label: 'Savage — Mount' },
  { value: 'savage_achievement', label: 'Savage — Achievement' },
  { value: 'savage_alt_jobs',    label: 'Savage — Alt Jobs' },
  { value: 'criterion_title',    label: 'Criterion — Title' },
  { value: 'gil_farm',           label: 'Gil Farm' },
  { value: 'loot_farm',          label: 'Loot Farm' },
  { value: 'mount_farm',         label: 'Mount Farm' },
  { value: 'custom',             label: 'Custom' },
];

interface SuggestContentModalProps {
  onSave: (data: { category: string; title: string; description?: string }) => Promise<void>;
  onClose: () => void;
}

export function SuggestContentModal({ onSave, onClose }: SuggestContentModalProps) {
  const [category, setCategory] = useState('savage_bis');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        category,
        title: title.trim(),
        description: description.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to suggest content');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen title="Suggest Content" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Category</label> {/* design-system-ignore */}
          <Select value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Title</label> {/* design-system-ignore */}
          <Input
            value={title}
            onChange={setTitle}
            placeholder="e.g., Farm TOP weapons for everyone"
            maxLength={200}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Details (optional)</label> {/* design-system-ignore */}
          <TextArea
            value={description}
            onChange={setDescription}
            placeholder="Why should the static consider this?"
            maxLength={2000}
            rows={3}
          />
        </div>

        {error && (
          <p className="text-sm text-status-error bg-status-error/10 rounded px-3 py-2">{error}</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !title.trim()}>
            {saving ? 'Submitting…' : 'Suggest'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
