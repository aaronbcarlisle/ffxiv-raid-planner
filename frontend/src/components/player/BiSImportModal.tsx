import { useState, useCallback, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Checkbox } from '../ui/Checkbox';
import { fetchBiSFromXIVGear } from '../../services/api';
import { GEAR_SLOT_NAMES } from '../../types';
import type { BiSImportData, GearSlotStatus, GearSource, SnapshotPlayer } from '../../types';

interface BiSImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: SnapshotPlayer;
  onImport: (updates: { gear: GearSlotStatus[]; bisLink?: string }) => void;
}

type ModalState = 'input' | 'loading' | 'preview' | 'error';

interface GearChange {
  slot: string;
  slotName: string;
  from: GearSource;
  to: GearSource;
}

export function BiSImportModal({ isOpen, onClose, player, onImport }: BiSImportModalProps) {
  const [inputValue, setInputValue] = useState('');
  const [state, setState] = useState<ModalState>('input');
  const [error, setError] = useState('');
  const [previewData, setPreviewData] = useState<BiSImportData | null>(null);
  const [changes, setChanges] = useState<GearChange[]>([]);
  const [resetHaveStatus, setResetHaveStatus] = useState(false);
  const [jobMismatch, setJobMismatch] = useState(false);

  // Prefill with existing bisLink when modal opens
  useEffect(() => {
    if (isOpen && player.bisLink) {
      setInputValue(player.bisLink);
    }
  }, [isOpen, player.bisLink]);

  const reset = useCallback(() => {
    // Reset to existing bisLink or empty
    setInputValue(player.bisLink || '');
    setState('input');
    setError('');
    setPreviewData(null);
    setChanges([]);
    setResetHaveStatus(false);
    setJobMismatch(false);
  }, [player.bisLink]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handlePreview = async () => {
    if (!inputValue.trim()) return;

    setState('loading');
    setError('');

    try {
      const data = await fetchBiSFromXIVGear(inputValue.trim());
      setPreviewData(data);

      // Check for job mismatch
      if (data.job && data.job.toUpperCase() !== player.job.toUpperCase()) {
        setJobMismatch(true);
      } else {
        setJobMismatch(false);
      }

      // Calculate changes
      const changedSlots: GearChange[] = [];
      for (const slot of data.slots) {
        const currentGear = player.gear.find((g) => g.slot === slot.slot);
        if (currentGear && currentGear.bisSource !== slot.source) {
          changedSlots.push({
            slot: slot.slot,
            slotName: GEAR_SLOT_NAMES[slot.slot] || slot.slot,
            from: currentGear.bisSource,
            to: slot.source,
          });
        }
      }
      setChanges(changedSlots);
      setState('preview');
    } catch (err) {
      setState('error');
      if (err instanceof Error) {
        // Check for common error patterns
        if (err.message.includes('404')) {
          setError('Gear set not found. Please check the link or UUID.');
        } else if (err.message.includes('Could not extract UUID')) {
          setError('Invalid XIVGear link format. Please paste a valid link or UUID.');
        } else if (err.message.includes('timeout')) {
          setError('XIVGear API timed out. Please try again.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to fetch gear set. Please try again.');
      }
    }
  };

  const handleImport = () => {
    if (!previewData) return;

    // Build new gear array
    const newGear = player.gear.map((currentSlot) => {
      const importedSlot = previewData.slots.find((s) => s.slot === currentSlot.slot);
      if (!importedSlot) return currentSlot;

      const sourceChanged = currentSlot.bisSource !== importedSlot.source;
      const shouldResetProgress = resetHaveStatus && sourceChanged;

      return {
        ...currentSlot,
        bisSource: importedSlot.source,
        // Include item metadata from import
        itemName: importedSlot.itemName,
        itemLevel: importedSlot.itemLevel,
        // Reset progress if checkbox is checked and source changed
        hasItem: shouldResetProgress ? false : currentSlot.hasItem,
        isAugmented: shouldResetProgress ? false : currentSlot.isAugmented,
      };
    });

    onImport({
      gear: newGear,
      bisLink: inputValue.trim(),
    });

    handleClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && state === 'input') {
      handlePreview();
    }
  };

  const modalTitle = player.bisLink ? 'Update BiS from XIVGear' : 'Import BiS from XIVGear';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={modalTitle}>
      {state === 'input' && (
        <div className="space-y-4">
          <div>
            <label htmlFor="bisLink" className="block text-text-secondary mb-1 text-sm">
              Paste XIVGear link or UUID
            </label>
            <input
              id="bisLink"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://xivgear.app/?page=bis|drg|current"
              className="w-full bg-bg-primary border border-border-default rounded-lg px-4 py-2 text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              autoFocus
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 bg-bg-primary border border-border-default px-4 py-2 rounded-lg text-text-secondary hover:text-text-primary hover:border-text-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePreview}
              disabled={!inputValue.trim()}
              className="flex-1 bg-accent text-bg-primary px-4 py-2 rounded-lg font-medium hover:bg-accent-bright disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Preview
            </button>
          </div>
        </div>
      )}

      {state === 'loading' && (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-text-secondary">Fetching gear set...</p>
        </div>
      )}

      {state === 'error' && (
        <div className="space-y-4">
          <div className="p-4 bg-status-error/10 border border-status-error/30 rounded-lg">
            <p className="text-status-error">{error}</p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 bg-bg-primary border border-border-default px-4 py-2 rounded-lg text-text-secondary hover:text-text-primary hover:border-text-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setState('input')}
              className="flex-1 bg-accent text-bg-primary px-4 py-2 rounded-lg font-medium hover:bg-accent-bright"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {state === 'preview' && previewData && (
        <div className="space-y-4">
          {/* Set info */}
          <div className="p-3 bg-bg-primary rounded-lg border border-border-default">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-text-primary font-medium">{previewData.name}</div>
                <div className="text-text-secondary text-sm">{previewData.job}</div>
              </div>
            </div>
          </div>

          {/* Job mismatch warning */}
          {jobMismatch && (
            <div className="p-3 bg-status-warning/10 border border-status-warning/30 rounded-lg">
              <p className="text-status-warning text-sm">
                This set is for <span className="font-medium">{previewData.job}</span>, but player is{' '}
                <span className="font-medium">{player.job}</span>. Import anyway?
              </p>
            </div>
          )}

          {/* Changes */}
          {changes.length > 0 ? (
            <div>
              <h3 className="text-text-secondary text-sm mb-2">Source Changes:</h3>
              <div className="space-y-1">
                {changes.map((change) => (
                  <div
                    key={change.slot}
                    className="flex items-center justify-between p-2 bg-bg-primary rounded border border-border-default"
                  >
                    <span className="text-text-primary">{change.slotName}</span>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={change.from === 'raid' ? 'text-source-raid' : 'text-accent'}>
                        {change.from === 'raid' ? 'Raid' : 'Tome'}
                      </span>
                      <span className="text-text-muted">→</span>
                      <span className={change.to === 'raid' ? 'text-source-raid' : 'text-accent'}>
                        {change.to === 'raid' ? 'Raid' : 'Tome'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-bg-primary rounded-lg border border-border-default">
              <p className="text-text-secondary text-sm text-center">
                No source changes - all slots already match!
              </p>
            </div>
          )}

          {/* Reset checkbox */}
          {changes.length > 0 && (
            <Checkbox
              checked={resetHaveStatus}
              onChange={setResetHaveStatus}
              label='Reset "Have" status for changed slots'
            />
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 bg-bg-primary border border-border-default px-4 py-2 rounded-lg text-text-secondary hover:text-text-primary hover:border-text-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              className="flex-1 bg-accent text-bg-primary px-4 py-2 rounded-lg font-medium hover:bg-accent-bright"
            >
              Import
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
