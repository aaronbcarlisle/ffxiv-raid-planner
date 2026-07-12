import { Select } from '../ui';
import { FLOOR_COLORS, type FloorNumber } from '../../gamedata/loot-tables';

interface FloorSelectorProps {
  floors: string[]; // Floor names from raid tier (e.g., ['M5S', 'M6S', 'M7S', 'M8S'])
  dutyNames?: string[]; // Full duty names for tooltips
  selectedFloor: FloorNumber;
  onFloorChange: (floor: FloorNumber) => void;
}

export function FloorSelector({
  floors,
  dutyNames,
  selectedFloor,
  onFloorChange,
}: FloorSelectorProps) {
  // Build options with floor names, colors, and optional duty name labels
  const options = floors.map((floor, index) => {
    const floorNumber = (index + 1) as FloorNumber;
    const dutyName = dutyNames?.[index];
    const floorColor = FLOOR_COLORS[floorNumber];
    return {
      value: String(floorNumber),
      label: dutyName ? `${floor} - ${dutyName}` : floor,
      textClassName: floorColor.text,
    };
  });

  return (
    <Select
      value={String(selectedFloor)}
      onChange={(value) => onFloorChange(Number(value) as FloorNumber)}
      options={options}
    />
  );
}
