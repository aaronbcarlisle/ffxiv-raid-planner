/**
 * "Who Needs It?" View Mockup
 *
 * This component shows a quick-reference grid of who needs what from each floor.
 * Design inspired by the Arcadion spreadsheet's "Who Needs It?" tab.
 *
 * Key UX principles:
 * - All 8 players visible at once
 * - Position-first headers (T1, H1, M1, etc.) for raid context
 * - "FREE" badge when no one needs an item
 * - Floor filter tabs
 * - Single-click to log loot
 *
 * Cross-Comparison Updates (Appendix C):
 * - C.1: FREE badge for free roll items
 * - C.3: Position-first headers
 */

import React, { useState } from 'react';

// Mock players with positions (raid-relevant order)
const mockPlayers = [
  { id: '1', name: 'Pally', job: 'PLD', role: 'tank', position: 'T1', color: '#5a9fd4' },
  { id: '2', name: 'MrDark', job: 'DRK', role: 'tank', position: 'T2', color: '#5a9fd4' },
  { id: '3', name: 'Scholy', job: 'SCH', role: 'healer', position: 'H1', color: '#5ad490' },
  { id: '4', name: 'Whitey', job: 'WHM', role: 'healer', position: 'H2', color: '#5ad490' },
  { id: '5', name: 'Goony', job: 'DRG', role: 'melee', position: 'M1', color: '#d45a5a' },
  { id: '6', name: 'Punchy', job: 'MNK', role: 'melee', position: 'M2', color: '#d45a5a' },
  { id: '7', name: 'Dancy', job: 'DNC', role: 'ranged', position: 'R1', color: '#d4a05a' },
  { id: '8', name: 'Leylie', job: 'BLM', role: 'caster', position: 'R2', color: '#b45ad4' },
];

// Floor configuration with colors
const floors = {
  all: { name: 'All Floors', items: [] },
  M12S: {
    name: 'M12S',
    number: 4,
    color: '#f59e0b',
    items: ['Weapon'],
  },
  M11S: {
    name: 'M11S',
    number: 3,
    color: '#a855f7',
    items: ['Body', 'Legs'],
  },
  M10S: {
    name: 'M10S',
    number: 2,
    color: '#3b82f6',
    items: ['Head', 'Hands', 'Feet'],
  },
  M9S: {
    name: 'M9S',
    number: 1,
    color: '#22c55e',
    items: ['Ears', 'Neck', 'Wrists', 'Ring'],
  },
};

// Generate all items for "All" view
const allItems = [...floors.M9S.items, ...floors.M10S.items, ...floors.M11S.items, ...floors.M12S.items];
floors.all.items = allItems;

// Mock needs data - who needs what
const mockNeeds = {
  '1': ['Weapon', 'Head', 'Body', 'Legs', 'Ears'],
  '2': ['Weapon', 'Hands', 'Feet', 'Neck', 'Ring'],
  '3': ['Weapon', 'Head', 'Body', 'Wrists'],
  '4': ['Weapon', 'Legs', 'Feet', 'Ears', 'Neck'],
  '5': ['Head', 'Hands', 'Wrists', 'Ring'],
  '6': ['Weapon', 'Body', 'Legs', 'Feet'],
  '7': ['Weapon', 'Head', 'Hands', 'Ears', 'Neck', 'Wrists'],
  '8': ['Head', 'Body', 'Hands', 'Legs', 'Feet', 'Ring'],
};

