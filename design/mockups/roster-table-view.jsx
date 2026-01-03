/**
 * Roster Table View Mockup
 *
 * Spreadsheet-style view showing all 8 players in a dense table format.
 * Design inspired by the Savage Group Sheet's BiS Tracker tab.
 *
 * Key UX principles:
 * - All 8 players visible simultaneously
 * - Compact representation of gear status
 * - Sortable columns
 * - Direct checkbox interaction
 */

import React, { useState } from 'react';

// Mock player data
const mockPlayers = [
  {
    id: '1', name: 'Leylie', job: 'BLM', role: 'caster', position: 'H1',
    completion: 0, ilv: 770, gear: generateMockGear(0),
  },
  {
    id: '2', name: 'Goony', job: 'DRG', role: 'melee', position: 'M1',
    completion: 0, ilv: 776, gear: generateMockGear(30),
  },
  {
    id: '3', name: 'Scholy', job: 'SCH', role: 'healer', position: 'H2',
    completion: 18, ilv: 778, gear: generateMockGear(20),
  },
  {
    id: '4', name: 'MrDark', job: 'DRK', role: 'tank', position: 'T2',
    completion: 82, ilv: 788, gear: generateMockGear(90),
  },
  {
    id: '5', name: 'Dancy', job: 'DNC', role: 'ranged', position: 'T2',
    completion: 0, ilv: 770, gear: generateMockGear(0),
  },
  {
    id: '6', name: 'Pally', job: 'PLD', role: 'tank', position: 'T1',
    completion: 9, ilv: 772, gear: generateMockGear(10),
  },
  {
    id: '7', name: 'Whitey', job: 'WHM', role: 'healer', position: 'H1',
    completion: 0, ilv: 770, gear: generateMockGear(0),
  },
  {
    id: '8', name: 'Punchy', job: 'MNK', role: 'melee', position: 'M2',
    completion: 27, ilv: 776, gear: generateMockGear(30),
  },
];

function generateMockGear(completionBias) {
  const slots = ['weapon', 'head', 'body', 'hands', 'legs', 'feet', 'earring', 'necklace', 'bracelet', 'ring1', 'ring2'];
  return slots.map(slot => ({
    slot,
    bisSource: Math.random() > 0.3 ? 'raid' : 'tome',
    hasItem: Math.random() * 100 < completionBias,
    isAugmented: Math.random() > 0.7,
  }));
}

const ROLE_COLORS = {
  tank: '#5a9fd4',
  healer: '#5ad490',
  melee: '#d45a5a',
  ranged: '#d4a05a',
  caster: '#b45ad4',
};

const PROGRESS_COLORS = {
  complete: '#a78bfa',   // Purple - BiS achieved
  nearMax: '#60a5fa',    // Blue - 80%+ done
  good: '#4ade80',       // Green - 50-79%
  needs: '#facc15',      // Yellow - needs work
  priority: '#f87171',   // Red - <30%
};

const getProgressColor = (completion) => {
  if (completion >= 100) return PROGRESS_COLORS.complete;
  if (completion >= 80) return PROGRESS_COLORS.nearMax;
  if (completion >= 50) return PROGRESS_COLORS.good;
  if (completion >= 30) return PROGRESS_COLORS.needs;
  return PROGRESS_COLORS.priority;
};

const SLOT_HEADERS = [
  { key: 'weapon', label: 'Weap', short: 'W' },
  { key: 'head', label: 'Head', short: 'Hd' },
  { key: 'body', label: 'Body', short: 'Bd' },
  { key: 'hands', label: 'Hand', short: 'Hn' },
  { key: 'legs', label: 'Legs', short: 'Lg' },
  { key: 'feet', label: 'Feet', short: 'Ft' },
  { key: 'earring', label: 'Ear', short: 'Er' },
  { key: 'necklace', label: 'Neck', short: 'Nk' },
  { key: 'bracelet', label: 'Wrist', short: 'Wr' },
  { key: 'ring1', label: 'R.Ring', short: 'R1' },
  { key: 'ring2', label: 'L.Ring', short: 'R2' },
];

