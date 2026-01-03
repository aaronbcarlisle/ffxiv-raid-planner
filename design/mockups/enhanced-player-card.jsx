/**
 * Enhanced Player Card Mockup
 *
 * Improvements from cross-comparison audit (Appendix C):
 * - C.4: Per-slot iLv display (not just header average)
 * - C.8: Enhanced spacing (12px padding, 32-36px rows)
 * - Planning markers system with popup picker
 * - Current source category badges
 * - Left border status indicators
 * - Progress bar with color gradient
 * - Footer summary (raid pieces, augments, tome weeks)
 */

import React, { useState } from 'react';

// Sample player data matching the app's data model
const mockPlayer = {
  id: '1',
  name: 'Goony',
  job: 'DRG',
  role: 'melee',
  position: 'M1',
  bisLink: 'https://xivgear.app/set/abc123',
  avgIlv: 785,
  gear: [
    { slot: 'weapon', bisSource: 'raid', currentSource: 'tome', hasItem: false, isAugmented: false, itemLevel: 780, markers: ['improve'] },
    { slot: 'head', bisSource: 'raid', currentSource: 'savage', hasItem: true, isAugmented: false, itemLevel: 790, markers: [] },
    { slot: 'body', bisSource: 'tome', currentSource: 'tome', hasItem: true, isAugmented: true, itemLevel: 790, markers: [] },
    { slot: 'hands', bisSource: 'raid', currentSource: 'crafted', hasItem: false, isAugmented: false, itemLevel: 710, markers: ['pages'] },
    { slot: 'legs', bisSource: 'raid', currentSource: 'tome', hasItem: false, isAugmented: true, itemLevel: 790, markers: [] },
    { slot: 'feet', bisSource: 'raid', currentSource: 'normal', hasItem: false, isAugmented: false, itemLevel: 760, markers: ['craft'] },
    { slot: 'earring', bisSource: 'tome', currentSource: 'tome', hasItem: true, isAugmented: false, itemLevel: 780, markers: ['token'] },
    { slot: 'necklace', bisSource: 'raid', currentSource: 'catchup', hasItem: false, isAugmented: false, itemLevel: 780, markers: [] },
    { slot: 'bracelet', bisSource: 'raid', currentSource: 'savage', hasItem: true, isAugmented: false, itemLevel: 790, markers: [] },
    { slot: 'ring1', bisSource: 'tome', currentSource: 'tome', hasItem: true, isAugmented: true, itemLevel: 790, markers: [] },
    { slot: 'ring2', bisSource: 'raid', currentSource: 'tome_up', hasItem: true, isAugmented: false, itemLevel: 790, markers: [] },
  ],
};

// Role colors matching the app
const roleColors = {
  tank: '#5a9fd4',
  healer: '#5ad490',
  melee: '#d45a5a',
  ranged: '#d4a05a',
  caster: '#b45ad4',
};

// Current source category styling (9 categories)
const sourceStyles = {
  savage: 'bg-red-500/15 text-red-400 border-red-500/40',
  tome_up: 'bg-teal-500/15 text-teal-400 border-teal-500/40',
  catchup: 'bg-blue-400/15 text-blue-400 border-blue-400/40',
  tome: 'bg-teal-600/10 text-teal-500 border-teal-600/30',
  relic: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  crafted: 'bg-violet-400/15 text-violet-300 border-violet-400/40',
  prep: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40',
  normal: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
  unknown: 'bg-zinc-600/10 text-zinc-500 border-zinc-600/30',
};

const sourceLabels = {
  savage: 'Savage',
  tome_up: 'Aug Tome',
  catchup: 'Catchup',
  tome: 'Tome',
  relic: 'Relic',
  crafted: 'Crafted',
  prep: 'Prep',
  normal: 'Normal',
  unknown: '???',
};

// Planning markers system
const markers = {
  craft: { icon: '🔨', label: 'Plan to craft', color: 'bg-orange-500/15' },
  pages: { icon: '📃', label: 'Buy with pages', color: 'bg-blue-500/15' },
  floor4: { icon: '♻️', label: 'Floor 4 pages', color: 'bg-green-500/15' },
  alliance: { icon: '💰', label: 'Alliance/Hunts', color: 'bg-yellow-500/15' },
  improve: { icon: '◀️', label: 'Improve next', color: 'bg-teal-500/15' },
  token: { icon: '💾', label: 'Have token', color: 'bg-purple-500/15' },
};

