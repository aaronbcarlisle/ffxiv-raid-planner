import { useState, useCallback, useEffect, useMemo } from 'react';
import { Modal, Checkbox, Label, Select, Input, Spinner, JobIcon, ErrorBox } from '../ui';
import { ItemHoverCard } from '../ui/ItemHoverCard';
import { Tooltip, TooltipProvider, Button } from '../primitives';
import { toast } from '../../stores/toastStore';
import {
  fetchBiSFromXIVGear,
  fetchBiSFromEtro,
  fetchBiSPresets,
  detectBiSSource,
} from '../../services/api';
import { GEAR_SLOT_NAMES, GEAR_SLOT_ICONS, BIS_SOURCE_NAMES } from '../../types';
import type {
  BiSImportData,
  BiSPreset,
  ContentType,
  GearSlotStatus,
  GearSlot,
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
  fromItem: string;  // Item name or source label
  toItem: string;    // Item name or source label
  sourceChanged: boolean;  // True if raid<->tome change
}

/**
 * Detect if a bisLink is a preset format (not a custom URL)
 * Preset formats: 'bis|job|tier' or 'sl|uuid'
 */
const isPresetLink = (link: string): boolean =>
  link.startsWith('bis|') || link.startsWith('sl|');

/**
 * Parse a preset bisLink to extract matching info
 * Returns null if not a preset format
 * Format: bis|job|tier|index (index optional for backward compatibility)
 * or: sl|uuid|setIndex (setIndex optional, defaults to 0)
 */
