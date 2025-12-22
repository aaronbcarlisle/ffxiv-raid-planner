import React, { useState, useMemo, useCallback } from 'react';

// ============================================================================
// CONSTANTS & DATA
// ============================================================================

const TOME_CAP_PER_WEEK = 450;

const GEAR_SLOTS = [
  'weapon', 'helmet', 'chest', 'gloves', 'legs', 'feet',
  'earring', 'necklace', 'bracelet', 'ring1', 'ring2'
];

const LEFT_SIDE_SLOTS = ['helmet', 'chest', 'gloves', 'legs', 'feet'];
const RIGHT_SIDE_SLOTS = ['earring', 'necklace', 'bracelet', 'ring1', 'ring2'];

const SLOT_LABELS = {
  weapon: 'Weapon', helmet: 'Helmet', chest: 'Chest', gloves: 'Gloves',
  legs: 'Legs', feet: 'Feet', earring: 'Earring', necklace: 'Necklace',
  bracelet: 'Bracelet', ring1: 'Ring', ring2: 'Ring'
};

const TOME_COSTS = {
  weapon: 500, helmet: 495, chest: 825, gloves: 495, legs: 825,
  feet: 495, earring: 375, necklace: 375, bracelet: 375, ring1: 375, ring2: 375
};

const BOOK_COSTS = {
  weapon: { floor: 4, cost: 8 }, helmet: { floor: 2, cost: 4 },
  chest: { floor: 3, cost: 6 }, gloves: { floor: 2, cost: 4 },
  legs: { floor: 3, cost: 6 }, feet: { floor: 2, cost: 4 },
  earring: { floor: 1, cost: 3 }, necklace: { floor: 1, cost: 3 },
  bracelet: { floor: 1, cost: 3 }, ring1: { floor: 1, cost: 3 }, ring2: { floor: 1, cost: 3 }
};

// Priority weights for loot calculation
const SLOT_WEIGHTS = {
  weapon: 3.0, chest: 1.5, legs: 1.5,
  helmet: 1.0, gloves: 1.0, feet: 1.0,
  earring: 0.8, necklace: 0.8, bracelet: 0.8, ring1: 0.8, ring2: 0.8
};

// Job definitions with roles and icons
const JOBS = {
  // Tanks
  PLD: { name: 'Paladin', role: 'tank', icon: '🛡️', color: '#3d5a80' },
  WAR: { name: 'Warrior', role: 'tank', icon: '⚔️', color: '#3d5a80' },
  DRK: { name: 'Dark Knight', role: 'tank', icon: '🗡️', color: '#3d5a80' },
  GNB: { name: 'Gunbreaker', role: 'tank', icon: '🔫', color: '#3d5a80' },
  // Healers
  WHM: { name: 'White Mage', role: 'healer', icon: '✨', color: '#3d7a5a' },
  SCH: { name: 'Scholar', role: 'healer', icon: '📖', color: '#3d7a5a' },
  AST: { name: 'Astrologian', role: 'healer', icon: '🌟', color: '#3d7a5a' },
  SGE: { name: 'Sage', role: 'healer', icon: '💠', color: '#3d7a5a' },
  // Melee DPS
  MNK: { name: 'Monk', role: 'melee', icon: '👊', color: '#7a3d3d' },
  DRG: { name: 'Dragoon', role: 'melee', icon: '🐉', color: '#7a3d3d' },
  NIN: { name: 'Ninja', role: 'melee', icon: '🥷', color: '#7a3d3d' },
  SAM: { name: 'Samurai', role: 'melee', icon: '⚔️', color: '#7a3d3d' },
  RPR: { name: 'Reaper', role: 'melee', icon: '🌙', color: '#7a3d3d' },
  VPR: { name: 'Viper', role: 'melee', icon: '🐍', color: '#7a3d3d' },
  // Ranged DPS
  BRD: { name: 'Bard', role: 'ranged', icon: '🎵', color: '#7a5a3d' },
  MCH: { name: 'Machinist', role: 'ranged', icon: '🔧', color: '#7a5a3d' },
  DNC: { name: 'Dancer', role: 'ranged', icon: '💃', color: '#7a5a3d' },
  // Caster DPS
  BLM: { name: 'Black Mage', role: 'caster', icon: '🔥', color: '#5a3d7a' },
  SMN: { name: 'Summoner', role: 'caster', icon: '🔮', color: '#5a3d7a' },
  RDM: { name: 'Red Mage', role: 'caster', icon: '⚡', color: '#5a3d7a' },
  PCT: { name: 'Pictomancer', role: 'caster', icon: '🎨', color: '#5a3d7a' },
};

