import { useCallback, useEffect, useMemo, useState } from 'react';
import { Globe, RefreshCw, Search, UserCheck } from 'lucide-react';
import {
  useLodestoneStore,
  type EquippedGearSlot,
  type LodestoneCharacter,
} from '../../stores/lodestoneStore';
import { useTierStore } from '../../stores/tierStore';
import { GEAR_SLOT_NAMES, type GearSlot } from '../../types';
import { Button } from '../primitives';
import { ErrorBox, Input, Modal, Spinner } from '../ui';
import { API_BASE_URL, isProduction } from '../../config';

interface LodestoneSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  playerId: string;
  playerName: string;
  tierId?: string;
  currentLodestoneId?: string | null;
}

interface LodestoneSearchModalBodyProps {
  groupId: string;
  playerId: string;
  playerName: string;
  tierId?: string;
  currentLodestoneId?: string | null;
  onRequestClose: () => void;
}

function formatCurrentSource(source: string): string {
  if (!source || source === 'unknown') {
    return 'Unavailable';
  }

  return source
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function slotLabel(slot: string): string {
  return GEAR_SLOT_NAMES[slot as GearSlot] ?? slot;
}

function hasEquippedItem(slot: EquippedGearSlot): boolean {
  return Boolean(slot.itemId || slot.itemName || slot.itemLevel);
}

function LodestoneSearchModalBody({
  groupId,
  playerId,
  playerName,
  tierId,
  currentLodestoneId,
  onRequestClose,
}: LodestoneSearchModalBodyProps) {
  const [name, setName] = useState(playerName || '');
  const [server, setServer] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<LodestoneCharacter | null>(null);

  const {
    searchResults,
    isSearching,
    searchError,
    characterGear,
    isLoadingGear,
    gearError,
    isSyncing,
    syncError,
    devStatus,
    fetchDevStatus,
    searchCharacters,
    fetchCharacterGear,
    syncPlayerGear,
    clearErrors,
  } = useLodestoneStore();

  const { fetchTier } = useTierStore();

  const linkedLodestoneId = currentLodestoneId ? parseInt(currentLodestoneId, 10) : null;

  const previewSlots = useMemo(
    () => characterGear?.gear ?? [],
    [characterGear]
  );

  const filledPreviewSlots = useMemo(
    () => previewSlots.filter(hasEquippedItem),
    [previewSlots]
  );

  const previewTargetId = characterGear?.lodestoneId ?? selectedCharacter?.lodestoneId ?? linkedLodestoneId;
  const previewTargetName = characterGear?.name || selectedCharacter?.name || playerName;
  const previewTargetServer = characterGear?.server || selectedCharacter?.server || '';

  useEffect(() => {
    void fetchDevStatus();
  }, [fetchDevStatus]);

  const runSearch = useCallback(
    async (searchName: string, searchServer?: string) => {
      const trimmedName = searchName.trim();
      if (trimmedName.length < 2) {
        return;
      }

      setHasSearched(true);
      setSelectedCharacter(null);
      await searchCharacters(trimmedName, searchServer?.trim() || undefined);
    },
    [searchCharacters]
  );

  const handleSearch = useCallback(async () => {
    await runSearch(name, server);
  }, [name, runSearch, server]);

  const handleMockSearch = useCallback(
    async (mockName: string) => {
      setName(mockName);
      setServer('');
      await runSearch(mockName);
    },
    [runSearch]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') {
        void handleSearch();
      }
    },
    [handleSearch]
  );

  const handlePreviewCharacter = useCallback(
    async (character: LodestoneCharacter) => {
      setSelectedCharacter(character);
      clearErrors();
      await fetchCharacterGear(character.lodestoneId);
    },
    [clearErrors, fetchCharacterGear]
  );

  const handlePreviewLinkedCharacter = useCallback(async () => {
    if (!linkedLodestoneId) {
      return;
    }

    setSelectedCharacter({
      lodestoneId: linkedLodestoneId,
      name: playerName,
      server: '',
      avatar: null,
    });
    clearErrors();
    await fetchCharacterGear(linkedLodestoneId);
  }, [clearErrors, fetchCharacterGear, linkedLodestoneId, playerName]);

  const handleSync = useCallback(async () => {
    if (!previewTargetId) {
      return;
    }

    try {
      clearErrors();
      await syncPlayerGear(groupId, playerId, previewTargetId);
      if (tierId) {
        await fetchTier(groupId, tierId);
      }
      onRequestClose();
    } catch {
      // Store state surfaces the error for the modal.
    }
  }, [clearErrors, fetchTier, groupId, onRequestClose, playerId, previewTargetId, syncPlayerGear, tierId]);

  const activeError = searchError || gearError || syncError;
  const showNoResults = hasSearched && !isSearching && searchResults.length === 0 && !searchError;
  const isLinkedPreview = Boolean(linkedLodestoneId && previewTargetId === linkedLodestoneId);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm text-text-secondary">
          Search for a character on Lodestone, preview their equipped gear, then sync the current
          state onto this static card.
        </p>
        {devStatus?.mockMode && (
          <div className="rounded-lg border border-status-info/30 bg-status-info/10 p-3" data-testid="lodestone-dev-mock-hint">
            <p className="text-sm font-medium text-status-info">Dev mock mode enabled</p>
            <p className="mt-1 text-xs text-text-secondary">
              Try one of these local mock characters without calling Lodestone/XIVAPI.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {devStatus.mockSearchNames.map((mockName) => (
                <Button
                  key={mockName}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleMockSearch(mockName)}
                  disabled={isSearching || isLoadingGear || isSyncing}
                  data-testid={`lodestone-mock-search-${mockName.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {mockName}
                </Button>
              ))}
            </div>
          </div>
        )}
        {!isProduction && !devStatus?.mockMode && (
          <div className="rounded-lg border border-border-default bg-surface-elevated p-3" data-testid="lodestone-dev-setup-hint">
            <p className="text-xs text-text-muted">
              Local mock testing is off. Set DEV_LODESTONE_MOCK=true on the backend
              and confirm VITE_API_URL points at {API_BASE_URL}.
            </p>
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={name}
            onChange={setName}
            onKeyDown={handleKeyDown}
            placeholder="Character name"
            fullWidth
          />
          <Input
            value={server}
            onChange={setServer}
            onKeyDown={handleKeyDown}
            placeholder="Server"
            className="sm:w-40"
          />
          <Button
            type="button"
            onClick={() => void handleSearch()}
            disabled={isSearching || name.trim().length < 2}
            leftIcon={<Search className="h-4 w-4" />}
          >
            Search
          </Button>
        </div>
      </div>

      {currentLodestoneId && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Linked character</p>
              <p className="text-xs text-text-muted">
                Lodestone ID: {currentLodestoneId}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handlePreviewLinkedCharacter()}
              disabled={isLoadingGear || isSyncing}
              leftIcon={<RefreshCw className={`h-4 w-4 ${isLoadingGear ? 'animate-spin' : ''}`} />}
            >
              Preview linked character
            </Button>
          </div>
        </div>
      )}

      <ErrorBox message={activeError} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg text-text-primary">Search results</h3>
            {isSearching && (
              <div className="flex items-center gap-2 text-sm text-accent">
                <Spinner size="sm" />
                Searching...
              </div>
            )}
          </div>

          <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border border-border-default bg-surface-card p-2">
            {searchResults.map((character) => {
              const isSelected = previewTargetId === character.lodestoneId;
              return (
                <Button
                  key={character.lodestoneId}
                  type="button"
                  variant={isSelected ? 'accent-subtle' : 'secondary'}
                  className="h-auto w-full justify-start px-3 py-3 text-left"
                  onClick={() => void handlePreviewCharacter(character)}
                  data-testid={`lodestone-search-result-${character.lodestoneId}`}
                >
                  <div className="flex w-full items-center gap-3">
                    {character.avatar ? (
                      <img
                        src={character.avatar}
                        alt=""
                        className="h-10 w-10 rounded-full border border-border-subtle object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border-subtle bg-surface-elevated text-text-muted">
                        <UserCheck className="h-4 w-4" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {character.name}
                      </p>
                      <p className="truncate text-xs text-text-muted">{character.server}</p>
                    </div>
                    <span className="text-xs text-accent">
                      {isSelected ? 'Previewing' : 'Preview'}
                    </span>
                  </div>
                </Button>
              );
            })}

            {!isSearching && !searchResults.length && !showNoResults && (
              <div className="px-3 py-8 text-center text-sm text-text-muted">
                Search for a character to get started.
              </div>
            )}

            {showNoResults && (
              <div className="px-3 py-8 text-center text-sm text-text-muted">
                No characters matched that search.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg text-text-primary">Gear preview</h3>
            {isLoadingGear && (
              <div className="flex items-center gap-2 text-sm text-accent">
                <Spinner size="sm" />
                Loading preview...
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border-default bg-surface-card p-4" data-testid="lodestone-preview-card">
            {!isLoadingGear && !characterGear && (
              <div className="space-y-2 py-8 text-center">
                <p className="text-sm text-text-secondary">
                  Select a character to preview their equipped gear before syncing.
                </p>
                {currentLodestoneId && (
                  <p className="text-xs text-text-muted">
                    Linked characters can be previewed again before re-syncing.
                  </p>
                )}
              </div>
            )}

            {isLoadingGear && (
              <div className="flex items-center justify-center py-10">
                <Spinner />
              </div>
            )}

            {characterGear && !isLoadingGear && (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  {characterGear.avatar ? (
                    <img
                      src={characterGear.avatar}
                      alt=""
                      className="h-12 w-12 rounded-full border border-border-subtle object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border-subtle bg-surface-elevated text-text-muted">
                      <Globe className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-text-primary">
                      {characterGear.name}
                    </p>
                    <p className="text-sm text-text-muted">
                      {[characterGear.server, characterGear.activeJob, characterGear.activeJobLevel]
                        .filter(Boolean)
                        .join(' • ')}
                    </p>
                  </div>
                  {previewTargetId && (
                    <div className="text-right text-xs text-text-muted">
                      <p>Lodestone ID</p>
                      <p className="text-text-secondary">{previewTargetId}</p>
                    </div>
                  )}
                </div>

                {!filledPreviewSlots.length ? (
                  <div className="rounded-lg border border-border-default bg-surface-elevated p-4 text-sm text-text-secondary">
                    No equipped gear details were available for this character.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {previewSlots.map((slot) => (
                        <div
                          key={slot.slot}
                          className="rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs uppercase tracking-wide text-text-muted">
                              {slotLabel(slot.slot)}
                            </p>
                            <p className="text-[11px] text-accent">
                              {formatCurrentSource(slot.currentSource)}
                            </p>
                          </div>
                          <p className="mt-1 text-sm text-text-primary">
                            {hasEquippedItem(slot)
                              ? slot.itemName || 'Unavailable item details'
                              : 'No gear shown'}
                          </p>
                          {slot.itemLevel > 0 && (
                            <p className="mt-1 text-xs text-text-muted">
                              iLv {slot.itemLevel}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-text-muted">
                      Previewing {filledPreviewSlots.length} equipped slot
                      {filledPreviewSlots.length === 1 ? '' : 's'}
                      {previewTargetServer ? ` from ${previewTargetServer}` : ''}.
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={onRequestClose}
                  >
                    Close
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleSync()}
                    disabled={!previewTargetId || isSyncing}
                    loading={isSyncing}
                    leftIcon={!isSyncing ? <RefreshCw className="h-4 w-4" /> : undefined}
                    data-testid="lodestone-sync-button"
                  >
                    {isLinkedPreview ? 'Re-sync linked character' : 'Sync equipped gear'}
                  </Button>
                </div>

                {(syncError || gearError) && previewTargetName && (
                  <p className="text-xs text-text-muted">
                    Preview target: {previewTargetName}
                    {previewTargetServer ? ` (${previewTargetServer})` : ''}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LodestoneSearchModal({
  isOpen,
  onClose,
  groupId,
  playerId,
  playerName,
  tierId,
  currentLodestoneId,
}: LodestoneSearchModalProps) {
  const resetState = useLodestoneStore((state) => state.resetState);

  useEffect(() => {
    resetState();
  }, [currentLodestoneId, isOpen, playerId, resetState]);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={(
        <span className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-accent" />
          Lodestone Sync
        </span>
      )}
      size="3xl"
    >
      {isOpen && (
        <LodestoneSearchModalBody
          key={`${playerId}:${currentLodestoneId ?? 'unlinked'}`}
          groupId={groupId}
          playerId={playerId}
          playerName={playerName}
          tierId={tierId}
          currentLodestoneId={currentLodestoneId}
          onRequestClose={handleClose}
        />
      )}
    </Modal>
  );
}
