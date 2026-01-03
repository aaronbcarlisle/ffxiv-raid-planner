/**
 * Planning Markers in Gear Table Mockup
 *
 * Enhanced gear table with planning marker support.
 * Design inspired by Arcadion spreadsheet's marker system.
 *
 * Markers:
 * - 🔨 Plan to craft this slot
 * - 📃 Bought with pages (floor 1-3)
 * - ♻️ Bought with 4th floor pages
 * - 💰 Bought token via alliance/hunts
 * - ◀️ Plan to improve next
 * - 💾 Already have the upgrade token
 */

import React, { useState } from 'react';

const MARKERS = [
  { id: 'craft', emoji: '🔨', label: 'Plan to craft', color: '#f59e0b' },
  { id: 'pages', emoji: '📃', label: 'Buy with pages', color: '#14b8a6' },
  { id: 'f4pages', emoji: '♻️', label: 'Buy with F4 pages', color: '#22c55e' },
  { id: 'token', emoji: '💰', label: 'Alliance/Hunt token', color: '#fbbf24' },
  { id: 'next', emoji: '◀️', label: 'Improve next', color: '#3b82f6' },
  { id: 'haveToken', emoji: '💾', label: 'Have upgrade token', color: '#a855f7' },
];

const mockGear = [
  { slot: 'weapon', name: 'Weapon', bisSource: 'raid', hasItem: true, isAugmented: false, marker: null },
  { slot: 'head', name: 'Head', bisSource: 'raid', hasItem: true, isAugmented: false, marker: null },
  { slot: 'body', name: 'Body', bisSource: 'tome', hasItem: true, isAugmented: true, marker: null },
  { slot: 'hands', name: 'Hands', bisSource: 'raid', hasItem: false, isAugmented: false, marker: 'pages' },
  { slot: 'legs', name: 'Legs', bisSource: 'raid', hasItem: false, isAugmented: false, marker: 'next' },
  { slot: 'feet', name: 'Feet', bisSource: 'tome', hasItem: true, isAugmented: false, marker: 'haveToken' },
  { slot: 'earring', name: 'Earring', bisSource: 'raid', hasItem: false, isAugmented: false, marker: null },
  { slot: 'necklace', name: 'Necklace', bisSource: 'tome', hasItem: true, isAugmented: true, marker: null },
  { slot: 'bracelet', name: 'Bracelet', bisSource: 'raid', hasItem: false, isAugmented: false, marker: 'craft' },
  { slot: 'ring1', name: 'R. Ring', bisSource: 'raid', hasItem: true, isAugmented: false, marker: null },
  { slot: 'ring2', name: 'L. Ring', bisSource: 'tome', hasItem: true, isAugmented: true, marker: null },
];

const getStatusText = (gear) => {
  if (gear.bisSource === 'raid') {
    return gear.hasItem ? '✓ Complete' : 'Need drop';
  } else {
    if (!gear.hasItem) return 'Need tome';
    if (!gear.isAugmented) return 'Need aug';
    return '✓ Complete';
  }
};

const getStatusColor = (gear) => {
  if (gear.bisSource === 'raid') {
    return gear.hasItem ? '#22c55e' : '#71717a';
  } else {
    if (!gear.hasItem) return '#71717a';
    if (!gear.isAugmented) return '#fbbf24';
    return '#22c55e';
  }
};