// Helper to convert hex to rgba
const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const WhoNeedsItView = () => {
  const [selectedFloor, setSelectedFloor] = useState('all');
  const [highlightedItem, setHighlightedItem] = useState(null);

  const currentFloor = floors[selectedFloor];
  const visibleItems = currentFloor.items;

  // Count how many players need each item
  const countNeeds = (item) => {
    return mockPlayers.filter(p => mockNeeds[p.id]?.includes(item)).length;
  };

  // Check if item is free roll
  const isFreeRoll = (item) => countNeeds(item) === 0;

  return (
    <div className="min-h-screen bg-[#050508] p-6 font-sans text-[#f0f0f5]">
      {/* Header with Floor Tabs */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#14b8a6] to-[#2dd4bf] bg-clip-text text-transparent">
            Who Needs It?
          </h1>
          <p className="text-sm text-[#a1a1aa] mt-1">Quick reference for loot distribution</p>
        </div>

        {/* Floor Filter Tabs */}
        <div className="flex gap-2 bg-[#0e0e14] p-1 rounded-lg border border-[#1f1f28]">
          {Object.entries(floors).map(([key, floor]) => (
            <button
              key={key}
              onClick={() => setSelectedFloor(key)}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                selectedFloor === key
                  ? 'bg-gradient-to-r from-[#14b8a6] to-[#0891b2] text-white'
                  : 'text-[#a1a1aa] hover:text-white'
              }`}
            >
              {floor.name}
            </button>
          ))}
        </div>
      </div>

      {/* Matrix Grid */}
      <div className="bg-[#0e0e14] rounded-xl border border-[#1f1f28] overflow-hidden shadow-lg">
        {/* Header Row with Position-First Labels */}
        <div
          className="grid border-b border-[#1f1f28] bg-[#121218]"
          style={{ gridTemplateColumns: `120px repeat(${mockPlayers.length}, 1fr)` }}
        >
          <div className="px-4 py-3 text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider">
            Item
          </div>
          {mockPlayers.map(player => (
            <div
              key={player.id}
              className="px-2 py-3 text-center border-l border-[#1f1f28]"
            >
              {/* Position (most important) */}
              <div className="text-xs font-bold mb-0.5" style={{ color: player.color }}>
                {player.position}
              </div>
              {/* Name */}
              <div className="text-sm font-semibold text-[#f0f0f5]">{player.name}</div>
              {/* Job */}
              <div className="text-[10px] text-[#52525b] mt-0.5">{player.job}</div>
            </div>
          ))}
        </div>

        {/* Item Rows */}
        {visibleItems.map((item, idx) => {
          const needs = countNeeds(item);
          const freeRoll = isFreeRoll(item);
          const isHighlighted = highlightedItem === item;

          return (
            <div
              key={item}
              onMouseEnter={() => setHighlightedItem(item)}
              onMouseLeave={() => setHighlightedItem(null)}
              className="grid transition-colors"
              style={{
                gridTemplateColumns: `120px repeat(${mockPlayers.length}, 1fr)`,
                backgroundColor: isHighlighted ? 'rgba(20, 184, 166, 0.05)' : 'transparent',
                borderBottom: idx < visibleItems.length - 1 ? '1px solid #14141c' : 'none',
              }}
            >
              {/* Item Label */}
              <div className="px-4 py-3.5 flex items-center gap-2.5">
                <span className={`text-sm font-medium ${freeRoll ? 'text-[#22c55e]' : 'text-[#f0f0f5]'}`}>
                  {item}
                </span>

                {/* FREE Badge - C.1 */}
                {freeRoll && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/30">
                    FREE
                  </span>
                )}

                {/* Need count */}
                {!freeRoll && (
                  <span className={`text-xs ${
                    needs > 4 ? 'text-[#f87171]' : needs > 2 ? 'text-[#eab308]' : 'text-[#a1a1aa]'
                  }`}>
                    {needs}/8
                  </span>
                )}
              </div>

              {/* Player Need Indicators */}
              {mockPlayers.map(player => {
                const playerNeeds = mockNeeds[player.id]?.includes(item);
                return (
                  <div
                    key={player.id}
                    className="px-2 py-3.5 flex justify-center items-center border-l border-[#14141c]"
                  >
                    {playerNeeds ? (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
                        style={{
                          backgroundColor: hexToRgba(player.color, 0.2),
                          border: `2px solid ${player.color}`,
                          boxShadow: isHighlighted ? `0 0 12px ${hexToRgba(player.color, 0.4)}` : 'none',
                        }}
                        onClick={() => console.log(`Log ${item} to ${player.name}`)}
                        title={`${player.name} needs ${item}`}
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: player.color }}
                        />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[#1a1a22] border border-[#252530]" />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-5 flex items-center gap-6 p-4 bg-[#0a0a0f] rounded-lg border border-[#14141c]">
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-full"
            style={{
              backgroundColor: 'rgba(90, 159, 212, 0.2)',
              border: '2px solid #5a9fd4',
            }}
          />
          <span className="text-xs text-[#a1a1aa]">Needs for BiS</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-[#1a1a22] border border-[#252530]" />
          <span className="text-xs text-[#a1a1aa]">Has or not BiS</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/30">
            FREE
          </span>
          <span className="text-xs text-[#a1a1aa]">No one needs (free roll)</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-5 flex gap-3">
        <button className="px-6 py-3 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-[#14b8a6] to-[#0891b2] shadow-[0_4px_12px_rgba(20,184,166,0.3)] hover:brightness-110 transition-all">
          + Log Loot Drop
        </button>
        <button className="px-6 py-3 rounded-lg font-semibold text-sm text-[#a1a1aa] bg-[#121218] border border-[#1f1f28] hover:border-[#14b8a6]/30 hover:text-white transition-colors">
          Mark Floor Cleared
        </button>
      </div>

      {/* Keyboard Hint */}
      <div className="mt-4 p-3 bg-[#0a0a0f] rounded border border-[#1f1f28] text-xs text-[#52525b]">
        <span className="text-[#71717a] font-medium">Tip:</span>{' '}
        Click an indicator to quick-log to that player. Shift+Click to open details modal.
      </div>
    </div>
  );
};

export default WhoNeedsItView;