const ROLE_COLORS = {
  tank: { bg: '#1a3a5c', border: '#2d5a8a', header: '#0d2840', text: '#6eb5ff' },
  healer: { bg: '#1a3d2e', border: '#2d6b4f', header: '#0d2818', text: '#6effa5' },
  melee: { bg: '#4a1a1a', border: '#8a2d2d', header: '#2d0d0d', text: '#ff6e6e' },
  ranged: { bg: '#4a3a1a', border: '#8a6d2d', header: '#2d1d0d', text: '#ffb56e' },
  caster: { bg: '#3a1a4a', border: '#6d2d8a', header: '#1d0d2d', text: '#b56eff' },
};

// Default priority order (can be customized by users)
const DEFAULT_PRIORITY_ORDER = [
  { role: 'melee', label: 'Melee DPS', priority: 1 },
  { role: 'ranged', label: 'Ranged DPS', priority: 2 },
  { role: 'caster', label: 'Caster DPS', priority: 3 },
  { role: 'tank', label: 'Tanks', priority: 4 },
  { role: 'healer', label: 'Healers', priority: 5 },
];

// Sample player data
const initialPlayers = [
  { id: 1, name: 'Alexander', job: 'PLD', lodestoneId: '', etroLink: '', fflogsId: '' },
  { id: 2, name: 'Grimm', job: 'DRK', lodestoneId: '', etroLink: '', fflogsId: '' },
  { id: 3, name: 'Binckle', job: 'SCH', lodestoneId: '', etroLink: '', fflogsId: '' },
  { id: 4, name: 'Demonic', job: 'WHM', lodestoneId: '', etroLink: 'https://xivgear.app/?page=sl|73551c', fflogsId: '' },
  { id: 5, name: 'Lloyd', job: 'DRG', lodestoneId: '', etroLink: '', fflogsId: '18370865' },
  { id: 6, name: 'Theo', job: 'VPR', lodestoneId: '', etroLink: 'https://xivgear.app/?page=bis|vpr|cur', fflogsId: '' },
  { id: 7, name: 'Ferus', job: 'DNC', lodestoneId: '', etroLink: '', fflogsId: '' },
  { id: 8, name: 'Vel', job: 'RDM', lodestoneId: '', etroLink: '', fflogsId: '' },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const generateInitialGear = () => {
  const gear = {};
  GEAR_SLOTS.forEach(slot => {
    gear[slot] = { bisSource: 'raid', hasItem: false, isAugmented: false };
  });
  return gear;
};

const calculatePlayerStats = (gear) => {
  let raidPiecesNeeded = 0, tomePiecesNeeded = 0;
  let polishNeeded = 0, weaveNeeded = 0, weaponUpgradeNeeded = 0;
  let totalTomesNeeded = 0;
  const pagesNeeded = { 1: 0, 2: 0, 3: 0, 4: 0 };

  GEAR_SLOTS.forEach(slot => {
    const slotGear = gear[slot];
    const isLeftSide = LEFT_SIDE_SLOTS.includes(slot);
    const isRightSide = RIGHT_SIDE_SLOTS.includes(slot);
    const isWeapon = slot === 'weapon';

    if (slotGear.bisSource === 'raid') {
      if (!slotGear.hasItem) {
        raidPiecesNeeded++;
        const bookInfo = BOOK_COSTS[slot];
        pagesNeeded[bookInfo.floor] += bookInfo.cost;
      }
    } else {
      if (!slotGear.hasItem) {
        tomePiecesNeeded++;
        totalTomesNeeded += TOME_COSTS[slot];
      }
      if (!slotGear.isAugmented) {
        if (isLeftSide) polishNeeded++;
        else if (isRightSide) weaveNeeded++;
        else if (isWeapon) weaponUpgradeNeeded = 1;
      }
    }
  });

  const weeksForTomes = totalTomesNeeded > 0 ? Math.ceil(totalTomesNeeded / TOME_CAP_PER_WEEK) : 0;

  return {
    raidPiecesNeeded, tomePiecesNeeded, polishNeeded, weaveNeeded,
    weaponUpgradeNeeded, totalTomesNeeded, weeksForTomes, pagesNeeded
  };
};

// Calculate loot priority for a specific item drop
const calculateLootPriority = (player, slot, priorityOrder, gear, lootHistory) => {
  const slotGear = gear[slot];
  const job = JOBS[player.job];
  
  // Base: Is this BiS for them?
  if (slotGear.bisSource !== 'raid' || slotGear.hasItem) return 0;
  
  let priority = 100; // Base priority for needing item
  
  // Role priority (from user-defined order)
  const rolePriority = priorityOrder.find(p => p.role === job.role);
  priority += (6 - rolePriority.priority) * 20; // Higher number = lower priority role
  
  // Slot weight (weapon most valuable)
  priority *= SLOT_WEIGHTS[slot];
  
  // Weeks to acquire via books (longer = higher priority for direct drop)
  const bookInfo = BOOK_COSTS[slot];
  priority += bookInfo.cost * 3;
  
  // Diminishing returns if player already got loot this week
  const lootThisWeek = lootHistory.filter(l => l.playerId === player.id && l.week === 1).length;
  priority -= lootThisWeek * 25;
  
  return Math.round(priority);
};

// ============================================================================
// COMPONENTS
// ============================================================================

// Job Selector Dropdown
const JobSelector = ({ value, onChange }) => {
  const jobsByRole = {
    tank: ['PLD', 'WAR', 'DRK', 'GNB'],
    healer: ['WHM', 'SCH', 'AST', 'SGE'],
    melee: ['MNK', 'DRG', 'NIN', 'SAM', 'RPR', 'VPR'],
    ranged: ['BRD', 'MCH', 'DNC'],
    caster: ['BLM', 'SMN', 'RDM', 'PCT'],
  };

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        backgroundColor: JOBS[value]?.color || '#333',
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        padding: '4px 8px',
        fontSize: '12px',
        cursor: 'pointer',
        width: '100%'
      }}
    >
      {Object.entries(jobsByRole).map(([role, jobs]) => (
        <optgroup key={role} label={role.charAt(0).toUpperCase() + role.slice(1)}>
          {jobs.map(job => (
            <option key={job} value={job}>
              {JOBS[job].icon} {JOBS[job].name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
};

// Priority Suggestion Badge
const PriorityBadge = ({ priority, rank }) => {
  if (priority === 0) return null;
  
  const colors = {
    1: { bg: '#ffd700', text: '#000' },
    2: { bg: '#c0c0c0', text: '#000' },
    3: { bg: '#cd7f32', text: '#fff' },
  };
  
  const color = colors[rank] || { bg: '#444', text: '#fff' };
  
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '20px',
      height: '20px',
      borderRadius: '50%',
      backgroundColor: color.bg,
      color: color.text,
      fontSize: '10px',
      fontWeight: 'bold',
      marginLeft: '4px'
    }}>
      {rank}
    </span>
  );
};

// Player Card Component
const PlayerCard = ({ player, gear, onGearChange, onPlayerChange, priorityOrder, lootHistory }) => {
  const job = JOBS[player.job];
  const colors = ROLE_COLORS[job.role];
  const stats = useMemo(() => calculatePlayerStats(gear), [gear]);

  return (
    <div style={{
      backgroundColor: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: '6px',
      overflow: 'hidden',
      fontSize: '11px',
      minWidth: '290px'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: colors.header,
        padding: '8px 10px',
        borderBottom: `1px solid ${colors.border}`
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '14px' }}>
            {job.icon} {player.name}
          </span>
          <span style={{ 
            color: player.etroLink ? '#6eb5ff' : '#666',
            fontSize: '10px',
            cursor: player.etroLink ? 'pointer' : 'default'
          }}>
            {player.etroLink ? '📋 BiS Link' : 'Add BiS Link'}
          </span>
        </div>
        <JobSelector 
          value={player.job} 
          onChange={(job) => onPlayerChange(player.id, { ...player, job })} 
        />
      </div>

      {/* Gear Table */}
      <div style={{ padding: '6px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: '#888', fontSize: '10px' }}>
              <th style={{ textAlign: 'left', padding: '2px 4px' }}></th>
              <th style={{ textAlign: 'center', padding: '2px', width: '50px' }}>BiS</th>
              <th style={{ textAlign: 'center', padding: '2px', width: '36px' }}>Have</th>
              <th style={{ textAlign: 'center', padding: '2px', width: '36px' }}>Aug</th>
            </tr>
          </thead>
          <tbody>
            {GEAR_SLOTS.map(slot => {
              const slotGear = gear[slot];
              const canAugment = slotGear.bisSource === 'tome';
              const priority = calculateLootPriority(player, slot, priorityOrder, gear, lootHistory);
              
              return (
                <tr key={slot} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ color: '#ccc', padding: '3px 4px', display: 'flex', alignItems: 'center' }}>
                    {SLOT_LABELS[slot]}
                    {priority > 0 && <PriorityBadge priority={priority} rank={priority > 150 ? 1 : priority > 100 ? 2 : 3} />}
                  </td>
                  <td style={{ padding: '2px' }}>
                    <select
                      value={slotGear.bisSource}
                      onChange={(e) => onGearChange(player.id, slot, { ...slotGear, bisSource: e.target.value })}
                      style={{
                        backgroundColor: slotGear.bisSource === 'raid' ? '#b44' : '#4a4',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '3px',
                        padding: '2px 4px',
                        fontSize: '10px',
                        width: '100%',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="raid">Raid</option>
                      <option value="tome">Tome</option>
                    </select>
                  </td>
                  <td style={{ textAlign: 'center', padding: '2px' }}>
                    <input
                      type="checkbox"
                      checked={slotGear.hasItem}
                      onChange={() => onGearChange(player.id, slot, { ...slotGear, hasItem: !slotGear.hasItem })}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                  </td>
                  <td style={{ textAlign: 'center', padding: '2px' }}>
                    {canAugment ? (
                      <input
                        type="checkbox"
                        checked={slotGear.isAugmented}
                        onChange={() => onGearChange(player.id, slot, { ...slotGear, isAugmented: !slotGear.isAugmented })}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        disabled={!slotGear.hasItem}
                      />
                    ) : <span style={{ color: '#444' }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Upgrade Materials */}
      <div style={{ 
        borderTop: `1px solid ${colors.border}`,
        padding: '6px',
        backgroundColor: 'rgba(0,0,0,0.2)',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '4px',
        fontSize: '10px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#888' }}>Polish</div>
          <div style={{ color: stats.polishNeeded > 0 ? '#ff8' : '#4a4', fontWeight: 'bold' }}>{stats.polishNeeded}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#888' }}>Weave</div>
          <div style={{ color: stats.weaveNeeded > 0 ? '#ff8' : '#4a4', fontWeight: 'bold' }}>{stats.weaveNeeded}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#888' }}>Weapon</div>
          <div style={{ color: stats.weaponUpgradeNeeded > 0 ? '#ff8' : '#4a4', fontWeight: 'bold' }}>{stats.weaponUpgradeNeeded}</div>
        </div>
      </div>

      {/* Summary Footer */}
      <div style={{
        borderTop: `1px solid ${colors.border}`,
        padding: '8px',
        backgroundColor: 'rgba(0,0,0,0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '11px'
      }}>
        <div>
          <span style={{ color: '#f66' }}>■</span>
          <span style={{ color: '#ccc', marginLeft: '4px' }}>Raid: {stats.raidPiecesNeeded}</span>
        </div>
        <div>
          <span style={{ color: '#6f6' }}>■</span>
          <span style={{ color: '#ccc', marginLeft: '4px' }}>Tome: {stats.tomePiecesNeeded}</span>
        </div>
        <div style={{ color: '#888' }}>
          {stats.totalTomesNeeded > 0 && `${stats.weeksForTomes}wk`}
        </div>
      </div>
    </div>
  );
};

// Priority Settings Panel
const PrioritySettings = ({ priorityOrder, onPriorityChange }) => {
  const moveUp = (index) => {
    if (index === 0) return;
    const newOrder = [...priorityOrder];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    newOrder.forEach((item, i) => item.priority = i + 1);
    onPriorityChange(newOrder);
  };

  const moveDown = (index) => {
    if (index === priorityOrder.length - 1) return;
    const newOrder = [...priorityOrder];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    newOrder.forEach((item, i) => item.priority = i + 1);
    onPriorityChange(newOrder);
  };

  return (
    <div style={{
      backgroundColor: 'rgba(0,0,0,0.4)',
      border: '1px solid #444',
      borderRadius: '6px',
      padding: '12px',
      marginBottom: '16px'
    }}>
      <h3 style={{ color: '#c9a227', margin: '0 0 12px 0', fontSize: '14px' }}>
        ⚙️ Loot Priority Order
      </h3>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {priorityOrder.map((item, index) => {
          const roleColors = ROLE_COLORS[item.role];
          return (
            <div key={item.role} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: roleColors.bg,
              border: `1px solid ${roleColors.border}`,
              borderRadius: '4px',
              padding: '4px 8px'
            }}>
              <span style={{ color: roleColors.text, fontSize: '12px', fontWeight: 'bold' }}>
                {index + 1}. {item.label}
              </span>
              <button
                onClick={() => moveUp(index)}
                disabled={index === 0}
                style={{
                  background: 'none',
                  border: 'none',
                  color: index === 0 ? '#444' : '#888',
                  cursor: index === 0 ? 'default' : 'pointer',
                  padding: '0 2px'
                }}
              >▲</button>
              <button
                onClick={() => moveDown(index)}
                disabled={index === priorityOrder.length - 1}
                style={{
                  background: 'none',
                  border: 'none',
                  color: index === priorityOrder.length - 1 ? '#444' : '#888',
                  cursor: index === priorityOrder.length - 1 ? 'default' : 'pointer',
                  padding: '0 2px'
                }}
              >▼</button>
            </div>
          );
        })}
      </div>
      <p style={{ color: '#666', fontSize: '10px', margin: '8px 0 0 0' }}>
        Drag or use arrows to reorder. Higher priority roles get loot first.
      </p>
    </div>
  );
};

// Loot Suggestion Panel
const LootSuggestions = ({ players, allGear, priorityOrder, lootHistory }) => {
  const suggestions = useMemo(() => {
    const floorItems = {
      1: ['earring', 'necklace', 'bracelet', 'ring1', 'ring2'],
      2: ['helmet', 'gloves', 'feet'],
      3: ['chest', 'legs'],
      4: ['weapon']
    };

    const results = {};
    
    Object.entries(floorItems).forEach(([floor, slots]) => {
      results[floor] = {};
      slots.forEach(slot => {
        const priorities = players
          .map(p => ({
            player: p,
            priority: calculateLootPriority(p, slot, priorityOrder, allGear[p.id], lootHistory)
          }))
          .filter(p => p.priority > 0)
          .sort((a, b) => b.priority - a.priority)
          .slice(0, 3);
        
        if (priorities.length > 0) {
          results[floor][slot] = priorities;
        }
      });
    });

    return results;
  }, [players, allGear, priorityOrder, lootHistory]);

  return (
    <div style={{
      backgroundColor: 'rgba(0,0,0,0.4)',
      border: '1px solid #444',
      borderRadius: '6px',
      padding: '12px',
      marginBottom: '16px'
    }}>
      <h3 style={{ color: '#c9a227', margin: '0 0 12px 0', fontSize: '14px' }}>
        🎯 Loot Priority Suggestions
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[1, 2, 3, 4].map(floor => (
          <div key={floor}>
            <div style={{ 
              color: '#888', 
              fontSize: '11px', 
              marginBottom: '6px',
              borderBottom: '1px solid #333',
              paddingBottom: '4px'
            }}>
              Floor {floor}
            </div>
            {Object.entries(suggestions[floor] || {}).map(([slot, priorities]) => (
              <div key={slot} style={{ marginBottom: '8px' }}>
                <div style={{ color: '#aaa', fontSize: '10px' }}>{SLOT_LABELS[slot]}:</div>
                {priorities.map((p, i) => {
                  const job = JOBS[p.player.job];
                  return (
                    <div key={p.player.id} style={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      fontSize: '10px',
                      color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : '#cd7f32'
                    }}>
                      <span style={{ marginRight: '4px' }}>{i + 1}.</span>
                      <span>{job.icon}</span>
                      <span style={{ marginLeft: '4px' }}>{p.player.name}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN APP
// ============================================================================

export default function FFXIVRaidPlanner() {
  const [players, setPlayers] = useState(initialPlayers);
  const [priorityOrder, setPriorityOrder] = useState(DEFAULT_PRIORITY_ORDER);
  const [lootHistory] = useState([]); // Would be populated from actual loot tracking
  const [currentWeek] = useState(1);
  
  const [allGear, setAllGear] = useState(() => {
    const gear = {};
    initialPlayers.forEach(p => {
      gear[p.id] = generateInitialGear();
    });
    
    // Pre-configure Lloyd's gear (5 raid, 6 tome as mentioned)
    gear[5] = {
      weapon: { bisSource: 'raid', hasItem: false, isAugmented: false },
      helmet: { bisSource: 'tome', hasItem: false, isAugmented: false },
      chest: { bisSource: 'raid', hasItem: false, isAugmented: false },
      gloves: { bisSource: 'tome', hasItem: false, isAugmented: false },
      legs: { bisSource: 'tome', hasItem: false, isAugmented: false },
      feet: { bisSource: 'raid', hasItem: false, isAugmented: false },
      earring: { bisSource: 'tome', hasItem: false, isAugmented: false },
      necklace: { bisSource: 'tome', hasItem: false, isAugmented: false },
      bracelet: { bisSource: 'raid', hasItem: false, isAugmented: false },
      ring1: { bisSource: 'raid', hasItem: false, isAugmented: false },
      ring2: { bisSource: 'tome', hasItem: false, isAugmented: false }
    };
    
    return gear;
  });

  const handleGearChange = useCallback((playerId, slot, newGear) => {
    setAllGear(prev => ({
      ...prev,
      [playerId]: { ...prev[playerId], [slot]: newGear }
    }));
  }, []);

  const handlePlayerChange = useCallback((playerId, newPlayer) => {
    setPlayers(prev => prev.map(p => p.id === playerId ? newPlayer : p));
  }, []);

  // Sort players by role priority for display
  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const aRole = JOBS[a.job].role;
      const bRole = JOBS[b.job].role;
      const aPriority = priorityOrder.find(p => p.role === aRole)?.priority || 99;
      const bPriority = priorityOrder.find(p => p.role === bRole)?.priority || 99;
      return aPriority - bPriority;
    });
  }, [players, priorityOrder]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #12121a 50%, #0a0a12 100%)',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        textAlign: 'center',
        marginBottom: '20px',
        borderBottom: '1px solid rgba(201, 162, 39, 0.3)',
        paddingBottom: '16px'
      }}>
        <h1 style={{
          color: '#c9a227',
          fontSize: '28px',
          fontWeight: 'normal',
          margin: '0 0 4px 0',
          fontFamily: 'Cinzel, serif',
          letterSpacing: '2px'
        }}>
          FFXIV RAID PLANNER
        </h1>
        <p style={{ color: '#888', fontSize: '12px', margin: 0 }}>
          AAC Cruiserweight (Savage) • Week {currentWeek} • 8 Players
        </p>
        <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <button style={{
            backgroundColor: '#2d5a8a',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            fontSize: '11px',
            cursor: 'pointer'
          }}>
            🔗 Share Link
          </button>
          <button style={{
            backgroundColor: '#444',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            fontSize: '11px',
            cursor: 'pointer'
          }}>
            📥 Import from Etro
          </button>
          <button style={{
            backgroundColor: '#444',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            fontSize: '11px',
            cursor: 'pointer'
          }}>
            🔄 Sync Lodestone
          </button>
        </div>
      </div>

      {/* Settings & Suggestions */}
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <PrioritySettings 
          priorityOrder={priorityOrder} 
          onPriorityChange={setPriorityOrder} 
        />
        
        <LootSuggestions 
          players={players}
          allGear={allGear}
          priorityOrder={priorityOrder}
          lootHistory={lootHistory}
        />
      </div>

      {/* Player Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
        gap: '12px',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {sortedPlayers.map(player => (
          <PlayerCard
            key={player.id}
            player={player}
            gear={allGear[player.id]}
            onGearChange={handleGearChange}
            onPlayerChange={handlePlayerChange}
            priorityOrder={priorityOrder}
            lootHistory={lootHistory}
          />
        ))}
      </div>

      {/* API Integration Info */}
      <div style={{
        marginTop: '24px',
        padding: '16px',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: '6px',
        maxWidth: '800px',
        margin: '24px auto 0',
        fontSize: '11px',
        color: '#666'
      }}>
        <div style={{ color: '#888', marginBottom: '8px', fontWeight: 'bold' }}>
          🔌 Available Integrations
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          <div>
            <strong style={{ color: '#6eb5ff' }}>Etro.gg / xivgear.app</strong>
            <div>Import BiS sets directly from link</div>
          </div>
          <div>
            <strong style={{ color: '#6eb5ff' }}>XIVAPI / Lodestone</strong>
            <div>Sync current equipped gear</div>
          </div>
          <div>
            <strong style={{ color: '#6eb5ff' }}>FFLogs</strong>
            <div>Verify character, show parses</div>
          </div>
          <div>
            <strong style={{ color: '#6eb5ff' }}>Discord Webhook</strong>
            <div>Loot notifications to your server</div>
          </div>
        </div>
      </div>
    </div>
  );
}
