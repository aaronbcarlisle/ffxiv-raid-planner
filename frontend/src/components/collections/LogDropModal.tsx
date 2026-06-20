import { useState } from 'react';
import { Droplets } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../primitives/Button';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import type { CollectionGoal, ParticipantStateEntry } from '../../stores/collectionGoalStore';
import { useToastStore } from '../../stores/toastStore';

interface LogDropModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: CollectionGoal;
  groupId: string;
  participants: ParticipantStateEntry[];
}

export function LogDropModal({ isOpen, onClose, goal, groupId, participants }: LogDropModalProps) {
  const { logDrop } = useCollectionGoalStore();
  const addToast = useToastStore((s) => s.addToast);

  const [recipientId, setRecipientId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const needWantOptions = participants
    .filter((p) => p.state === 'need' || p.state === 'want')
    .sort((a, b) => (a.priorityRank ?? 999) - (b.priorityRank ?? 999));

  const allOptions = participants;

  const options = [
    { value: '', label: 'No specific recipient' },
    ...(needWantOptions.length > 0
      ? needWantOptions.map((p) => ({
          value: p.userId,
          label: `${p.displayName ?? p.userId} (${p.state}${p.priorityRank != null ? ` · #${p.priorityRank}` : ''})`,
        }))
      : allOptions.map((p) => ({
          value: p.userId,
          label: `${p.displayName ?? p.userId} (${p.state})`,
        }))),
  ];

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await logDrop(groupId, goal.id, {
        recipientUserId: recipientId || null,
        notes: notes.trim() || null,
      });
      addToast({ type: 'success', message: 'Drop logged!' });
      onClose();
      setRecipientId('');
      setNotes('');
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to log drop' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log Drop" icon={<Droplets size={20} />}>
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-text-secondary mb-1">Reward</p>
          <p className="text-text-primary font-medium">{goal.title}</p>
        </div>

        <div>
          <Label className="block text-sm text-text-secondary mb-1">Recipient</Label>
          <Select
            value={recipientId}
            onChange={setRecipientId}
            options={options}
          />
          {recipientId && (
            <p className="mt-1 text-xs text-text-muted">
              Logging a drop will automatically set their status to &quot;have&quot; if they currently need or want it.
            </p>
          )}
        </div>

        <div>
          <Label className="block text-sm text-text-secondary mb-1">Notes (optional)</Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Week 3 clear, lucky roll"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Logging…' : 'Log Drop'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
