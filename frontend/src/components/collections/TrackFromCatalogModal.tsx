import { useState } from 'react';
import { Trophy } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../primitives/Button';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { useCollectionGoalStore } from '../../stores/collectionGoalStore';
import type { CatalogItem, CollectionPriorityMode } from '../../stores/collectionGoalStore';
import { useToastStore } from '../../stores/toastStore';

const PRIORITY_MODE_OPTIONS: { value: CollectionPriorityMode | ''; label: string }[] = [
  { value: 'everyone_gets_one', label: 'Everyone gets one' },
  { value: 'priority_order', label: 'Priority order' },
  { value: 'free_roll', label: 'Free roll' },
  { value: 'desired_only', label: 'Desired only (want/need)' },
  { value: '', label: 'No priority mode' },
];

interface TrackFromCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: CatalogItem;
  groupId: string;
}

export function TrackFromCatalogModal({ isOpen, onClose, item, groupId }: TrackFromCatalogModalProps) {
  const { createGoal } = useCollectionGoalStore();
  const addToast = useToastStore((s) => s.addToast);

  const [priorityMode, setPriorityMode] = useState<CollectionPriorityMode | ''>('everyone_gets_one');
  const [submitting, setSubmitting] = useState(false);

  const goalType = (() => {
    switch (item.category) {
      case 'mount': return 'mount' as const;
      case 'orchestrion': return 'orchestrion' as const;
      case 'minion': return 'minion' as const;
      case 'weapon': return 'weapon' as const;
      case 'title': return 'title' as const;
      case 'glam': return 'glam' as const;
      default: return 'custom_reward' as const;
    }
  })();

  async function handleTrack() {
    setSubmitting(true);
    try {
      await createGoal(groupId, {
        goalType,
        title: item.name,
        status: 'farming',
        priorityMode: priorityMode || null,
        catalogItemId: item.id,
        tokenName: item.tokenName,
        tokenCost: item.tokenCost,
        linkedDutyId: item.sourceDutyKey,
        note: item.notes ?? undefined,
      });
      addToast({ type: 'success', message: `Now tracking: ${item.name}` });
      onClose();
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to create farm goal' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Track Farm Goal" icon={<Trophy size={20} />}>
      <div className="flex flex-col gap-4">
        {/* Item summary */}
        <div className="bg-surface-base rounded-xl p-4 flex flex-col gap-1">
          <p className="font-semibold text-text-primary">{item.name}</p>
          {item.sourceDutyName && (
            <p className="text-sm text-text-secondary">{item.sourceDutyName}</p>
          )}
          {item.tokenCost != null && item.tokenName ? (
            <p className="text-xs text-accent mt-0.5">
              Exchange: {item.tokenCost}× {item.tokenName}
            </p>
          ) : item.notes ? (
            <p className="text-xs text-text-muted mt-0.5">{item.notes}</p>
          ) : null}
        </div>

        <div>
          <Label className="block text-sm text-text-secondary mb-1">Priority mode</Label>
          <Select
            value={priorityMode}
            onChange={(v) => setPriorityMode(v as CollectionPriorityMode | '')}
            options={PRIORITY_MODE_OPTIONS}
          />
          <p className="text-xs text-text-muted mt-1">
            Determines how drops are allocated when the reward is obtained.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleTrack} disabled={submitting}>
            {submitting ? 'Adding…' : 'Track this farm'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