const GearCell = ({ gear, onChange }) => {
  const isRaid = gear.bisSource === 'raid';

  return (
    <div className="flex items-center gap-0.5 justify-center">
      {/* BiS Source indicator */}
      <span
        className={`text-[10px] font-bold ${
          isRaid ? 'text-amber-400' : 'text-teal-400'
        }`}
        title={isRaid ? 'Raid BiS' : 'Tome BiS'}
      >
        {isRaid ? 'R' : 'T'}
      </span>

      {/* Have checkbox */}
      <input
        type="checkbox"
        checked={gear.hasItem}
        onChange={() => onChange('hasItem')}
        className="w-3.5 h-3.5 rounded cursor-pointer
                   accent-[#14b8a6] bg-[#121218] border-[#1f1f28]"
        title="Have item"
      />

      {/* Augmented checkbox (only for Tome BiS) */}
      {!isRaid && (
        <input
          type="checkbox"
          checked={gear.isAugmented}
          onChange={() => onChange('isAugmented')}
          disabled={!gear.hasItem}
          className="w-3.5 h-3.5 rounded cursor-pointer
                     accent-amber-400 bg-[#121218] border-[#1f1f28]
                     disabled:opacity-30"
          title="Augmented"
        />
      )}
    </div>
  );
};

const RosterTableView = () => {
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  };

  const sortedPlayers = [...mockPlayers].sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'name') comparison = a.name.localeCompare(b.name);
    if (sortBy === 'job') comparison = a.job.localeCompare(b.job);
    if (sortBy === 'completion') comparison = a.completion - b.completion;
    if (sortBy === 'ilv') comparison = a.ilv - b.ilv;
    return sortDir === 'asc' ? comparison : -comparison;
  });

  const SortableHeader = ({ column, children, className = '' }) => (
    <th
      className={`px-2 py-2 text-left cursor-pointer hover:bg-[#1e1e26]
                  transition-colors ${className}`}
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortBy === column && (
          <span className="text-[#14b8a6]">
            {sortDir === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </th>
  );

  return (
    <div className="p-6 bg-[#050508] min-h-screen">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#14b8a6]">
            Roster - Table View
          </h1>
          <p className="text-sm text-gray-400">
            Spreadsheet-style view of all players. Click column headers to sort.
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex bg-[#0e0e14] rounded-lg p-1 border border-[#1f1f28]">
          <button className="px-3 py-1.5 text-sm text-gray-400 hover:text-white rounded">
            Cards
          </button>
          <button className="px-3 py-1.5 text-sm bg-[#14b8a6]/20 text-[#2dd4bf] rounded">
            Table
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#0a0a0f] text-sm text-gray-400 border-b border-[#1f1f28]">
              <SortableHeader column="name" className="sticky left-0 bg-[#0a0a0f] z-10">
                Name
              </SortableHeader>
              <SortableHeader column="job">Job</SortableHeader>
              <th className="px-2 py-2 text-left">Pos</th>
              <SortableHeader column="completion">Done</SortableHeader>
              <SortableHeader column="ilv">iLv</SortableHeader>

              {/* Gear Slot Headers */}
              {SLOT_HEADERS.map(slot => (
                <th
                  key={slot.key}
                  className="px-1 py-2 text-center text-xs"
                  title={slot.label}
                >
                  {slot.short}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {sortedPlayers.map((player, index) => {
              const progressColor = getProgressColor(player.completion);

              return (
                <tr
                  key={player.id}
                  className={`
                    border-b border-[#1f1f28] hover:bg-[#121218] transition-colors
                    ${index % 2 === 0 ? 'bg-[#0e0e14]' : 'bg-[#0a0a0f]'}
                  `}
                  style={{
                    borderLeftWidth: '3px',
                    borderLeftColor: progressColor,
                  }}
                >
                  {/* Name (sticky) */}
                  <td className="px-2 py-2 sticky left-0 z-10"
                      style={{ backgroundColor: index % 2 === 0 ? '#0e0e14' : '#0a0a0f' }}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: ROLE_COLORS[player.role] }}
                      />
                      <span className="font-medium text-gray-200">
                        {player.name}
                      </span>
                    </div>
                  </td>

                  {/* Job */}
                  <td className="px-2 py-2">
                    <span
                      className="text-sm font-medium"
                      style={{ color: ROLE_COLORS[player.role] }}
                    >
                      {player.job}
                    </span>
                  </td>

                  {/* Position */}
                  <td className="px-2 py-2 text-sm text-gray-400">
                    {player.position}
                  </td>

                  {/* Completion */}
                  <td className="px-2 py-2">
                    <span
                      className="text-sm font-medium"
                      style={{ color: progressColor }}
                    >
                      {player.completion}%
                    </span>
                  </td>

                  {/* iLv */}
                  <td className="px-2 py-2 text-sm text-gray-300">
                    {player.ilv}
                  </td>

                  {/* Gear Slots */}
                  {player.gear.map(gear => (
                    <td key={gear.slot} className="px-1 py-1.5">
                      <GearCell
                        gear={gear}
                        onChange={(field) => console.log(`Toggle ${field} for ${player.name}'s ${gear.slot}`)}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <span className="text-amber-400 font-bold">R</span>
          <span>= Raid BiS</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-teal-400 font-bold">T</span>
          <span>= Tome BiS</span>
        </div>
        <div className="flex items-center gap-1">
          <input type="checkbox" checked readOnly className="w-3 h-3 accent-[#14b8a6]" />
          <span>= Have</span>
        </div>
        <div className="flex items-center gap-1">
          <input type="checkbox" checked readOnly className="w-3 h-3 accent-amber-400" />
          <span>= Augmented</span>
        </div>

        <div className="flex items-center gap-2 ml-4">
          <span className="text-gray-500">Progress:</span>
          {Object.entries(PROGRESS_COLORS).map(([key, color]) => (
            <div
              key={key}
              className="w-3 h-3 rounded"
              style={{ backgroundColor: color }}
              title={key}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default RosterTableView;
