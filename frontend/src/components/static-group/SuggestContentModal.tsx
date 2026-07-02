import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../ui/Modal';
import { Button } from '../primitives/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { TextArea } from '../ui/TextArea';

function getCategoryOptions(isJapanese: boolean) {
  return [
    { value: 'ultimate_clear', label: isJapanese ? '絶クリア' : 'Ultimate — Clear' },
    { value: 'ultimate_farm', label: isJapanese ? '絶周回' : 'Ultimate — Farm' },
    { value: 'savage_bis', label: isJapanese ? '零式BiS' : 'Savage — BiS' },
    { value: 'savage_mount', label: isJapanese ? '零式マウント' : 'Savage — Mount' },
    { value: 'savage_achievement', label: isJapanese ? '零式アチーブメント' : 'Savage — Achievement' },
    { value: 'savage_alt_jobs', label: isJapanese ? '零式サブジョブ' : 'Savage — Alt Jobs' },
    { value: 'criterion_title', label: isJapanese ? '異聞称号' : 'Criterion — Title' },
    { value: 'gil_farm', label: isJapanese ? 'ギル稼ぎ' : 'Gil Farm' },
    { value: 'loot_farm', label: isJapanese ? '戦利品周回' : 'Loot Farm' },
    { value: 'mount_farm', label: isJapanese ? 'マウント周回' : 'Mount Farm' },
    { value: 'custom', label: isJapanese ? 'カスタム' : 'Custom' },
  ];
}

interface SuggestContentModalProps {
  onSave: (data: { category: string; title: string; description?: string }) => Promise<void>;
  onClose: () => void;
}

export function SuggestContentModal({ onSave, onClose }: SuggestContentModalProps) {
  const { i18n } = useTranslation();
  const isJapanese = (i18n.resolvedLanguage ?? '').toLowerCase().startsWith('ja');
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
      setError(err instanceof Error ? err.message : (isJapanese ? '提案の送信に失敗しました' : 'Failed to suggest content'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen title={isJapanese ? 'コンテンツを提案' : 'Suggest Content'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">{isJapanese ? 'カテゴリ' : 'Category'}</label> {/* design-system-ignore */}
          <Select value={category} onChange={setCategory} options={getCategoryOptions(isJapanese)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">{isJapanese ? 'タイトル' : 'Title'}</label> {/* design-system-ignore */}
          <Input
            value={title}
            onChange={setTitle}
            placeholder={isJapanese ? '例：固定全員で TOP 武器周回' : 'e.g., Farm TOP weapons for everyone'}
            maxLength={200}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">{isJapanese ? '詳細（任意）' : 'Details (optional)'}</label> {/* design-system-ignore */}
          <TextArea
            value={description}
            onChange={setDescription}
            placeholder={isJapanese ? '固定で検討したい理由を書いてください' : 'Why should the static consider this?'}
            maxLength={2000}
            rows={3}
          />
        </div>

        {error && (
          <p className="text-sm text-status-error bg-status-error/10 rounded px-3 py-2">{error}</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>{isJapanese ? 'キャンセル' : 'Cancel'}</Button>
          <Button onClick={handleSubmit} disabled={saving || !title.trim()}>
            {saving ? (isJapanese ? '送信中…' : 'Submitting…') : (isJapanese ? '提案する' : 'Suggest')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
