import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Globe, RefreshCw, Search, UserCheck } from 'lucide-react';
import {
  useLodestoneStore,
  type EquippedGearSlot,
  type LodestoneCharacter,
  type SyncResult,
} from '../../stores/lodestoneStore';
import { useTierPlayers, useTierStore } from '../../stores/tierStore';
import { GEAR_SLOT_NAMES, type GearSlot, type GearSlotStatus } from '../../types';
import { Button } from '../primitives';
import { ErrorBox, Input, Modal, Spinner } from '../ui';
import { API_BASE_URL, isProduction } from '../../config';
import { computeSyncWarnings, parseLodestoneCharacterId } from '../../utils/lodestone';

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

type BiSMatchStatus = 'match' | 'upgrade_needed' | 'no_target' | 'unknown';

function getBiSMatchStatus(
  previewSlot: EquippedGearSlot,
  bisSlot: GearSlotStatus | undefined,
): BiSMatchStatus {
  if (!bisSlot || !bisSlot.bisSource) {
    return 'no_target';
  }
  if (!hasEquippedItem(previewSlot)) {
    return 'unknown';
  }
  const bisItemId = bisSlot.itemId;
  const equippedItemId = previewSlot.itemId;
  if (bisItemId && equippedItemId) {
    return bisItemId === equippedItemId ? 'match' : 'upgrade_needed';
  }
  // Source + ilvl fallback for manual configs without specific item IDs.
  return 'unknown';
}

