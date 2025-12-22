import type { FloorNumber } from '../../gamedata/loot-tables';

interface FloorSelectorProps {
  floors: string[]; // Floor names from raid tier (e.g., ['M5S', 'M6S', 'M7S', 'M8S'])
  selectedFloor: FloorNumber;
  onFloorChange: (floor: FloorNumber) => void;
}

export function FloorSelector({
  floors,
  selectedFloor,
  onFloorChange,
}: FloorSelectorProps) {
  return (
    <div className="flex gap-2">
      {floors.map((floor, index) => {
        const floorNumber = (index + 1) as FloorNumber;
        const isSelected = selectedFloor === floorNumber;

        return (
          <button
            key={floor}
            type="button"
            onClick={() => onFloorChange(floorNumber)}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
              isSelected
                ? 'bg-accent/30 border border-accent text-accent'
                : 'bg-bg-hover border border-border-default text-text-muted hover:text-text-primary hover:border-text-muted'
            }`}
          >
            {floor}
          </button>
        );
      })}
    </div>
  );
}
