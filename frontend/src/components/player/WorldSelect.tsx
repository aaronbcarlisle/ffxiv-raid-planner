/**
 * WorldSelect — reusable Data Center + World dropdown cascade, ported from the
 * DiscoveryTab recruitment filter so every world/server field shares one
 * implementation (Add Character, Character Link, Split Planner, Lodestone, …).
 *
 * - `showDataCenter` renders a DC select + a World select; changing the DC
 *   resets the selected world.
 * - `showDataCenter={false}` renders just the World select (filtered by the
 *   `dataCenter` prop when provided).
 * - `allowAny` adds an empty placeholder option (the design-system Select shows
 *   the empty option's label as the placeholder).
 */
import { Select } from '../ui';
import { DC_NAMES, getWorldsForDC } from '../../gamedata';

interface WorldSelectProps {
  world: string;
  onWorldChange: (w: string) => void;
  dataCenter?: string;
  onDataCenterChange?: (dc: string) => void;
  showDataCenter?: boolean;
  disabled?: boolean;
  allowAny?: boolean;
  layout?: 'row' | 'stack';
}

export function WorldSelect({
  world,
  onWorldChange,
  dataCenter = '',
  onDataCenterChange,
  showDataCenter = true,
  disabled,
  allowAny = true,
  layout = 'row',
}: WorldSelectProps) {
  const dcOptions = [
    ...(allowAny ? [{ value: '', label: 'Select data center' }] : []),
    ...DC_NAMES.map((dc) => ({ value: dc, label: dc })),
  ];

  const worldsForDc = dataCenter ? getWorldsForDC(dataCenter) : DC_NAMES.flatMap((dc) => getWorldsForDC(dc));
  const worldOptions = (showDataCenter && !dataCenter)
    ? [{ value: '', label: 'Select a data center first' }]
    : [
        ...(allowAny ? [{ value: '', label: 'Any world' }] : []),
        ...worldsForDc.map((w) => ({ value: w, label: w })),
      ];

  const handleDc = (dc: string) => {
    onDataCenterChange?.(dc);
    if (dc !== dataCenter) onWorldChange('');
  };

  return (
    <div className={layout === 'row' ? 'grid grid-cols-2 gap-3' : 'space-y-2'}>
      {showDataCenter && (
        <Select aria-label="Data center" value={dataCenter} onChange={handleDc} options={dcOptions} disabled={disabled} />
      )}
      <Select
        aria-label="World"
        value={world}
        onChange={onWorldChange}
        options={worldOptions}
        disabled={disabled || (showDataCenter && !dataCenter)}
      />
    </div>
  );
}