const slotNames = {
  weapon: 'Weapon',
  head: 'Head',
  body: 'Body',
  hands: 'Hands',
  legs: 'Legs',
  feet: 'Feet',
  earring: 'Ears',
  necklace: 'Neck',
  bracelet: 'Wrists',
  ring1: 'R. Ring',
  ring2: 'L. Ring',
};

// Calculate stats from gear
const calculateStats = (gear) => {
  let raidNeeded = 0;
  let augmentsNeeded = 0;
  let tomeWeeks = 0;

  gear.forEach(slot => {
    if (slot.bisSource === 'raid' && !slot.hasItem) {
      raidNeeded++;
    }
    if (slot.bisSource === 'tome' && slot.hasItem && !slot.isAugmented) {
      augmentsNeeded++;
    }
    if (slot.bisSource === 'tome' && !slot.hasItem) {
      tomeWeeks++;
    }
  });

  const completionPercent = Math.round(
    (gear.filter(s =>
      (s.bisSource === 'raid' && s.hasItem) ||
      (s.bisSource === 'tome' && s.hasItem && s.isAugmented)
    ).length / gear.length) * 100
  );

  return { raidNeeded, augmentsNeeded, tomeWeeks, completionPercent };
};

// Get status for left border indicator
const getSlotStatus = (slot) => {
  if (slot.bisSource === 'raid' && slot.hasItem) return 'complete';
  if (slot.bisSource === 'tome' && slot.hasItem && slot.isAugmented) return 'complete';
  if (slot.bisSource === 'tome' && slot.hasItem && !slot.isAugmented) return 'needs-aug';
  if (slot.currentSource === 'savage' || slot.currentSource === 'tome_up') return 'good';
  if (slot.currentSource === 'tome' || slot.currentSource === 'catchup') return 'okay';
  return 'needs';
};

const statusBorders = {
  complete: 'border-l-green-500',
  'needs-aug': 'border-l-yellow-500',
  good: 'border-l-blue-500',
  okay: 'border-l-transparent',
  needs: 'border-l-red-500',
};

// Get progress bar color based on percentage
const getProgressColor = (percent) => {
  if (percent >= 100) return 'from-green-500 to-green-600';
  if (percent >= 75) return 'from-lime-500 to-lime-600';
  if (percent >= 50) return 'from-yellow-500 to-yellow-600';
  if (percent >= 25) return 'from-orange-500 to-orange-600';
  return 'from-red-500 to-red-600';
};

const getProgressTextColor = (percent) => {
  if (percent >= 100) return 'text-green-500';
  if (percent >= 75) return 'text-lime-500';
  if (percent >= 50) return 'text-yellow-500';
  if (percent >= 25) return 'text-orange-500';
  return 'text-red-500';
};