const parsePresetLink = (link: string): { type: 'bis' | 'sl'; job?: string; tier?: string; index?: number; uuid?: string; setIndex?: number } | null => {
  if (link.startsWith('bis|')) {
    const parts = link.split('|');
    if (parts.length >= 3) {
      const rawIndex = parts.length >= 4 ? parseInt(parts[3], 10) : undefined;
      const index = rawIndex !== undefined && !Number.isNaN(rawIndex) ? rawIndex : undefined;
      return { type: 'bis', job: parts[1], tier: parts[2], index };
    }
  } else if (link.startsWith('sl|')) {
    const parts = link.split('|');
    const uuid = parts[1];
    if (uuid) {
      const rawSetIndex = parts.length >= 3 ? parseInt(parts[2], 10) : undefined;
      const setIndex = rawSetIndex !== undefined && !Number.isNaN(rawSetIndex) ? rawSetIndex : undefined;
      return { type: 'sl', uuid, setIndex };
    }
  }
  return null;
};

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
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<string>('');

  // Fetch presets when modal opens (category determined by tier's contentType)
  // Also handles smart preset matching when player has an existing preset-format bisLink
  useEffect(() => {
    if (isOpen && player.job && player.configured) {
      // Reset state synchronously before async fetch - necessary for proper modal initialization
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPresetsLoading(true);
      setSelectedPresetIndex('');
      setInputValue('');
      fetchBiSPresets(player.job, contentType)
        .then((response) => {
          setPresets(response.presets);

          // Smart preset matching: if player has a preset-format bisLink, try to match it
          const bisLink = player.bisLink;
          if (bisLink && isPresetLink(bisLink)) {
            const parsed = parsePresetLink(bisLink);
            if (parsed) {
              let matchIndex = -1;

              if (parsed.type === 'bis' && parsed.tier) {
                // Match by githubTier and githubIndex (if index is present)
                if (parsed.index !== undefined) {
                  // New format with index - exact match
                  // Note: presets with undefined githubIndex are normalized to 0 when saving,
                  // so we need to compare with that normalization in mind
                  matchIndex = response.presets.findIndex(
                    p => p.githubTier === parsed.tier && (p.githubIndex ?? 0) === parsed.index
                  );
                } else {
                  // Legacy format without index - match first with same tier
                  matchIndex = response.presets.findIndex(p => p.githubTier === parsed.tier);
                }
              } else if (parsed.type === 'sl' && parsed.uuid) {
                // Match by uuid and setIndex
                if (parsed.setIndex !== undefined) {
                  // New format with setIndex - exact match
                  matchIndex = response.presets.findIndex(
                    p => p.uuid === parsed.uuid && (p.setIndex ?? 0) === parsed.setIndex
                  );
                } else {
                  // Legacy format without setIndex - match first with same uuid
                  matchIndex = response.presets.findIndex(p => p.uuid === parsed.uuid);
                }
              }

              if (matchIndex !== -1) {
                setSelectedPresetIndex(String(matchIndex));
                return; // Don't fall through to default selection
              }
            }
          }

          // Default to first preset if:
          // - No bisLink exists (Import BiS case)
          // - bisLink is a preset format but no match found
          // - Don't select a preset if bisLink is a custom URL (handled by bisLink prefill effect)
          if (response.presets.length > 0 && (!bisLink || isPresetLink(bisLink))) {
            setSelectedPresetIndex('0');
          }
        })
        .catch(() => {
          // Silently fail - presets are optional
          setPresets([]);
        })
        .finally(() => {
          setPresetsLoading(false);
        });
    }
  }, [isOpen, player.job, player.configured, player.bisLink, player.id, contentType]);

  // Prefill URL field with existing bisLink when modal opens - but only for custom URLs
  // Preset-format bisLinks (bis|job|tier, sl|uuid) are handled by the preset matching logic above
  useEffect(() => {
    if (isOpen && player.bisLink && !isPresetLink(player.bisLink)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Prefill input from props when modal opens
      setInputValue(player.bisLink);
    }
  }, [isOpen, player.bisLink, player.id]);

  const reset = useCallback(() => {
    // Clear all state - the useEffects will re-initialize properly when modal opens again
    setInputValue('');
    setState('input');
    setError('');
    setPreviewData(null);
    setChanges([]);
    setResetHaveStatus(true);
    setJobMismatch(false);
    setSelectedPresetIndex('');
    setPresets([]);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  // Real-time URL validation
  const urlValidation = useMemo(() => {
    if (!inputValue.trim()) {
      return { isValid: true, hint: null }; // Empty is valid (user might use preset)
    }

    const trimmed = inputValue.trim().toLowerCase();

    // Check for valid URL patterns
    const isXivgear = trimmed.includes('xivgear.app');
    const isEtro = trimmed.includes('etro.gg');

    if (isXivgear || isEtro) {
      // Basic URL structure check
      // XIVGear supports: /share/{uuid}, ?page=sl|{uuid}, ?page=bis|{job}|{tier}
      if (isXivgear && !trimmed.includes('/share/') && !trimmed.includes('page=sl') && !trimmed.includes('page=bis')) {
        return { isValid: false, hint: 'XIVGear links should contain /share/, ?page=sl, or ?page=bis' };
      }
      if (isEtro && !trimmed.includes('/gearset/')) {
        return { isValid: false, hint: 'Etro links should contain /gearset/' };
      }
      return { isValid: true, hint: null };
    }

    // Check if it looks like a UUID (direct paste)
    const uuidPattern = /^[a-f0-9-]{36}$/;
    if (uuidPattern.test(trimmed)) {
      return { isValid: true, hint: 'Detected UUID - will try XIVGear' };
    }

    // Unknown format
    return {
      isValid: false,
      hint: 'Paste a link from xivgear.app or etro.gg'
    };
  }, [inputValue]);

  const handlePreview = async () => {
    // Need either a preset selected or a URL entered
    if (selectedPresetIndex === '' && !inputValue.trim()) return;

    setState('loading');
    setError('');

    try {
      let data: BiSImportData;
      const presetIdx = selectedPresetIndex !== '' ? parseInt(selectedPresetIndex, 10) : null;

      if (presetIdx !== null) {
        const selectedPreset = presets[presetIdx];
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
          data = await fetchBiSFromXIVGear(bisUrl, presetIdx);
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

      // Calculate changes - detect both source changes AND item changes
      const changedSlots: GearChange[] = [];
      for (const slot of data.slots) {
        const currentGear = player.gear.find((g) => g.slot === slot.slot);
        if (!currentGear) continue;

        // Check for source change (raid <-> tome)
        const sourceChanged = currentGear.bisSource !== slot.source;

        // Check for item change (different item name)
        const itemChanged =
          (slot.itemName !== undefined && currentGear.itemName !== undefined && slot.itemName !== currentGear.itemName);

        // Only add to changes if source OR item changed
        if (sourceChanged || itemChanged) {
          changedSlots.push({
            slot: slot.slot,
            slotName: GEAR_SLOT_NAMES[slot.slot] || slot.slot,
            fromItem: currentGear.itemName || (currentGear.bisSource ? BIS_SOURCE_NAMES[currentGear.bisSource] : '--'),
            toItem: slot.itemName || (slot.source && slot.source in BIS_SOURCE_NAMES ? BIS_SOURCE_NAMES[slot.source as keyof typeof BIS_SOURCE_NAMES] : slot.source || '--'),
            sourceChanged,
          });
        }
      }
      setChanges(changedSlots);
      setState('preview');
    } catch (err) {
      setState('error');
      if (err instanceof Error) {
        // Provide user-friendly error messages with guidance
        if (err.message.includes('404') || err.message.includes('not found')) {
          setError(
            'Gear set not found. This usually means:\n' +
            '• The set may be private or deleted\n' +
            '• The link may have expired\n' +
            '• There might be a typo in the URL'
          );
        } else if (err.message.includes('Could not extract UUID') || err.message.includes('Invalid')) {
          setError(
            'Could not read this link. Please paste a valid URL from:\n' +
            '• XIVGear: https://xivgear.app/share/...\n' +
            '• Etro: https://etro.gg/gearset/...'
          );
        } else if (err.message.includes('timeout') || err.message.includes('network')) {
          setError(
            'Could not connect to the gear site. Please:\n' +
            '• Check your internet connection\n' +
            '• Try again in a moment\n' +
            '• The site may be temporarily down'
          );
        } else if (err.message.includes('rate limit')) {
          setError('Too many requests. Please wait a moment and try again.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Something went wrong. Please try again.');
        toast.error('Failed to fetch gear set');
      }
    }
  };

  const handleImport = () => {
    if (!previewData) return;
    const presetIdx = selectedPresetIndex !== '' ? parseInt(selectedPresetIndex, 10) : null;

    // Build new gear array
    const newGear = player.gear.map((currentSlot) => {
      const importedSlot = previewData.slots.find((s) => s.slot === currentSlot.slot);
      if (!importedSlot) return currentSlot;

      // Check if this slot has any change (source OR item) using the changes list
      const hasChange = changes.some((c) => c.slot === currentSlot.slot);
      const shouldResetProgress = resetHaveStatus && hasChange;

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
          } else if (currentSlot.bisSource === 'crafted') {
            currentSource = 'crafted';
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
        materia: importedSlot.materia,
        // Reset progress if checkbox is checked and source changed
        hasItem: effectiveHasItem,
        isAugmented: effectiveIsAugmented,
      };
    });

    // Determine what to store as bisLink
    let bisLink: string;
    if (presetIdx !== null) {
      const selectedPreset = presets[presetIdx];
      if (selectedPreset?.uuid) {
        // Shortlink preset - store the XIVGear shortlink format with set index
        const setIndex = selectedPreset.setIndex ?? 0;
        bisLink = `sl|${selectedPreset.uuid}|${setIndex}`;
      } else if (selectedPreset?.githubTier !== undefined) {
        // GitHub preset - store the curated BiS path with tier file and index
        const index = selectedPreset.githubIndex ?? 0;
        bisLink = `bis|${player.job.toLowerCase()}|${selectedPreset.githubTier}|${index}`;
      } else {
        // Fallback for presets without githubTier (legacy)
        bisLink = `bis|${player.job.toLowerCase()}|current|0`;
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

  // Modal title with job icon and player name
  const modalTitle = (
    <span className="flex items-center gap-2">
      <JobIcon job={player.job} size="sm" />
      <span>{player.bisLink ? 'Update' : 'Import'} BiS for {player.name}</span>
    </span>
  );

  // Build preset options for Select with job icons
  const presetOptions = [
    {
      value: '',
      label: presetsLoading
        ? 'Loading presets...'
        : presets.length === 0
          ? `No presets for ${player.job}`
          : 'Choose a preset...',
    },
    ...presets.map((preset, idx) => ({
      value: String(idx),
      label: preset.name,
      icon: <JobIcon job={player.job} size="xs" />,
    })),
  ];

  const selectedPreset = selectedPresetIndex !== '' ? presets[parseInt(selectedPresetIndex, 10)] : null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={modalTitle}>
      {state === 'input' && (
        <div className="space-y-4">
          {/* Preset dropdown */}
          {player.configured && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="bisPreset">Select a preset</Label>
                <Select
                  id="bisPreset"
                  value={selectedPresetIndex}
                  onChange={(value) => {
                    setSelectedPresetIndex(value);
                    // Clear manual input when preset selected
                    if (value !== '') {
                      setInputValue('');
                    }
                  }}
                  options={presetOptions}
                  disabled={presetsLoading || presets.length === 0}
                />
                {/* Description for selected preset */}
                {selectedPreset?.description && (
                  <p className="mt-1.5 text-xs text-text-muted italic">
                    {selectedPreset.description}
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
            <Label htmlFor="bisLink">
              {player.configured && presets.length > 0
                ? 'Etro or XIVGear link'
                : 'Paste Etro or XIVGear link'}
            </Label>
            <Input
              id="bisLink"
              value={inputValue}
              onChange={(value) => {
                setInputValue(value);
                // Clear preset selection when typing
                if (value) {
                  setSelectedPresetIndex('');
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="https://etro.gg/gearset/..."
              autoFocus={!player.configured || presets.length === 0}
            />
            {/* URL validation hint */}
            {urlValidation.hint && (
              <p className={`mt-1 text-xs ${urlValidation.isValid ? 'text-text-muted' : 'text-status-warning'}`}>
                {urlValidation.hint}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handlePreview}
              disabled={selectedPresetIndex === '' && !inputValue.trim()}
              className="flex-1"
            >
              Preview
            </Button>
          </div>
        </div>
      )}

      {state === 'loading' && (
        <div className="flex flex-col items-center justify-center py-8 gap-4">
          <Spinner size="lg" label="Fetching gear set" />
          <p className="text-text-secondary">Fetching gear set...</p>
        </div>
      )}

      {state === 'error' && (
        <div className="space-y-4">
          <ErrorBox message={error || 'An error occurred'} />
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button type="button" onClick={() => setState('input')} className="flex-1">
              Try Again
            </Button>
          </div>
        </div>
      )}

      {state === 'preview' && previewData && (
        <TooltipProvider>
          <div className="space-y-4">
            {/* Set info with job icon */}
            <div className="p-3 bg-surface-base rounded-lg border border-border-default">
              <div className="flex items-center gap-3">
                <JobIcon job={previewData.job || player.job} size="lg" />
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

            {/* Changes with gear icons */}
            {changes.length > 0 ? (
              <div>
                <h3 className="text-text-secondary text-sm mb-2">Items Changed:</h3>
                <div className="space-y-1">
                  {changes.map((change) => {
                    const newSlotData = previewData.slots.find(s => s.slot === change.slot);
                    const hasItemData = newSlotData?.itemName && newSlotData?.itemLevel;
                    const gearIcon = newSlotData?.itemIcon || GEAR_SLOT_ICONS[change.slot as GearSlot];

                    return (
                      <div
                        key={change.slot}
                        className="flex items-center p-2 bg-surface-base rounded border border-border-default gap-3"
                      >
                        {/* Gear icon with tooltip */}
                        {hasItemData ? (
                          <Tooltip
                            content={
                              <ItemHoverCard
                                itemName={newSlotData.itemName!}
                                itemLevel={newSlotData.itemLevel!}
                                itemIcon={newSlotData.itemIcon}
                                itemStats={newSlotData.itemStats}
                                bisSource={newSlotData.source}
                                materia={newSlotData.materia}
                              />
                            }
                            side="right"
                            sideOffset={8}
                          >
                            <img
                              src={gearIcon}
                              alt={change.slotName}
                              className="w-6 h-6 rounded cursor-pointer shrink-0"
                            />
                          </Tooltip>
                        ) : (
                          <img
                            src={gearIcon}
                            alt={change.slotName}
                            className="w-6 h-6 opacity-60 shrink-0"
                          />
                        )}
                        <span className="text-text-primary font-medium shrink-0 w-16">{change.slotName}</span>
                        <div className="flex items-center gap-2 text-sm min-w-0 flex-1">
                          <span className="text-text-muted truncate" title={change.fromItem}>
                            {change.fromItem}
                          </span>
                          <span className="text-text-muted shrink-0">→</span>
                          <span className="text-text-secondary truncate" title={change.toItem}>
                            {change.toItem}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-surface-base rounded-lg border border-border-default">
                <p className="text-text-secondary text-sm text-center">
                  No changes - all slots already match!
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
              <Button type="button" variant="secondary" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button type="button" onClick={handleImport} className="flex-1">
                Import
              </Button>
            </div>
          </div>
        </TooltipProvider>
      )}
    </Modal>
  );
}
