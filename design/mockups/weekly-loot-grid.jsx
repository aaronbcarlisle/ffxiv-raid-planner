/**
 * FFXIV Raid Planner - Weekly Loot Grid Mockup
 *
 * Spreadsheet-style weekly loot tracking with:
 * - Floor-colored section headers
 * - Loot count summary bar with fairness indicators
 * - Per-floor notes input
 * - Role-colored recipient badges
 * - Week navigation
 *
 * From Cross-Comparison: Appendix C.2
 */

import React, { useState } from 'react';

// Mock player data
const mockPlayers = [
  { id: '1', name: 'Pally', job: 'PLD', role: 'tank', position: 'T1', lootCount: 3 },
  { id: '2', name: 'MrDark', job: 'DRK', role: 'tank', position: 'T2', lootCount: 1 },
  { id: '3', name: 'Scholy', job: 'SCH', role: 'healer', position: 'H1', lootCount: 4 },
  { id: '4', name: 'Whitey', job: 'WHM', role: 'healer', position: 'H2', lootCount: 2 },
  { id: '5', name: 'Goony', job: 'DRG', role: 'melee', position: 'M1', lootCount: 5 },
  { id: '6', name: 'Punchy', job: 'MNK', role: 'melee', position: 'M2', lootCount: 2 },
  { id: '7', name: 'Dancy', job: 'DNC', role: 'ranged', position: 'R1', lootCount: 3 },
  { id: '8', name: 'Leylie', job: 'BLM', role: 'caster', position: 'R2', lootCount: 4 },
];

// Floor configuration with colors
const floors = [
  {
    id: 'M9S',
    number: 1,
    book: 'I',
    color: '#22c55e', // Green
    items: [
      { slot: 'earring', name: 'Ears' },
      { slot: 'necklace', name: 'Neck' },
      { slot: 'bracelet', name: 'Wrists' },
      { slot: 'ring', name: 'Ring' },
    ],
    materials: [{ type: 'glaze', name: 'Glaze' }],
  },
  {
    id: 'M10S',
    number: 2,
    book: 'II',
    color: '#3b82f6', // Blue
    items: [
      { slot: 'head', name: 'Head' },
      { slot: 'hands', name: 'Hands' },
      { slot: 'feet', name: 'Feet' },
    ],
    materials: [{ type: 'glaze', name: 'Glaze' }],
  },
  {
    id: 'M11S',
    number: 3,
    book: 'III',
    color: '#a855f7', // Purple
    items: [
      { slot: 'body', name: 'Chest' },
      { slot: 'legs', name: 'Legs' },
    ],
    materials: [
      { type: 'twine', name: 'Twine' },
      { type: 'solvent', name: 'Solvent' },
    ],
  },
  {
    id: 'M12S',
    number: 4,
    book: 'IV',
    color: '#f59e0b', // Amber
    items: [
      { slot: 'weapon', name: 'Weapon' },
      { slot: 'coffer', name: 'Coffer' },
    ],
    materials: [],
    extras: [{ type: 'mount', name: 'Mount' }],
  },
];

// Role colors matching the app
const roleColors = {
  tank: '#5a9fd4',
  healer: '#5ad490',
  melee: '#d45a5a',
  ranged: '#d4a05a',
  caster: '#b45ad4',
};

// Material colors
const materialColors = {
  twine: '#c4b5fd',
  glaze: '#fcd34d',
  solvent: '#f87171',
};

// Mock loot log for week 3
const mockLootLog = {
  M9S: {
    earring: { recipientId: '3', recipientName: 'Scholy' },
    necklace: { recipientId: '5', recipientName: 'Goony' },
    bracelet: null,
    ring: { recipientId: '1', recipientName: 'Pally' },
    glaze: { recipientId: '4', recipientName: 'Whitey' },
  },
  M10S: {
    head: { recipientId: '7', recipientName: 'Dancy' },
    hands: { recipientId: '8', recipientName: 'Leylie' },
    feet: null,
    glaze: { recipientId: '6', recipientName: 'Punchy' },
  },
  M11S: {
    body: { recipientId: '2', recipientName: 'MrDark' },
    legs: { recipientId: '5', recipientName: 'Goony' },
    twine: { recipientId: '3', recipientName: 'Scholy' },
    solvent: null,
  },
  M12S: {
    weapon: null,
    coffer: null,
    mount: null,
  },
};

// Mock notes
const mockNotes = {
  M9S: 'Ring went to Pally for MT priority',
  M10S: '',
  M11S: 'Goony got legs for 2-set bonus',
  M12S: '',
};

