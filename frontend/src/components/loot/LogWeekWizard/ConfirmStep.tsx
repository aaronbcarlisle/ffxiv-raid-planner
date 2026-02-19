import { Package, Book, AlertCircle, Gem } from 'lucide-react';
import { JobIcon } from '../../ui/JobIcon';
import { FLOOR_COLORS, UPGRADE_MATERIAL_DISPLAY_NAMES, type UpgradeMaterialType } from '../../../gamedata/loot-tables';
import { GEAR_SLOT_NAMES, type GearSlot } from '../../../types';
import type { SnapshotPlayer } from '../../../types';
import type { FloorNumber, FloorEntries, Summary } from './types';

interface ConfirmStepProps {
  floors: string[];
  floorData: Record<FloorNumber, FloorEntries>;
  clearedFloors: Set<FloorNumber>;
  mainRosterPlayers: SnapshotPlayer[];
  singleFloorMode: boolean;
  summary: Summary;
}

export function ConfirmStep({
  floors,
  floorData,
  clearedFloors,
  mainRosterPlayers,
  singleFloorMode,
  summary,
}: ConfirmStepProps) {
  return (
    <div className="space-y-4">
      {/* Summary stats - horizontal bar */}
      <div className="flex items-center justify-between bg-surface-elevated rounded-lg border border-border-default p-3">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-accent" />
            <span className="text-sm text-text-muted">Gear</span>
            <span className="text-sm font-bold text-text-primary">{summary.gearDrops}</span>
          </div>
          <div className="flex items-center gap-2">
            <Gem className="w-4 h-4 text-material-glaze" />
            <span className="text-sm text-text-muted">Materials</span>
            <span className="text-sm font-bold text-text-primary">{summary.materialDrops}</span>
          </div>
          <div className="flex items-center gap-2">
            <Book className="w-4 h-4 text-status-info" />
            <span className="text-sm text-text-muted">Books</span>
            <span className="text-sm font-bold text-text-primary">{summary.bookClears}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 pl-4 border-l border-border-subtle">
          <span className="text-sm text-text-secondary">Total</span>
          <span className="text-lg font-bold text-accent">{summary.total}</span>
        </div>
      </div>

      {/* Per-floor detail cards - 2 column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {floors.map((floorName, i) => {
        const floorNum = (i + 1) as FloorNumber;
        if (!clearedFloors.has(floorNum)) return null;
        const floor = floorData[floorNum];
        if (!floor) return null;
        const floorColor = FLOOR_COLORS[floorNum];

        const gearEntries = Object.entries(floor.gear)
          .filter(([_, e]) => e.playerId && !e.didNotDrop)
          .map(([slot, e]) => ({
            slot,
            player: mainRosterPlayers.find((p) => p.id === e.playerId),
            updateGear: e.updateGear,
          }));
        const materialEntries = Object.entries(floor.materials)
          .filter(([_, e]) => e.playerId && !e.didNotDrop)
          .map(([slot, e]) => ({
            slot,
            player: mainRosterPlayers.find((p) => p.id === e.playerId),
            updateGear: e.updateGear,
          }));

        const hasContent = gearEntries.length > 0 || materialEntries.length > 0 || floor.booksCleared.length > 0;
        if (!hasContent) return null;

        const allPlayersCleared = floor.booksCleared.length === mainRosterPlayers.length;

        return (
          <div
            key={floorName}
            className="bg-surface-elevated rounded-lg border border-border-default p-3"
          >
            <h3
              className="text-sm font-medium mb-2 flex items-center gap-2"
              style={{ color: floorColor.hex }}
            >
              <div
                className="w-1.5 h-3.5 rounded-sm"
                style={{ backgroundColor: floorColor.hex }}
              />
              {floorName}
            </h3>

            <div className="space-y-2">
              {/* Gear drops */}
              {gearEntries.length > 0 && (
                <div className="space-y-1">
                  {gearEntries.map(({ slot, player, updateGear }) => (
                    <div key={slot} className="flex justify-between items-center text-xs">
                      <span className="text-text-muted">
                        {GEAR_SLOT_NAMES[slot as GearSlot]}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {player?.job && <JobIcon job={player.job} size="xs" />}
                        <span className="font-medium text-text-primary">
                          {player?.name || '?'}
                        </span>
                        {updateGear && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-status-success/20 text-status-success">
                            +gear
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Materials */}
              {materialEntries.length > 0 && (
                <div className={`space-y-1 ${gearEntries.length > 0 ? 'pt-1.5 border-t border-border-subtle' : ''}`}>
                  {materialEntries.map(({ slot, player, updateGear }) => {
                    const displayName = slot === 'universal_tomestone'
                      ? 'U. Tomestone'
                      : UPGRADE_MATERIAL_DISPLAY_NAMES[slot as UpgradeMaterialType];
                    const materialColorClass = slot === 'twine' ? 'text-material-twine'
                      : slot === 'glaze' ? 'text-material-glaze'
                      : slot === 'solvent' ? 'text-material-solvent'
                      : 'text-material-tomestone';
                    return (
                      <div key={slot} className="flex justify-between items-center text-xs">
                        <span className={materialColorClass}>
                          {displayName}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {player?.job && <JobIcon job={player.job} size="xs" />}
                          <span className="font-medium text-text-primary">
                            {player?.name || '?'}
                          </span>
                          {updateGear && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-status-success/20 text-status-success">
                              +aug
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Books */}
              {floor.booksCleared.length > 0 && (
                <div className={`${gearEntries.length > 0 || materialEntries.length > 0 ? 'pt-1.5 border-t border-border-subtle' : ''}`}>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-text-muted">Books</span>
                    <span className="text-text-secondary">
                      {allPlayersCleared ? (
                        'All players'
                      ) : (
                        <span className="flex items-center gap-1">
                          {floor.booksCleared.slice(0, 4).map((playerId) => {
                            const player = mainRosterPlayers.find((p) => p.id === playerId);
                            return player?.job ? (
                              <JobIcon key={playerId} job={player.job} size="xs" />
                            ) : null;
                          })}
                          {floor.booksCleared.length > 4 && (
                            <span className="text-text-muted">
                              +{floor.booksCleared.length - 4}
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
      </div>

      {/* Skipped floors notice */}
      {!singleFloorMode && clearedFloors.size < 4 && (
        <div className="flex items-start gap-3 p-3 bg-status-warning/10 border border-status-warning/30 rounded-lg">
          <AlertCircle className="w-4 h-4 text-status-warning flex-shrink-0 mt-0.5" />
          <div className="text-sm text-text-secondary">
            Skipped: {floors.filter((_, i) => !clearedFloors.has((i + 1) as FloorNumber)).join(', ')}
          </div>
        </div>
      )}

      {summary.total === 0 && (
        <div className="flex items-start gap-3 p-3 bg-status-warning/10 border border-status-warning/30 rounded-lg">
          <AlertCircle className="w-4 h-4 text-status-warning flex-shrink-0 mt-0.5" />
          <div className="text-sm text-text-secondary">
            No entries to log. Go back and add some drops or book clears.
          </div>
        </div>
      )}
    </div>
  );
}