const BIS_MATCH_BADGES: Record<BiSMatchStatus, { label: string; className: string }> = {
  match: { label: 'BiS ✓', className: 'text-status-success' },
  upgrade_needed: { label: 'Upgrade needed', className: 'text-status-warning' },
  no_target: { label: 'No BiS target', className: 'text-text-muted' },
  unknown: { label: '', className: '' },
};

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
  const [manualCharacterInput, setManualCharacterInput] = useState('');
  const [manualInputError, setManualInputError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<LodestoneCharacter | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [pendingSyncWarnings, setPendingSyncWarnings] = useState<string[] | null>(null);

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
    linkIdentityOnly,
    clearErrors,
  } = useLodestoneStore();

  const { fetchTier } = useTierStore();
  const tierPlayers = useTierPlayers();
  const currentPlayer = useMemo(
    () => tierPlayers.find((p) => p.id === playerId) ?? null,
    [tierPlayers, playerId]
  );
  const playerBisGear = useMemo((): GearSlotStatus[] => {
    return currentPlayer?.gear ?? [];
  }, [currentPlayer]);

  const linkedLodestoneId = currentLodestoneId ? parseInt(currentLodestoneId, 10) : null;

  const previewSlots = useMemo(
    () => characterGear?.gear ?? [],
    [characterGear]
  );

  const filledPreviewSlots = useMemo(
    () => previewSlots.filter(hasEquippedItem),
    [previewSlots]
  );

  const currentAvgIlv = useMemo(() => {
    const slots = filledPreviewSlots.filter((s) => s.itemLevel > 0);
    if (!slots.length) return null;
    return Math.round(slots.reduce((sum, s) => sum + s.itemLevel, 0) / slots.length);
  }, [filledPreviewSlots]);

  const bisTargetAvgIlv = useMemo(() => {
    const slots = playerBisGear.filter((g) => g.bisSource && (g.itemLevel ?? 0) > 0);
    if (!slots.length) return null;
    return Math.round(slots.reduce((sum, g) => sum + (g.itemLevel ?? 0), 0) / slots.length);
  }, [playerBisGear]);

  const bisMatchedCount = useMemo(
    () =>
      previewSlots.filter((slot) => {
        const bisSlot = playerBisGear.find((g) => g.slot === slot.slot);
        return getBiSMatchStatus(slot, bisSlot) === 'match';
      }).length,
    [previewSlots, playerBisGear]
  );

  const totalConfiguredBisSlots = useMemo(
    () => playerBisGear.filter((g) => g.bisSource).length,
    [playerBisGear]
  );

  const storedAvgIlv = useMemo(() => {
    const slots = playerBisGear.filter((g) => (g.equippedItemLevel ?? 0) > 0);
    if (!slots.length) return null;
    return Math.round(slots.reduce((sum, g) => sum + (g.equippedItemLevel ?? 0), 0) / slots.length);
  }, [playerBisGear]);

  const previewTargetId = characterGear?.lodestoneId ?? selectedCharacter?.lodestoneId ?? linkedLodestoneId;
  const previewTargetName = characterGear?.name || selectedCharacter?.name || playerName;
  const previewTargetServer = characterGear?.server || selectedCharacter?.server || '';
  const canLinkIdentityOnly = Boolean(
    previewTargetId &&
    (gearError === 'upstream_character_unavailable' || characterGear?.identityOnly) &&
    selectedCharacter
  );

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
      setManualInputError(null);
      clearErrors();
      await fetchCharacterGear(character.lodestoneId);
    },
    [clearErrors, fetchCharacterGear]
  );

  const handlePreviewManualCharacter = useCallback(async () => {
    const parsedId = parseLodestoneCharacterId(manualCharacterInput);
    if (!parsedId) {
      setManualInputError('Paste a valid Lodestone character URL or numeric character ID.');
      return;
    }

    setManualInputError(null);
    setSelectedCharacter({
      lodestoneId: parsedId,
      name: `Lodestone #${parsedId}`,
      server: '',
      avatar: null,
    });
    clearErrors();
    await fetchCharacterGear(parsedId);
  }, [clearErrors, fetchCharacterGear, manualCharacterInput]);

  const handlePreviewLinkedCharacter = useCallback(async (forceRefresh?: boolean) => {
    if (!linkedLodestoneId) {
      return;
    }

    setSelectedCharacter({
      lodestoneId: linkedLodestoneId,
      name: playerName,
      server: '',
      avatar: null,
    });
    setManualInputError(null);
    clearErrors();
    await fetchCharacterGear(linkedLodestoneId, forceRefresh);
  }, [clearErrors, fetchCharacterGear, linkedLodestoneId, playerName]);

  const getSyncWarnings = useCallback((): string[] => {
    if (!characterGear) return [];
    return computeSyncWarnings({
      upstreamJob: characterGear.activeJob,
      playerJob: currentPlayer?.job ?? null,
      upstreamAvgIlv: currentAvgIlv,
      storedAvgIlv,
      upstreamSlotCount: filledPreviewSlots.length,
      upstreamServer: characterGear.server,
      linkedServer: currentPlayer?.lodestoneServer ?? null,
      upstreamName: characterGear.name,
      linkedName: currentPlayer?.lodestoneName ?? null,
    });
  }, [characterGear, currentPlayer, currentAvgIlv, storedAvgIlv, filledPreviewSlots]);

  const executeSync = useCallback(async () => {
    if (!previewTargetId) return;
    try {
      clearErrors();
      const result = await syncPlayerGear(groupId, playerId, previewTargetId);
      setLastSyncResult(result);
      setPendingSyncWarnings(null);
      if (tierId) {
        await fetchTier(groupId, tierId);
      }
      if (!result.jobMismatchWarning && result.payloadChanged) {
        onRequestClose();
      }
    } catch {
      // Store state surfaces the error for the modal.
    }
  }, [clearErrors, fetchTier, groupId, onRequestClose, playerId, previewTargetId, syncPlayerGear, tierId]);

  const handleSync = useCallback(async () => {
    if (!previewTargetId) return;
    const warnings = getSyncWarnings();
    if (warnings.length > 0) {
      setPendingSyncWarnings(warnings);
      return;
    }
    await executeSync();
  }, [previewTargetId, getSyncWarnings, executeSync]);

  const handleLinkIdentityOnly = useCallback(async () => {
    if (!previewTargetId) {
      return;
    }

    try {
      clearErrors();
      await linkIdentityOnly(groupId, playerId, previewTargetId);
      if (tierId) {
        await fetchTier(groupId, tierId);
      }
      onRequestClose();
    } catch {
      // Store state surfaces the error for the modal.
    }
  }, [clearErrors, fetchTier, groupId, linkIdentityOnly, onRequestClose, playerId, previewTargetId, tierId]);

  const activeError = searchError || gearError || syncError;
  const displayError =
    activeError === 'upstream_character_unavailable'
      ? 'Live character providers could not fetch this character. Try mock mode for local visual testing, or try again later.'
      : activeError;
  const liveSearchUnavailable =
    searchError === 'upstream_private' ||
    searchError === 'upstream_unavailable' ||
    searchError === 'upstream_bad_response';
  const showLiveSearchFailureHint = Boolean(
    !isProduction && !devStatus?.mockMode && searchError
  );
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
              Live search is disabled in mock mode. Search one of these local mock characters
              without calling Lodestone/XIVAPI.
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
        <div className="rounded-lg border border-border-default bg-surface-elevated p-3">
          <p className="mb-2 text-xs text-text-muted">
            If search fails, open your character on Lodestone and paste the profile URL here.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={manualCharacterInput}
              onChange={(value) => {
                setManualCharacterInput(value);
                setManualInputError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handlePreviewManualCharacter();
                }
              }}
              placeholder="https://na.finalfantasyxiv.com/lodestone/character/12345678/ or 12345678"
              error={manualInputError ?? undefined}
              fullWidth
              data-testid="lodestone-manual-id-input"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handlePreviewManualCharacter()}
              disabled={isLoadingGear || isSyncing || !manualCharacterInput.trim()}
              data-testid="lodestone-manual-preview-button"
            >
              Preview by URL/ID
            </Button>
          </div>
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
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handlePreviewLinkedCharacter()}
                disabled={isLoadingGear || isSyncing}
                leftIcon={<RefreshCw className={`h-4 w-4 ${isLoadingGear ? 'animate-spin' : ''}`} />}
              >
                Preview
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handlePreviewLinkedCharacter(true)}
                disabled={isLoadingGear || isSyncing}
                data-testid="lodestone-force-refresh-button"
                title="Bypasses the preview cache and fetches fresh data from Tomestone. If Tomestone's data is stale, you may need to refresh the character on tomestone.gg directly."
              >
                Force refresh
              </Button>
            </div>
          </div>
          {characterGear?.refreshAttempted && characterGear.refreshStatus && characterGear.refreshStatus !== 'refresh_queued' && (
            <p className="mt-2 text-xs text-status-warning" data-testid="lodestone-refresh-status">
              {characterGear.refreshStatus === 'not_supported'
                ? 'Automatic Tomestone refresh is not available. Visit the character page on tomestone.gg and click Refresh there.'
                : 'Tomestone refresh failed. You may need to refresh the character on tomestone.gg directly.'}
            </p>
          )}
        </div>
      )}

      <ErrorBox message={displayError} />
      {canLinkIdentityOnly && (
        <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 p-3" data-testid="lodestone-identity-only-fallback">
          <p className="text-sm font-medium text-status-warning">
            Character found, but gear sync is unavailable right now.
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            This character identity can still be linked from Lodestone. Gear, BiS completion, and sync status will stay unchanged.
          </p>
          <div className="mt-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleLinkIdentityOnly()}
              disabled={isSyncing}
              loading={isSyncing}
              data-testid="lodestone-link-identity-only-button"
            >
              Link identity only
            </Button>
          </div>
        </div>
      )}
      {showLiveSearchFailureHint && (
        <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 p-3" data-testid="lodestone-live-search-failure-hint">
          <p className="text-xs text-status-warning">
            {liveSearchUnavailable
              ? 'Live Lodestone search is unavailable right now. You can paste a Lodestone character URL or ID instead.'
              : 'Live Lodestone/XIVAPI search failed. Try DEV_LODESTONE_MOCK=true for local visual testing, or check backend logs.'}
          </p>
        </div>
      )}

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
            <h3 className="font-display text-lg text-text-primary">Current equipped gear</h3>
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

                {characterGear.identityOnly ? (
                  <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 p-4 text-sm text-text-secondary" data-testid="lodestone-identity-only-preview">
                    <p className="font-medium text-status-warning">
                      Character found, but gear sync is unavailable right now.
                    </p>
                    <p className="mt-1 text-xs">
                      You can link the identity/avatar only, then try gear sync again later.
                    </p>
                  </div>
                ) : !filledPreviewSlots.length ? (
                  <div className="rounded-lg border border-border-default bg-surface-elevated p-4 text-sm text-text-secondary">
                    No equipped gear details were available for this character.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* iLv + BiS match summary */}
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2">
                      {currentAvgIlv != null && (
                        <span className="text-xs text-text-muted">
                          Current avg iLv{' '}
                          <span className="font-semibold text-text-primary">{currentAvgIlv}</span>
                        </span>
                      )}
                      {bisTargetAvgIlv != null && (
                        <span className="text-xs text-text-muted">
                          BiS target avg iLv{' '}
                          <span className="font-semibold text-text-primary">{bisTargetAvgIlv}</span>
                        </span>
                      )}
                      {totalConfiguredBisSlots > 0 && (
                        <span className="text-xs text-text-muted">
                          BiS matched{' '}
                          <span className={`font-semibold ${bisMatchedCount === totalConfiguredBisSlots ? 'text-status-success' : 'text-text-primary'}`}>
                            {bisMatchedCount}/{totalConfiguredBisSlots}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Per-slot comparison grid */}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {previewSlots.map((slot) => {
                        const bisSlot = playerBisGear.find((g) => g.slot === slot.slot);
                        const bisStatus = getBiSMatchStatus(slot, bisSlot);
                        const badge = BIS_MATCH_BADGES[bisStatus];
                        const borderClass =
                          bisStatus === 'match'
                            ? 'border-status-success/30'
                            : bisStatus === 'upgrade_needed'
                              ? 'border-status-warning/25'
                              : 'border-border-subtle';
                        return (
                          <div
                            key={slot.slot}
                            className={`rounded-lg border bg-surface-elevated px-3 py-2 ${borderClass}`}
                          >
                            {/* Slot label + source */}
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs uppercase tracking-wide text-text-muted">
                                {slotLabel(slot.slot)}
                              </p>
                              <p className="text-[11px] text-accent">
                                {formatCurrentSource(slot.currentSource)}
                              </p>
                            </div>

                            {/* Currently equipped item */}
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <p className="truncate text-sm text-text-primary">
                                {hasEquippedItem(slot)
                                  ? slot.itemName || 'Unavailable item details'
                                  : 'No gear shown'}
                              </p>
                              {slot.itemLevel > 0 && (
                                <p className="shrink-0 text-xs text-text-muted">
                                  iLv {slot.itemLevel}
                                </p>
                              )}
                            </div>

                            {/* BiS target row — only shown when a better item is needed */}
                            {bisStatus === 'upgrade_needed' && bisSlot?.itemName && (
                              <div className="mt-0.5 flex items-center justify-between gap-2">
                                <p className="truncate text-[11px] text-text-muted">
                                  → {bisSlot.itemName}
                                </p>
                                {(bisSlot.itemLevel ?? 0) > 0 && (
                                  <p className="shrink-0 text-[11px] text-text-muted">
                                    iLv {bisSlot.itemLevel}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* BiS match status badge */}
                            {badge.label && (
                              <p className={`mt-1 text-right text-[11px] font-medium ${badge.className}`}>
                                {badge.label}
                              </p>
                            )}
                          </div>
                        );
                      })}
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
                    disabled={!previewTargetId || isSyncing || !characterGear.gearAvailable}
                    loading={isSyncing}
                    leftIcon={!isSyncing ? <RefreshCw className="h-4 w-4" /> : undefined}
                    data-testid="lodestone-sync-button"
                  >
                    {isLinkedPreview ? 'Re-sync linked character' : 'Import current gear'}
                  </Button>
                </div>

                {pendingSyncWarnings && pendingSyncWarnings.length > 0 && (
                  <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 p-4" data-testid="lodestone-sync-confirmation">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-warning" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-status-warning">
                          This sync may overwrite your saved gear
                        </p>
                        <ul className="mt-2 space-y-1">
                          {pendingSyncWarnings.map((warning) => (
                            <li key={warning} className="text-xs text-text-secondary">
                              {warning}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-xs text-text-muted">
                          Continue only if you intentionally want to overwrite.
                        </p>
                        <div className="mt-3 flex gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setPendingSyncWarnings(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void executeSync()}
                            loading={isSyncing}
                            data-testid="lodestone-sync-confirm-overwrite"
                          >
                            Overwrite anyway
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {lastSyncResult?.jobMismatchWarning && (
                  <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 p-3" data-testid="lodestone-job-mismatch-warning">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" />
                      <div>
                        <p className="text-sm font-medium text-status-warning">Job mismatch detected</p>
                        <p className="mt-1 text-xs text-text-secondary">{lastSyncResult.jobMismatchWarning}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="mt-2"
                      onClick={onRequestClose}
                    >
                      Close anyway
                    </Button>
                  </div>
                )}
                {lastSyncResult && !lastSyncResult.payloadChanged && !lastSyncResult.jobMismatchWarning && (
                  <div className="rounded-lg border border-status-info/30 bg-status-info/10 p-3" data-testid="lodestone-stale-data-notice">
                    <p className="text-xs text-status-info">
                      Provider returned the same gear as last sync. Lodestone may still be showing old data.
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="mt-2"
                      onClick={onRequestClose}
                    >
                      Close
                    </Button>
                  </div>
                )}
                {lastSyncResult && (
                  <p className="text-xs text-text-muted" data-testid="lodestone-sync-metadata">
                    Source: {lastSyncResult.syncSource}
                    {lastSyncResult.syncedJob ? ` | Job: ${lastSyncResult.syncedJob}` : ''}
                    {` | ${lastSyncResult.updatedSlots} slot${lastSyncResult.updatedSlots === 1 ? '' : 's'} updated`}
                  </p>
                )}
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