const WeeklyLootGrid = () => {
  const [currentWeek, setCurrentWeek] = useState(3);
  const [selectedCell, setSelectedCell] = useState(null);
  const [showPlayerPicker, setShowPlayerPicker] = useState(false);
  const [notes, setNotes] = useState(mockNotes);

  // Calculate average loot for fairness coloring
  const avgLoot = mockPlayers.reduce((sum, p) => sum + p.lootCount, 0) / mockPlayers.length;

  const getLootCountStyle = (count) => {
    if (count > avgLoot + 1) return { color: '#3b82f6', label: 'Most' };  // Blue
    if (count < avgLoot - 1) return { color: '#eab308', label: 'Least' }; // Yellow
    return { color: '#a1a1aa', label: 'Average' };                        // Gray
  };

  const getPlayerById = (id) => mockPlayers.find(p => p.id === id);

  return (
    <div className="min-h-screen bg-[#050508] p-6 font-sans text-[#f0f0f5]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Weekly Loot Grid</h1>
          <p className="text-sm text-[#52525b] mt-1">Track loot distribution week by week</p>
        </div>

        {/* Week Navigator */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentWeek(Math.max(1, currentWeek - 1))}
            className="w-9 h-9 rounded-lg border border-[#1f1f28] bg-[#121218] text-[#a1a1aa] hover:border-[#14b8a6]/30 hover:text-white transition-colors flex items-center justify-center"
          >
            ←
          </button>
          <div className="px-5 py-2 bg-[#0e0e14] rounded-lg border border-[#1f1f28]">
            <span className="text-[#52525b] text-sm">Week</span>
            <span className="ml-2 text-xl font-bold text-[#14b8a6]">{currentWeek}</span>
          </div>
          <button
            onClick={() => setCurrentWeek(currentWeek + 1)}
            className="w-9 h-9 rounded-lg border border-[#1f1f28] bg-[#121218] text-[#a1a1aa] hover:border-[#14b8a6]/30 hover:text-white transition-colors flex items-center justify-center"
          >
            →
          </button>
        </div>
      </div>

      {/* Loot Count Summary Bar */}
      <div className="flex gap-3 mb-6 p-4 bg-[#0e0e14] rounded-xl border border-[#1f1f28]">
        {mockPlayers.map(player => {
          const style = getLootCountStyle(player.lootCount);
          return (
            <div
              key={player.id}
              className="flex-1 text-center p-3 bg-[#121218] rounded-lg"
              style={{ borderColor: `${roleColors[player.role]}30`, borderWidth: '1px' }}
            >
              <div
                className="text-xs font-semibold mb-1"
                style={{ color: roleColors[player.role] }}
              >
                {player.position}
              </div>
              <div className="text-xs text-[#71717a] mb-1">{player.name}</div>
              <div className="text-2xl font-bold" style={{ color: style.color }}>
                {player.lootCount}
              </div>
              <div className="text-[9px] text-[#52525b] uppercase">drops</div>
            </div>
          );
        })}
      </div>

      {/* Main Grid */}
      <div className="bg-[#0e0e14] rounded-xl border border-[#1f1f28] overflow-hidden shadow-lg">
        {floors.map((floor, floorIdx) => (
          <div key={floor.id}>
            {/* Floor Header */}
            <div
              className="flex items-center px-4 py-3"
              style={{
                backgroundColor: `${floor.color}15`,
                borderTop: floorIdx > 0 ? '1px solid #1f1f28' : 'none',
              }}
            >
              <div
                className="w-1 h-6 rounded mr-3"
                style={{ backgroundColor: floor.color }}
              />
              <div className="font-bold" style={{ color: floor.color }}>
                {floor.id}
              </div>
              <div className="ml-3 text-xs text-[#52525b]">
                Floor {floor.number} • Book {floor.book}
              </div>
            </div>

            {/* Loot Row */}
            <div className="grid grid-cols-[80px_repeat(4,1fr)_repeat(2,100px)] border-b border-[#14141c]">
              <div className="px-4 py-3 text-xs font-semibold text-[#52525b] uppercase bg-[#0a0a0f]">
                Loot
              </div>

              {/* Item columns */}
              {floor.items.map(item => {
                const lootData = mockLootLog[floor.id]?.[item.slot];
                const recipient = lootData?.recipientName;
                const recipientPlayer = getPlayerById(lootData?.recipientId);

                return (
                  <div
                    key={item.slot}
                    onClick={() => {
                      setSelectedCell({ floor: floor.id, slot: item.slot });
                      setShowPlayerPicker(true);
                    }}
                    className="px-3 py-2.5 border-l border-[#14141c] cursor-pointer hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="text-[10px] text-[#52525b] mb-1">{item.name}</div>
                    {recipient ? (
                      <div
                        className="inline-block text-xs font-semibold px-2 py-1 rounded"
                        style={{
                          color: recipientPlayer ? roleColors[recipientPlayer.role] : '#f0f0f5',
                          backgroundColor: recipientPlayer ? `${roleColors[recipientPlayer.role]}15` : '#1a1a22',
                          border: `1px solid ${recipientPlayer ? `${roleColors[recipientPlayer.role]}30` : '#2f2f3a'}`,
                        }}
                      >
                        {recipient}
                      </div>
                    ) : (
                      <div className="text-xs text-[#3f3f46] italic">—</div>
                    )}
                  </div>
                );
              })}

              {/* Pad empty item columns */}
              {Array(4 - floor.items.length).fill(null).map((_, i) => (
                <div key={i} className="border-l border-[#14141c]" />
              ))}

              {/* Material columns */}
              {floor.materials.map(mat => {
                const matData = mockLootLog[floor.id]?.[mat.type];
                const recipient = matData?.recipientName;
                const recipientPlayer = getPlayerById(matData?.recipientId);

                return (
                  <div
                    key={mat.type}
                    className="px-3 py-2.5 border-l border-[#1f1f28] bg-[#0a0a0f] cursor-pointer"
                  >
                    <div className="text-[10px] mb-1" style={{ color: materialColors[mat.type] }}>
                      {mat.name}
                    </div>
                    {recipient ? (
                      <div className="text-xs font-semibold" style={{ color: recipientPlayer ? roleColors[recipientPlayer.role] : '#a1a1aa' }}>
                        {recipient}
                      </div>
                    ) : (
                      <div className="text-xs text-[#3f3f46] italic">—</div>
                    )}
                  </div>
                );
              })}

              {/* Pad empty material columns */}
              {Array(2 - floor.materials.length).fill(null).map((_, i) => (
                <div key={i} className="border-l border-[#1f1f28] bg-[#0a0a0f]" />
              ))}
            </div>

            {/* Notes Row */}
            <div className="grid grid-cols-[80px_1fr]">
              <div className="px-4 py-2 text-xs font-semibold text-[#3f3f46] bg-[#0a0a0f]">
                Notes
              </div>
              <div className="px-3 py-2 border-l border-[#14141c]">
                <input
                  type="text"
                  value={notes[floor.id] || ''}
                  onChange={(e) => setNotes({ ...notes, [floor.id]: e.target.value })}
                  placeholder="Add notes for this floor..."
                  className="w-full bg-transparent border-none text-xs text-[#a1a1aa] placeholder-[#3f3f46] outline-none"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mt-5 flex gap-3">
        <button className="px-6 py-3 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-[#14b8a6] to-[#0891b2] shadow-[0_4px_12px_rgba(20,184,166,0.3)] hover:brightness-110 transition-all">
          Mark All Floors Cleared
        </button>
        <button className="px-6 py-3 rounded-lg font-semibold text-sm text-[#a1a1aa] bg-[#121218] border border-[#1f1f28] hover:border-[#14b8a6]/30 hover:text-white transition-colors">
          Copy to Next Week
        </button>
        <button className="px-6 py-3 rounded-lg font-semibold text-sm text-[#a1a1aa] bg-[#121218] border border-[#1f1f28] hover:border-[#14b8a6]/30 hover:text-white transition-colors">
          Export Week Summary
        </button>
      </div>

      {/* Fairness Legend */}
      <div className="mt-4 flex items-center gap-6 text-xs text-[#71717a]">
        <span className="text-[#52525b]">Loot fairness:</span>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-[#3b82f6]" />
          <span>Most (&gt;avg+1)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-[#a1a1aa]" />
          <span>Average</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-[#eab308]" />
          <span>Least (&lt;avg-1)</span>
        </div>
      </div>

      {/* Player Picker Modal */}
      {showPlayerPicker && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setShowPlayerPicker(false)}
        >
          <div
            className="bg-[#121218] rounded-xl border border-[#2f2f3a] p-5 min-w-[320px] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-[#f0f0f5] mb-4">Select Recipient</h3>
            <div className="grid grid-cols-2 gap-2">
              {mockPlayers.map(player => (
                <button
                  key={player.id}
                  className="p-3 rounded-lg text-left transition-all"
                  style={{
                    backgroundColor: `${roleColors[player.role]}10`,
                    border: `1px solid ${roleColors[player.role]}40`,
                  }}
                  onClick={() => setShowPlayerPicker(false)}
                >
                  <div className="text-sm font-semibold" style={{ color: roleColors[player.role] }}>
                    {player.name}
                  </div>
                  <div className="text-[10px] text-[#52525b] mt-0.5">
                    {player.job} • {player.lootCount} drops
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-[#2f2f3a]">
              <button
                onClick={() => setShowPlayerPicker(false)}
                className="w-full py-2.5 rounded-lg border border-[#3f3f46] text-[#a1a1aa] text-sm hover:border-[#52525b] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeeklyLootGrid;