const EnhancedPlayerCard = () => {
  const [hoveredSlot, setHoveredSlot] = useState(null);
  const [markerPickerSlot, setMarkerPickerSlot] = useState(null);

  const stats = calculateStats(mockPlayer.gear);
  const roleColor = roleColors[mockPlayer.role];

  return (
    <div className="min-h-screen bg-[#050508] p-10 font-sans">
      <div className="flex gap-6">
        {/* Enhanced Player Card */}
        <div className="w-[360px] bg-[#0e0e14] rounded-xl border border-[#1f1f28] overflow-hidden shadow-lg">
          {/* Card Header */}
          <div className="p-4 border-b border-[#1f1f28] bg-gradient-to-b from-[#121218] to-[#0e0e14]">
            {/* Top Row: Job + Name + Position + Completion */}
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                {/* Job Icon */}
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
                  style={{
                    background: `linear-gradient(135deg, ${roleColor}40 0%, ${roleColor}20 100%)`,
                    border: `1px solid ${roleColor}60`,
                    color: roleColor,
                  }}
                >
                  {mockPlayer.job}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-[#f0f0f5]">{mockPlayer.name}</span>
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      style={{
                        background: `${roleColor}20`,
                        border: `1px solid ${roleColor}40`,
                        color: roleColor,
                      }}
                    >
                      {mockPlayer.position}
                    </span>
                  </div>
                  <div className="text-xs text-[#52525b] mt-0.5">
                    iLv {mockPlayer.avgIlv}
                  </div>
                </div>
              </div>

              {/* Completion Percentage */}
              <div className="text-right">
                <div className={`text-xl font-bold ${getProgressTextColor(stats.completionPercent)}`}>
                  {stats.completionPercent}%
                </div>
                <div className="text-[10px] text-[#52525b]">
                  {mockPlayer.gear.filter(s => getSlotStatus(s) === 'complete').length}/11 BiS
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-1.5 bg-[#1a1a22] rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${getProgressColor(stats.completionPercent)} rounded-full transition-all duration-300`}
                style={{
                  width: `${stats.completionPercent}%`,
                  boxShadow: '0 0 8px currentColor',
                }}
              />
            </div>

            {/* BiS Link */}
            <a
              href={mockPlayer.bisLink}
              className="inline-flex items-center gap-1 text-[11px] text-[#14b8a6] mt-2.5 hover:underline"
            >
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                <path d="M5 2H3C2.44772 2 2 2.44772 2 3V9C2 9.55228 2.44772 10 3 10H9C9.55228 10 10 9.55228 10 9V7M7 2H10M10 2V5M10 2L5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              BiS Set
            </a>
          </div>

          {/* Gear Table */}
          <div className="py-1">
            {/* Table Header - C.8 enhanced spacing */}
            <div className="grid px-3 py-2 border-b border-[#14141c]" style={{ gridTemplateColumns: '72px 1fr 44px 44px 32px' }}>
              <div className="text-[10px] font-semibold text-[#52525b] uppercase tracking-wide">Slot</div>
              <div className="text-[10px] font-semibold text-[#52525b] uppercase tracking-wide">Current</div>
              <div className="text-[10px] font-semibold text-[#52525b] uppercase tracking-wide text-center">BiS</div>
              <div className="text-[10px] font-semibold text-[#52525b] uppercase tracking-wide text-center">Have</div>
              <div className="text-[10px] font-semibold text-[#52525b] uppercase tracking-wide text-center" title="Planning Markers">
                <span className="opacity-50">📌</span>
              </div>
            </div>

            {/* Gear Rows - C.8 compact row height (32-36px) */}
            {mockPlayer.gear.map((slot) => {
              const status = getSlotStatus(slot);
              const isComplete = status === 'complete';
              const isHovered = hoveredSlot === slot.slot;

              return (
                <div
                  key={slot.slot}
                  onMouseEnter={() => setHoveredSlot(slot.slot)}
                  onMouseLeave={() => setHoveredSlot(null)}
                  className={`
                    grid items-center px-3 py-2 border-l-[3px] transition-colors
                    ${statusBorders[status]}
                    ${isHovered ? 'bg-teal-500/[0.03]' : 'bg-transparent'}
                  `}
                  style={{ gridTemplateColumns: '72px 1fr 44px 44px 32px' }}
                >
                  {/* Slot Name */}
                  <div className="text-[13px] font-medium text-[#f0f0f5]">
                    {slotNames[slot.slot]}
                  </div>

                  {/* Current Source Badge + iLv (C.4) */}
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${sourceStyles[slot.currentSource]}`}>
                      {sourceLabels[slot.currentSource]}
                    </span>
                    <span className="text-[10px] text-[#52525b]">
                      {slot.itemLevel}
                    </span>
                  </div>

                  {/* BiS Source Badge */}
                  <div className="text-center">
                    <span className={`
                      text-[9px] font-bold px-1 py-0.5 rounded
                      ${slot.bisSource === 'raid'
                        ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                        : 'bg-teal-500/15 text-teal-400 border border-teal-500/30'
                      }
                    `}>
                      {slot.bisSource === 'raid' ? 'RAID' : 'TOME'}
                    </span>
                  </div>

                  {/* Have Checkbox */}
                  <div className="flex justify-center">
                    <div className={`
                      w-4 h-4 rounded flex items-center justify-center cursor-pointer transition-colors
                      ${isComplete
                        ? 'bg-green-500/20 border-2 border-green-500'
                        : 'bg-[#121218] border border-[#3f3f46] hover:border-[#52525b]'
                      }
                    `}>
                      {isComplete && (
                        <svg className="w-2.5 h-2.5 text-green-500" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Markers Column */}
                  <div className="relative flex justify-center">
                    {slot.markers.length > 0 ? (
                      <div className="flex gap-0.5">
                        {slot.markers.map(m => (
                          <span
                            key={m}
                            title={markers[m]?.label}
                            className="text-xs cursor-pointer hover:scale-110 transition-transform"
                          >
                            {markers[m]?.icon}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <button
                        onClick={() => setMarkerPickerSlot(markerPickerSlot === slot.slot ? null : slot.slot)}
                        className="w-5 h-5 rounded border border-dashed border-[#3f3f46] text-[#52525b] text-xs flex items-center justify-center hover:border-[#52525b] hover:text-[#71717a] transition-colors"
                      >
                        +
                      </button>
                    )}

                    {/* Marker Picker Popover */}
                    {markerPickerSlot === slot.slot && (
                      <div className="absolute top-full right-0 mt-1 bg-[#1a1a22] border border-[#2f2f3a] rounded-lg p-2 flex gap-1 z-50 shadow-xl">
                        {Object.entries(markers).map(([key, { icon, label, color }]) => (
                          <button
                            key={key}
                            title={label}
                            className={`w-7 h-7 rounded-md ${color} text-sm hover:scale-110 transition-transform`}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Card Footer - Needs Summary */}
          <div className="px-3 py-2.5 border-t border-[#1f1f28] bg-[#0a0a0f] flex justify-between text-[11px]">
            <div className="text-[#52525b]">
              <span className="text-red-400 font-semibold">{stats.raidNeeded}</span> raid pieces
            </div>
            <div className="text-[#52525b]">
              <span className="text-yellow-500 font-semibold">{stats.augmentsNeeded}</span> augments
            </div>
            <div className="text-[#52525b]">
              <span className="text-teal-500 font-semibold">{stats.tomeWeeks}</span> tome weeks
            </div>
          </div>
        </div>

        {/* Legend Panel */}
        <div className="w-56 bg-[#0e0e14] rounded-xl border border-[#1f1f28] p-4 h-fit">
          <h3 className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider mb-4">
            Planning Markers
          </h3>
          <div className="flex flex-col gap-2.5">
            {Object.entries(markers).map(([key, { icon, label }]) => (
              <div key={key} className="flex items-center gap-2.5">
                <span className="text-base">{icon}</span>
                <span className="text-xs text-[#a1a1aa]">{label}</span>
              </div>
            ))}
          </div>

          <h3 className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider mt-6 mb-4">
            Status Borders
          </h3>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-1 h-4 bg-green-500 rounded-sm" />
              <span className="text-xs text-[#a1a1aa]">BiS Complete</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-1 h-4 bg-yellow-500 rounded-sm" />
              <span className="text-xs text-[#a1a1aa]">Needs Augment</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-1 h-4 bg-blue-500 rounded-sm" />
              <span className="text-xs text-[#a1a1aa]">Good Progress</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-1 h-4 bg-red-500 rounded-sm" />
              <span className="text-xs text-[#a1a1aa]">Needs Raid Drop</span>
            </div>
          </div>

          <h3 className="text-[11px] font-bold text-[#a1a1aa] uppercase tracking-wider mt-6 mb-4">
            Current Sources
          </h3>
          <div className="flex flex-col gap-2">
            {Object.entries(sourceLabels).slice(0, 6).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${sourceStyles[key]}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Design Notes */}
      <div className="mt-8 p-4 bg-[#0a0a0f] rounded-lg border border-[#1f1f28] max-w-2xl text-xs text-[#71717a]">
        <div className="font-semibold text-[#a1a1aa] mb-2">Design Notes (Appendix C)</div>
        <ul className="space-y-1 list-disc list-inside">
          <li><strong>C.4:</strong> Per-slot iLv display next to current source badge</li>
          <li><strong>C.8:</strong> Compact spacing - 12px padding, 32-36px row height for density</li>
          <li>Left border indicates slot status at a glance</li>
          <li>5-column layout: Slot | Current+iLv | BiS | Have | Markers</li>
          <li>Footer summary shows remaining work: raid pieces, augments, tome weeks</li>
          <li>9 current source categories with distinct color badges</li>
          <li>6 planning markers for gear acquisition strategy</li>
        </ul>
      </div>
    </div>
  );
};

export default EnhancedPlayerCard;
