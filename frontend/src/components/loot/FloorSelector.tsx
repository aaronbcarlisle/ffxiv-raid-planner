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
    <div className="relative">
      <select
        value={selectedFloor}
        onChange={(e) => onFloorChange(Number(e.target.value) as FloorNumber)}
        className="appearance-none bg-bg-secondary border border-border-default rounded-md px-4 py-2 pr-8 text-sm font-medium text-text-primary cursor-pointer hover:border-accent focus:border-accent focus:outline-none"
      >
        {floors.map((floor, index) => {
          const floorNumber = (index + 1) as FloorNumber;
          return (
            <option key={floor} value={floorNumber}>
              {floor}
            </option>
          );
        })}
      </select>
      {/* Custom dropdown arrow */}
      <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
        <svg
          className="w-4 h-4 text-text-muted"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
