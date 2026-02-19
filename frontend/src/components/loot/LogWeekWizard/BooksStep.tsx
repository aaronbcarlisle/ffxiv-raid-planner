import { Book } from 'lucide-react';
import { Label } from '../../ui';
import { Button } from '../../primitives';
import { JobIcon } from '../../ui/JobIcon';
import { FLOOR_COLORS } from '../../../gamedata/loot-tables';
import type { SnapshotPlayer } from '../../../types';
import type { FloorNumber, FloorEntries } from './types';

interface BooksStepProps {
  floors: string[];
  floorData: Record<FloorNumber, FloorEntries>;
  clearedFloors: Set<FloorNumber>;
  mainRosterPlayers: SnapshotPlayer[];
  singleFloorMode: boolean;
  initialFloor: FloorNumber;
  handleBookToggle: (floorNum: FloorNumber, playerId: string, cleared: boolean) => void;
  handleSelectAllBooks: (floorNum: FloorNumber) => void;
  handleClearAllBooks: (floorNum: FloorNumber) => void;
  setFloorData: React.Dispatch<React.SetStateAction<Record<FloorNumber, FloorEntries>>>;
}

export function BooksStep({
  floors,
  floorData,
  clearedFloors,
  mainRosterPlayers,
  singleFloorMode,
  initialFloor,
  handleBookToggle,
  handleSelectAllBooks,
  handleClearAllBooks,
  setFloorData,
}: BooksStepProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">
          {singleFloorMode
            ? `Select which players cleared ${floors[initialFloor - 1]} this week.`
            : 'Select which players cleared each floor this week to add their book entries.'}
        </p>
        {!singleFloorMode && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setFloorData((prev) => {
                  const newData = { ...prev };
                  for (const floorNum of [1, 2, 3, 4] as FloorNumber[]) {
                    if (newData[floorNum]) {
                      newData[floorNum] = {
                        ...newData[floorNum],
                        booksCleared: mainRosterPlayers.map((p) => p.id),
                      };
                    }
                  }
                  return newData;
                });
              }}
            >
              Select All Floors
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setFloorData((prev) => {
                  const newData = { ...prev };
                  for (const floorNum of [1, 2, 3, 4] as FloorNumber[]) {
                    if (newData[floorNum]) {
                      newData[floorNum] = {
                        ...newData[floorNum],
                        booksCleared: [],
                      };
                    }
                  }
                  return newData;
                });
              }}
            >
              Clear All Floors
            </Button>
          </div>
        )}
      </div>

      {floors.map((floorName, i) => {
        const floorNum = (i + 1) as FloorNumber;
        if (singleFloorMode && floorNum !== initialFloor) return null;
        if (!singleFloorMode && !clearedFloors.has(floorNum)) return null;
        const floor = floorData[floorNum];
        if (!floor) return null;
        const floorColor = FLOOR_COLORS[floorNum];

        return (
          <div key={floorName} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Book className="w-4 h-4" style={{ color: floorColor.hex }} />
                <Label className="mb-0" style={{ color: floorColor.hex }}>{floorName}</Label>
                <span className="text-xs text-text-muted">
                  ({floor.booksCleared.length} selected)
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSelectAllBooks(floorNum)}
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleClearAllBooks(floorNum)}
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {mainRosterPlayers.map((player) => {
                const isSelected = floor.booksCleared.includes(player.id);
                return (
                  <label
                    key={player.id}
                    className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                      isSelected ? '' : 'bg-surface-raised border-border-subtle hover:border-border-default'
                    }`}
                    style={isSelected ? {
                      backgroundColor: `${floorColor.hex}20`,
                      borderColor: `${floorColor.hex}4D`,
                    } : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleBookToggle(floorNum, player.id, e.target.checked)}
                      className="sr-only"
                    />
                    {player.job && <JobIcon job={player.job} size="sm" />}
                    <span
                      className="text-sm truncate"
                      style={{ color: isSelected ? floorColor.hex : undefined }}
                    >
                      {player.name}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
