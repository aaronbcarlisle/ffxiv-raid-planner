import { useEffect } from 'react';
import { Link2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { WorldSelect } from '../player/WorldSelect';
import { Button } from '../primitives/Button';
import { Badge } from '../primitives/Badge';
import { Spinner } from '../ui/Spinner';
import { JobIcon } from '../ui/JobIcon';
import { usePlayerProfileStore } from '../../stores/playerProfileStore';
import { useLodestoneStore } from '../../stores/lodestoneStore';
import type { LodestoneCharacter } from '../../stores/lodestoneStore';
import { toast } from '../../stores/toastStore';
import { useState } from 'react';

interface CharacterLinkModalProps {
  onClose: () => void;
}

export function CharacterLinkModal({ onClose }: CharacterLinkModalProps) {
  const { linkCharacter } = usePlayerProfileStore();
  const {
    searchResults,
    isSearching,
    searchError,
    characterGear,
    isLoadingGear,
    gearError,
    searchCharacters,
    fetchCharacterGear,
    clearGear,
    resetState,
  } = useLodestoneStore();

  const [name, setName] = useState('');
  const [server, setServer] = useState('');
  const [linking, setLinking] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedChar, setSelectedChar] = useState<LodestoneCharacter | null>(null);

  useEffect(() => {
    return () => {
      resetState();
    };
  }, [resetState]);

  const handleSearch = async () => {
    if (!name.trim() || name.trim().length < 2) return;
    setSearched(true);
    setSelectedChar(null);
    clearGear();
    await searchCharacters(name.trim(), server.trim() || undefined);
  };

  const handleSelectCharacter = (char: LodestoneCharacter) => {
    setSelectedChar(char);
    fetchCharacterGear(char.lodestoneId);
  };

  const handleLink = async (char: LodestoneCharacter) => {
    setLinking(true);
    try {
      const dcMatch = char.server.match(/\[(.+?)\]/);
      const serverName = char.server.replace(/\s*\[.+?\]/, '').trim();
      await linkCharacter({
        lodestoneId: String(char.lodestoneId),
        name: char.name,
        server: serverName,
        dataCenter: dcMatch?.[1],
        avatarUrl: char.avatar ?? undefined,
        isMain: true,
      });
      toast.success(`Linked ${char.name}`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to link character';
      toast.error(msg);
    } finally {
      setLinking(false);
    }
  };

  const hasResults = searchResults.length > 0;
  const showGearPreview = selectedChar && characterGear;

  return (
    <Modal isOpen={true} title={<span className="flex items-center gap-2"><Link2 className="w-5 h-5" />Link Character</span>} onClose={onClose} className="max-w-2xl">
      <div className="space-y-4">
        {/* Search bar */}
        <div className="flex gap-3">
          <Input
            value={name}
            onChange={setName}
            placeholder="Character name"
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <div className="w-40">
            <WorldSelect showDataCenter={false} world={server} onWorldChange={setServer} allowAny />
          </div>
          <Button onClick={handleSearch} disabled={isSearching || name.trim().length < 2}>
            {isSearching ? 'Searching…' : 'Search'}
          </Button>
        </div>

        {searchError && (
          <div className="text-sm text-status-error bg-status-error/10 rounded px-3 py-2">
            {searchError}
          </div>
        )}

        {isSearching && (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}

        {!isSearching && searched && !hasResults && (
          <div className="text-center py-8 text-text-secondary">
            No characters found. Try a different name or server.
          </div>
        )}

        {/* Search results + gear preview layout */}
        {!isSearching && hasResults && (
          <div className="flex gap-4">
            {/* Results list */}
            <div className="flex-1 space-y-2 max-h-96 overflow-y-auto">
              {searchResults.map((result) => {
                const isSelected = selectedChar?.lodestoneId === result.lodestoneId;
                return (
                  <div
                    key={result.lodestoneId}
                    onClick={() => handleSelectCharacter(result)}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-accent/10 border-accent/40'
                        : 'bg-surface-elevated border-border-default hover:border-accent/30'
                    }`}
                  >
                    <div className="w-10 h-10 rounded overflow-hidden bg-surface-base flex-shrink-0">
                      {result.avatar ? (
                        <img src={result.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-text-tertiary">?</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-text-primary truncate">{result.name}</div>
                      <div className="text-sm text-text-secondary">{result.server}</div>
                    </div>
                    <Button
                      variant={isSelected ? 'primary' : 'secondary'}
                      size="sm"
                      disabled={linking}
                      onClick={(e) => { e.stopPropagation(); handleLink(result); }}
                    >
                      Link
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* Gear preview panel */}
            {selectedChar && (
              <div className="w-64 flex-shrink-0">
                <div className="bg-surface-elevated rounded-lg border border-border-default p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded overflow-hidden bg-surface-base flex-shrink-0">
                      {selectedChar.avatar ? (
                        <img src={selectedChar.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-text-tertiary text-xs">?</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-text-primary truncate">{selectedChar.name}</div>
                      <div className="text-xs text-text-secondary">{selectedChar.server}</div>
                    </div>
                  </div>

                  {isLoadingGear && (
                    <div className="flex justify-center py-4">
                      <Spinner />
                    </div>
                  )}

                  {gearError && (
                    <div className="text-xs text-text-tertiary py-2">
                      Gear preview unavailable. You can still link this character.
                    </div>
                  )}

                  {showGearPreview && (
                    <div className="space-y-2">
                      {characterGear.activeJob && (
                        <div className="flex items-center gap-2">
                          <JobIcon job={characterGear.activeJob} size="sm" />
                          <span className="text-sm text-text-primary">{characterGear.activeJob}</span>
                          {characterGear.activeJobLevel && (
                            <Badge variant="info" size="sm">Lv {characterGear.activeJobLevel}</Badge>
                          )}
                        </div>
                      )}

                      {characterGear.gearAvailable && characterGear.gear.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs text-text-tertiary font-medium">Equipped Gear</div>
                          {characterGear.gear.slice(0, 5).map((slot) => (
                            <div key={slot.slot} className="flex items-center gap-2 text-xs">
                              {slot.itemIcon && (
                                <img src={slot.itemIcon} alt="" className="w-4 h-4 rounded" />
                              )}
                              <span className="flex-1 text-text-secondary truncate">
                                {slot.itemName || slot.slot}
                              </span>
                              {slot.itemLevel > 0 && (
                                <span className="text-text-tertiary font-mono">{slot.itemLevel}</span>
                              )}
                            </div>
                          ))}
                          {characterGear.gear.length > 5 && (
                            <div className="text-xs text-text-tertiary">
                              +{characterGear.gear.length - 5} more slots
                            </div>
                          )}
                        </div>
                      )}

                      {!characterGear.gearAvailable && (
                        <div className="text-xs text-text-tertiary">
                          Gear data not available. Character may be on a different job or Lodestone may be updating.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