const MarkerDropdown = ({ currentMarker, onChange, onClose }) => {
  return (
    <div className="absolute right-0 top-full mt-1 z-20
                    bg-[#18181f] border border-[#1f1f28] rounded-lg
                    shadow-lg overflow-hidden min-w-[180px]">
      {/* Clear option */}
      <button
        className="w-full px-3 py-2 text-left text-sm text-gray-400
                   hover:bg-[#1e1e26] flex items-center gap-2"
        onClick={() => { onChange(null); onClose(); }}
      >
        <span className="w-5">—</span>
        <span>No marker</span>
      </button>

      <div className="border-t border-[#1f1f28]" />

      {/* Marker options */}
      {MARKERS.map(marker => (
        <button
          key={marker.id}
          className={`w-full px-3 py-2 text-left text-sm
                     hover:bg-[#1e1e26] flex items-center gap-2
                     ${currentMarker === marker.id ? 'bg-[#14b8a6]/10' : ''}`}
          onClick={() => { onChange(marker.id); onClose(); }}
        >
          <span className="w-5 text-center">{marker.emoji}</span>
          <span className="text-gray-200">{marker.label}</span>
          {currentMarker === marker.id && (
            <span className="ml-auto text-[#14b8a6]">✓</span>
          )}
        </button>
      ))}
    </div>
  );
};

const GearRow = ({ gear, onGearChange, onMarkerChange }) => {
  const [showMarkerDropdown, setShowMarkerDropdown] = useState(false);
  const currentMarkerData = MARKERS.find(m => m.id === gear.marker);
  const isRaid = gear.bisSource === 'raid';

  return (
    <tr className="border-b border-[#1f1f28] hover:bg-[#121218] transition-colors">
      {/* Slot Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <img
            src={`https://xivapi.com/img-misc/gear/${gear.slot === 'ring1' || gear.slot === 'ring2' ? 'ring' : gear.slot}.png`}
            alt=""
            className="w-5 h-5 opacity-60"
          />
          <span className="text-gray-200">{gear.name}</span>
        </div>
      </td>

      {/* BiS Source */}
      <td className="px-4 py-3">
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium
                     ${isRaid
                       ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                       : 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                     }`}
        >
          {isRaid ? 'Raid' : 'Tome'}
        </span>
      </td>

      {/* Have Checkbox */}
      <td className="px-4 py-3 text-center">
        <input
          type="checkbox"
          checked={gear.hasItem}
          onChange={() => onGearChange('hasItem', !gear.hasItem)}
          className="w-5 h-5 rounded cursor-pointer accent-[#14b8a6]"
        />
      </td>

      {/* Augmented Checkbox */}
      <td className="px-4 py-3 text-center">
        {!isRaid ? (
          <input
            type="checkbox"
            checked={gear.isAugmented}
            onChange={() => onGearChange('isAugmented', !gear.isAugmented)}
            disabled={!gear.hasItem}
            className="w-5 h-5 rounded cursor-pointer accent-amber-400
                       disabled:opacity-30 disabled:cursor-not-allowed"
          />
        ) : (
          <span className="text-gray-600">—</span>
        )}
      </td>

      {/* Marker */}
      <td className="px-4 py-3 relative">
        <button
          className="flex items-center gap-2 px-2 py-1 rounded
                     hover:bg-[#1e1e26] transition-colors min-w-[100px]"
          onClick={() => setShowMarkerDropdown(!showMarkerDropdown)}
        >
          {currentMarkerData ? (
            <>
              <span className="text-lg">{currentMarkerData.emoji}</span>
              <span className="text-sm text-gray-400">{currentMarkerData.label.split(' ')[0]}</span>
            </>
          ) : (
            <span className="text-sm text-gray-500">+ Marker</span>
          )}
        </button>

        {showMarkerDropdown && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowMarkerDropdown(false)}
            />
            <MarkerDropdown
              currentMarker={gear.marker}
              onChange={onMarkerChange}
              onClose={() => setShowMarkerDropdown(false)}
            />
          </>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span
          className="text-sm"
          style={{ color: getStatusColor(gear) }}
        >
          {getStatusText(gear)}
        </span>
      </td>
    </tr>
  );
};

const PlanningMarkersGearTable = () => {
  const [gear, setGear] = useState(mockGear);

  const handleGearChange = (slotIndex, field, value) => {
    setGear(prev => {
      const updated = [...prev];
      updated[slotIndex] = { ...updated[slotIndex], [field]: value };
      return updated;
    });
  };

  const handleMarkerChange = (slotIndex, markerId) => {
    setGear(prev => {
      const updated = [...prev];
      updated[slotIndex] = { ...updated[slotIndex], marker: markerId };
      return updated;
    });
  };

  const completion = gear.filter(g => {
    if (g.bisSource === 'raid') return g.hasItem;
    return g.hasItem && g.isAugmented;
  }).length;

  return (
    <div className="p-6 bg-[#050508] min-h-screen">
      {/* Player Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#5a9fd4]" />
            <h1 className="text-xl font-semibold text-gray-200">MrDark</h1>
          </div>
          <span className="text-[#5a9fd4] font-medium">Dark Knight</span>
          <span className="px-2 py-0.5 bg-[#14b8a6]/20 text-[#14b8a6] rounded text-sm">
            MT
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold text-white">
            {completion}/11
          </span>
          <span className="text-gray-400">i790</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6 h-2 bg-[#121218] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#14b8a6] to-[#0891b2] transition-all"
          style={{ width: `${(completion / 11) * 100}%` }}
        />
      </div>

      {/* Gear Table */}
      <div className="bg-[#0e0e14] rounded-lg border border-[#1f1f28] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#0a0a0f] text-sm text-gray-400 border-b border-[#1f1f28]">
              <th className="px-4 py-3 text-left">Slot</th>
              <th className="px-4 py-3 text-left">BiS Source</th>
              <th className="px-4 py-3 text-center">Have</th>
              <th className="px-4 py-3 text-center">Aug</th>
              <th className="px-4 py-3 text-left">Marker</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {gear.map((g, index) => (
              <GearRow
                key={g.slot}
                gear={g}
                onGearChange={(field, value) => handleGearChange(index, field, value)}
                onMarkerChange={(markerId) => handleMarkerChange(index, markerId)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Markers Legend */}
      <div className="mt-6">
        <h3 className="text-sm font-medium text-gray-400 mb-3">
          Planning Markers
        </h3>
        <div className="flex flex-wrap gap-3">
          {MARKERS.map(marker => (
            <div
              key={marker.id}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full
                         bg-[#0e0e14] border border-[#1f1f28]"
            >
              <span>{marker.emoji}</span>
              <span className="text-sm text-gray-300">{marker.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="mt-6 grid grid-cols-4 gap-4">
        {[
          { label: 'Raid pieces needed', value: gear.filter(g => g.bisSource === 'raid' && !g.hasItem).length, color: '#f87171' },
          { label: 'Tome pieces needed', value: gear.filter(g => g.bisSource === 'tome' && !g.hasItem).length, color: '#2dd4bf' },
          { label: 'Augments needed', value: gear.filter(g => g.bisSource === 'tome' && g.hasItem && !g.isAugmented).length, color: '#fbbf24' },
          { label: 'Markers set', value: gear.filter(g => g.marker).length, color: '#a78bfa' },
        ].map(stat => (
          <div
            key={stat.label}
            className="bg-[#0e0e14] border border-[#1f1f28] rounded-lg p-4"
          >
            <div className="text-2xl font-bold" style={{ color: stat.color }}>
              {stat.value}
            </div>
            <div className="text-sm text-gray-400">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlanningMarkersGearTable;
