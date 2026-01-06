import { useState, useCallback, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Checkbox } from '../ui/Checkbox';
import { toast } from '../../stores/toastStore';
import {
  fetchBiSFromXIVGear,
  fetchBiSFromEtro,
  fetchBiSPresets,
  detectBiSSource,
} from '../../services/api';
import { GEAR_SLOT_NAMES } from '../../types';
import type {
  BiSImportData,
  BiSPreset,
  ContentType,
  GearSlotStatus,
  GearSource,
  SnapshotPlayer,
} from '../../types';

// Balance URL role mapping for job guide links
const BALANCE_ROLE_MAP: Record<string, string> = {
  // Tanks
  PLD: 'tanks/paladin',
  WAR: 'tanks/warrior',
  DRK: 'tanks/dark-knight',
  GNB: 'tanks/gunbreaker',
  // Healers
  WHM: 'healers/white-mage',
  SCH: 'healers/scholar',
  AST: 'healers/astrologian',
  SGE: 'healers/sage',
  // Melee
  MNK: 'melee/monk',
  DRG: 'melee/dragoon',
  NIN: 'melee/ninja',
  SAM: 'melee/samurai',
  RPR: 'melee/reaper',
  VPR: 'melee/viper',
  // Ranged
  BRD: 'ranged/bard',
  MCH: 'ranged/machinist',
  DNC: 'ranged/dancer',
  // Casters
  BLM: 'casters/black-mage',
  SMN: 'casters/summoner',
  RDM: 'casters/red-mage',
  PCT: 'casters/pictomancer',
};

function getBalanceGuideUrl(job: string): string {
  const path = BALANCE_ROLE_MAP[job.toUpperCase()];
  if (!path) return 'https://www.thebalanceffxiv.com/';
  return `https://www.thebalanceffxiv.com/jobs/${path}/best-in-slot/`;
}

interface BiSImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: SnapshotPlayer;
  contentType: ContentType;
  onImport: (updates: { gear: GearSlotStatus[]; bisLink?: string }) => void;
}

type ModalState = 'input' | 'loading' | 'preview' | 'error';

interface GearChange {
  slot: string;
  slotName: string;
  from: GearSource;
  to: GearSource;
}

export function BiSImportModal({ isOpen, onClose, player, contentType, onImport }: BiSImportModalProps) {
  const [inputValue, setInputValue] = useState('');
  const [state, setState] = useState<ModalState>('input');
  const [error, setError] = useState('');
  const [previewData, setPreviewData] = useState<BiSImportData | null>(null);
  const [changes, setChanges] = useState<GearChange[]>([]);
  const [resetHaveStatus, setResetHaveStatus] = useState(true);
  const [jobMismatch, setJobMismatch] = useState(false);

  // Preset state
  const [presets, setPresets] = useState<BiSPreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number | null>(null);

  // Fetch presets when modal opens (category determined by tier's contentType)
  useEffect(() => {
    if (isOpen && player.job && player.configured) {
      setPresetsLoading(true);
      setSelectedPresetIndex(null);
      fetchBiSPresets(player.job, contentType)
        .then((response) => {
          setPresets(response.presets);
        })
        .catch(() => {
          // Silently fail - presets are optional
          setPresets([]);
        })
        .finally(() => {
          setPresetsLoading(false);
        });
    }
  }, [isOpen, player.job, player.configured, contentType]);

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
    setResetHaveStatus(true);
    setJobMismatch(false);
    setSelectedPresetIndex(null);
  }, [player.bisLink]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handlePreview = async () => {
    // Need either a preset selected or a URL entered
    if (selectedPresetIndex === null && !inputValue.trim()) return;

    setState('loading');
    setError('');

    try {
      let data: BiSImportData;

      if (selectedPresetIndex !== null) {
        const selectedPreset = presets[selectedPresetIndex];
        if (selectedPreset?.uuid) {
          // Shortlink preset with direct XIVGear UUID
          data = await fetchBiSFromXIVGear(selectedPreset.uuid, selectedPreset.setIndex ?? 0);
        } else if (selectedPreset?.githubTier !== undefined) {
          // GitHub preset - use curated BiS URL format with tier file
          const bisUrl = `bis|${player.job.toLowerCase()}|${selectedPreset.githubTier}`;
          data = await fetchBiSFromXIVGear(bisUrl, selectedPreset.githubIndex ?? 0);
        } else {
          // Fallback for presets without githubTier (legacy)
          const bisUrl = `bis|${player.job.toLowerCase()}|current`;
          data = await fetchBiSFromXIVGear(bisUrl, selectedPresetIndex);
        }
      } else {
        // Detect source and call appropriate API
        const source = detectBiSSource(inputValue.trim());
        if (source === 'etro') {
          data = await fetchBiSFromEtro(inputValue.trim());
        } else {
          data = await fetchBiSFromXIVGear(inputValue.trim());
        }
      }
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
          setError('Invalid link format. Please paste a valid Etro or XIVGear link.');
        } else if (err.message.includes('timeout')) {
          setError('API timed out. Please try again.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to fetch gear set. Please try again.');
        toast.error('Failed to fetch gear set');
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

      // Determine effective hasItem and isAugmented after import
      const effectiveHasItem = shouldResetProgress ? false : currentSlot.hasItem;
      const effectiveIsAugmented = shouldResetProgress ? false : currentSlot.isAugmented;

      // Infer currentSource based on current state
      // If player has gear, infer from the OLD bisSource (what they actually acquired)
      // not the new import target. Otherwise default to 'crafted'.
      let currentSource = currentSlot.currentSource;
      if (!currentSource || currentSource === 'unknown' || shouldResetProgress) {
        if (effectiveHasItem) {
          // Use currentSlot.bisSource - the gear they have was acquired for the old BiS
          if (currentSlot.bisSource === 'raid') {
            currentSource = 'savage';
          } else {
            currentSource = effectiveIsAugmented ? 'tome_up' : 'tome';
          }
        } else {
          currentSource = 'crafted';
        }
      }

      return {
        ...currentSlot,
        bisSource: importedSlot.source,
        currentSource,
        // Include item metadata from import
        itemName: importedSlot.itemName,
        itemLevel: importedSlot.itemLevel,
        itemIcon: importedSlot.itemIcon,
        itemStats: importedSlot.itemStats,
        // Reset progress if checkbox is checked and source changed
        hasItem: effectiveHasItem,
        isAugmented: effectiveIsAugmented,
      };
    });

    // Determine what to store as bisLink
    let bisLink: string;
    if (selectedPresetIndex !== null) {
      const selectedPreset = presets[selectedPresetIndex];
      if (selectedPreset?.uuid) {
        // Shortlink preset - store the XIVGear shortlink format
        bisLink = `sl|${selectedPreset.uuid}`;
      } else if (selectedPreset?.githubTier !== undefined) {
        // GitHub preset - store the curated BiS path with tier file
        bisLink = `bis|${player.job.toLowerCase()}|${selectedPreset.githubTier}`;
      } else {
        // Fallback for presets without githubTier (legacy)
        bisLink = `bis|${player.job.toLowerCase()}|current`;
      }
    } else {
      bisLink = inputValue.trim();
    }

    onImport({
      gear: newGear,
      bisLink,
    });

    toast.success('BiS imported successfully!');
    handleClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && state === 'input') {
      handlePreview();
    }
  };

  const modalTitle = player.bisLink ? 'Update BiS' : 'Import BiS';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={modalTitle}>
      {state === 'input' && (
        <div className="space-y-4">
          {/* Preset dropdown */}
          {player.configured && (
            <div className="space-y-3">
              <div>
                <label htmlFor="bisPreset" className="block text-text-secondary mb-1 text-sm">
                  Select a preset
                </label>
                <select
                id="bisPreset"
                value={selectedPresetIndex ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedPresetIndex(value === '' ? null : parseInt(value, 10));
                  // Clear manual input when preset selected
                  if (value !== '') {
                    setInputValue('');
                  }
                }}
                disabled={presetsLoading || presets.length === 0}
                className="w-full bg-surface-base border border-border-default rounded-lg px-4 py-2 text-text-primary focus:border-accent focus:outline-none disabled:opacity-50"
              >
                <option value="">
                  {presetsLoading
                    ? 'Loading presets...'
                    : presets.length === 0
                      ? `No presets for ${player.job}`
                      : 'Choose a preset...'}
                </option>
                {presets.map((preset, idx) => (
                  <option key={preset.index} value={idx}>
                    {preset.name}
                  </option>
                ))}
              </select>
              {/* Description for selected preset */}
              {selectedPresetIndex !== null && presets[selectedPresetIndex]?.description && (
                <p className="mt-1.5 text-xs text-text-muted italic">
                  {presets[selectedPresetIndex].description}
                </p>
              )}
              {/* Attribution line - only show when presets loaded */}
              {!presetsLoading && presets.length > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-text-muted">
                  <span>Presets curated by</span>
                  <a
                    href={getBalanceGuideUrl(player.job)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent-bright hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    The Balance
                  </a>
                  <span className="text-text-muted/50">→</span>
                  <a
                    href={getBalanceGuideUrl(player.job)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:text-accent-bright hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View {player.job} guide
                  </a>
                </div>
              )}
              </div>
            </div>
          )}

          {/* Divider */}
          {player.configured && presets.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-border-default" />
              <span className="text-text-muted text-xs">or paste a link</span>
              <div className="flex-1 border-t border-border-default" />
            </div>
          )}

          {/* Manual URL input */}
          <div>
            <label htmlFor="bisLink" className="block text-text-secondary mb-1 text-sm">
              {player.configured && presets.length > 0
                ? 'Etro or XIVGear link'
                : 'Paste Etro or XIVGear link'}
            </label>
            <input
              id="bisLink"
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                // Clear preset selection when typing
                if (e.target.value) {
                  setSelectedPresetIndex(null);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="https://etro.gg/gearset/..."
              className="w-full bg-surface-base border border-border-default rounded-lg px-4 py-2 text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              autoFocus={!player.configured || presets.length === 0}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 bg-surface-base border border-border-default px-4 py-2 rounded-lg text-text-secondary hover:text-text-primary hover:border-text-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePreview}
              disabled={selectedPresetIndex === null && !inputValue.trim()}
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
              className="flex-1 bg-surface-base border border-border-default px-4 py-2 rounded-lg text-text-secondary hover:text-text-primary hover:border-text-muted"
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
          <div className="p-3 bg-surface-base rounded-lg border border-border-default">
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
                    className="flex items-center justify-between p-2 bg-surface-base rounded border border-border-default"
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
            <div className="p-3 bg-surface-base rounded-lg border border-border-default">
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
              className="flex-1 bg-surface-base border border-border-default px-4 py-2 rounded-lg text-text-secondary hover:text-text-primary hover:border-text-muted"
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
