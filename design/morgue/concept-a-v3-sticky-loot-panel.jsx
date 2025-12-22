import React, { useState, useMemo } from 'react';

// Job data with icons and roles
const JOBS = {
  // Tanks
  PLD: { name: 'Paladin', role: 'tank', icon: '🛡️' },
  WAR: { name: 'Warrior', role: 'tank', icon: '🪓' },
  DRK: { name: 'Dark Knight', role: 'tank', icon: '⚔️' },
  GNB: { name: 'Gunbreaker', role: 'tank', icon: '🔫' },
  // Healers
  WHM: { name: 'White Mage', role: 'healer', icon: '✨' },
  SCH: { name: 'Scholar', role: 'healer', icon: '📖' },
  AST: { name: 'Astrologian', role: 'healer', icon: '🌟' },
  SGE: { name: 'Sage', role: 'healer', icon: '💎' },
  // Melee DPS
  MNK: { name: 'Monk', role: 'melee', icon: '👊' },
  DRG: { name: 'Dragoon', role: 'melee', icon: '🐉' },
  NIN: { name: 'Ninja', role: 'melee', icon: '🥷' },
  SAM: { name: 'Samurai', role: 'melee', icon: '⚔️' },
  RPR: { name: 'Reaper', role: 'melee', icon: '🌙' },
  VPR: { name: 'Viper', role: 'melee', icon: '🐍' },
  // Ranged DPS
  BRD: { name: 'Bard', role: 'ranged', icon: '🎵' },
  MCH: { name: 'Machinist', role: 'ranged', icon: '🔧' },
  DNC: { name: 'Dancer', role: 'ranged', icon: '💃' },
  // Casters
  BLM: { name: 'Black Mage', role: 'caster', icon: '🔥' },
  SMN: { name: 'Summoner', role: 'caster', icon: '📕' },
  RDM: { name: 'Red Mage', role: 'caster', icon: '⚡' },
  PCT: { name: 'Pictomancer', role: 'caster', icon: '🎨' }
};

const ROLE_COLORS = {
  tank: { bg: 'rgba(30, 60, 100, 0.8)', border: '#3d7ab8', header: '#1a3a5c', badge: '#4a90c2' },
  healer: { bg: 'rgba(30, 80, 50, 0.8)', border: '#3d8b5c', header: '#1a4a2c', badge: '#4ab87a' },
  melee: { bg: 'rgba(100, 30, 30, 0.8)', border: '#b83d3d', header: '#5c1a1a', badge: '#c24a4a' },
  ranged: { bg: 'rgba(100, 60, 30, 0.8)', border: '#b87a3d', header: '#5c3a1a', badge: '#c29a4a' },
  caster: { bg: 'rgba(80, 30, 100, 0.8)', border: '#8b3db8', header: '#4a1a5c', badge: '#a24ac2' }
};

const ROLE_PRIORITY_DEFAULT = ['melee', 'ranged', 'caster', 'tank', 'healer'];
const DISPLAY_ORDER = ['tank', 'healer', 'melee', 'ranged', 'caster'];

const GEAR_SLOTS = ['weapon', 'head', 'body', 'hands', 'legs', 'feet', 'earring', 'necklace', 'bracelet', 'ring1', 'ring2'];
const SLOT_LABELS = {
  weapon: 'Weapon', head: 'Head', body: 'Body', hands: 'Hands',
  legs: 'Legs', feet: 'Feet', earring: 'Earring', necklace: 'Necklace',
  bracelet: 'Bracelet', ring1: 'Ring', ring2: 'Ring'
};

const TOME_COSTS = {
  weapon: 500, head: 495, body: 825, hands: 495, legs: 825, feet: 495,
  earring: 375, necklace: 375, bracelet: 375, ring1: 375, ring2: 375
};

const BOOK_COSTS = {
  weapon: { floor: 4, cost: 8 },
  head: { floor: 2, cost: 4 }, body: { floor: 3, cost: 6 }, hands: { floor: 2, cost: 4 },
  legs: { floor: 3, cost: 6 }, feet: { floor: 2, cost: 4 },
  earring: { floor: 1, cost: 3 }, necklace: { floor: 1, cost: 3 },
  bracelet: { floor: 1, cost: 3 }, ring1: { floor: 1, cost: 3 }, ring2: { floor: 1, cost: 3 }
};

const FLOOR_DROPS = {
  1: ['earring', 'necklace', 'bracelet', 'ring1', 'Glaze'],
  2: ['head', 'hands', 'feet', 'Glaze'],
  3: ['body', 'legs', 'Twine', 'Solvent'],
  4: ['weapon']
};

// Sample players matching your static
const initialPlayers = [
  { id: 1, name: 'Alexander', job: 'PLD', lodestoneId: null, bisLink: null, lastSync: null },
  { id: 2, name: 'Grimm', job: 'WAR', lodestoneId: null, bisLink: null, lastSync: null },
  { id: 3, name: 'Binckle', job: 'WHM', lodestoneId: null, bisLink: null, lastSync: null },
  { id: 4, name: 'Demonic', job: 'SGE', lodestoneId: null, bisLink: 'https://xivgear.app/?page=sl|73551c', lastSync: null },
  { id: 5, name: 'Lloyd', job: 'DRG', lodestoneId: '26213642', bisLink: 'https://xivgear.app/?page=bis|drg|cur', lastSync: '2024-12-20T20:30:00' },
  { id: 6, name: 'Theo', job: 'VPR', lodestoneId: null, bisLink: 'https://xivgear.app/?page=bis|vpr|cur', lastSync: null },
  { id: 7, name: 'Ferus', job: 'BLM', lodestoneId: null, bisLink: null, lastSync: null },
  { id: 8, name: 'Vel', job: 'MCH', lodestoneId: null, bisLink: null, lastSync: null }
];

// Generate initial gear with some pre-filled based on player
const generateInitialGear = (playerId) => {
  const gear = {};
  GEAR_SLOTS.forEach(slot => {
    gear[slot] = { bisSource: 'raid', hasItem: false, isAugmented: false };
  });
  
  // Lloyd (DRG) - Mix of raid and tome, some obtained
  if (playerId === 5) {
    return {
      weapon: { bisSource: 'raid', hasItem: false, isAugmented: false },
      head: { bisSource: 'tome', hasItem: true, isAugmented: false },
      body: { bisSource: 'raid', hasItem: true, isAugmented: false },
      hands: { bisSource: 'tome', hasItem: false, isAugmented: false },
      legs: { bisSource: 'tome', hasItem: true, isAugmented: true },
      feet: { bisSource: 'raid', hasItem: false, isAugmented: false },
      earring: { bisSource: 'tome', hasItem: true, isAugmented: false },
      necklace: { bisSource: 'raid', hasItem: false, isAugmented: false },
      bracelet: { bisSource: 'raid', hasItem: true, isAugmented: false },
      ring1: { bisSource: 'raid', hasItem: false, isAugmented: false },
      ring2: { bisSource: 'tome', hasItem: true, isAugmented: false }
    };
  }
  
  // Theo (VPR) - Priority player, good progress
  if (playerId === 6) {
    return {
      weapon: { bisSource: 'raid', hasItem: true, isAugmented: false },
      head: { bisSource: 'raid', hasItem: true, isAugmented: false },
      body: { bisSource: 'tome', hasItem: true, isAugmented: true },
      hands: { bisSource: 'raid', hasItem: false, isAugmented: false },
      legs: { bisSource: 'raid', hasItem: true, isAugmented: false },
      feet: { bisSource: 'tome', hasItem: true, isAugmented: false },
      earring: { bisSource: 'raid', hasItem: true, isAugmented: false },
      necklace: { bisSource: 'tome', hasItem: true, isAugmented: true },
      bracelet: { bisSource: 'raid', hasItem: false, isAugmented: false },
      ring1: { bisSource: 'tome', hasItem: true, isAugmented: false },
      ring2: { bisSource: 'raid', hasItem: true, isAugmented: false }
    };
  }
  
  return gear;
};

// Calculate derived stats for a player
const calculateStats = (gear, role) => {
  let raidNeeded = 0, tomeNeeded = 0, polishNeeded = 0, weaveNeeded = 0, weaponUpgrade = 0;
  let totalTomes = 0;
  const pages = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let obtained = 0, total = 11;
  
  GEAR_SLOTS.forEach(slot => {
    const g = gear[slot];
    const isLeftSide = ['head', 'body', 'hands', 'legs', 'feet'].includes(slot);
    const isRightSide = ['earring', 'necklace', 'bracelet', 'ring1', 'ring2'].includes(slot);
    
    if (g.hasItem) obtained++;
    
    if (g.bisSource === 'raid' && !g.hasItem) {
      raidNeeded++;
      pages[BOOK_COSTS[slot].floor] += BOOK_COSTS[slot].cost;
    }
    
    if (g.bisSource === 'tome') {
      if (!g.hasItem) {
        tomeNeeded++;
        totalTomes += TOME_COSTS[slot];
      }
      if (!g.isAugmented) {
        if (isLeftSide) polishNeeded++;
        else if (isRightSide) weaveNeeded++;
        else if (slot === 'weapon') weaponUpgrade = 1;
      }
    }
  });
  
  const weeksForTomes = totalTomes > 0 ? Math.ceil(totalTomes / 450) : 0;
  const progressPercent = Math.round((obtained / total) * 100);
  
  // Calculate priority score (higher = higher priority for loot)
  const rolePriority = ROLE_PRIORITY_DEFAULT.indexOf(role);
  const priorityScore = (5 - rolePriority) * 20 + (total - obtained) * 5;
  
  return { raidNeeded, tomeNeeded, polishNeeded, weaveNeeded, weaponUpgrade, totalTomes, weeksForTomes, pages, obtained, total, progressPercent, priorityScore };
};

// Player Card Component
const PlayerCard = ({ player, gear, onJobChange, onGearChange, onSyncClick, isExpanded, onToggleExpand }) => {
  const jobData = JOBS[player.job];
  const colors = ROLE_COLORS[jobData.role];
  const stats = useMemo(() => calculateStats(gear, jobData.role), [gear, jobData.role]);
  
  const handleSourceChange = (slot, newSource) => {
    onGearChange(player.id, slot, { ...gear[slot], bisSource: newSource });
  };

  const handleHasItemChange = (slot) => {
    onGearChange(player.id, slot, { ...gear[slot], hasItem: !gear[slot].hasItem });
  };

  const handleAugmentedChange = (slot) => {
    onGearChange(player.id, slot, { ...gear[slot], isAugmented: !gear[slot].isAugmented });
  };

  return (
    <div style={{
      backgroundColor: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: '8px',
      overflow: 'hidden',
      fontSize: '11px',
      backdropFilter: 'blur(10px)'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: colors.header,
        padding: '8px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        cursor: 'pointer'
      }} onClick={onToggleExpand}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>{jobData.icon}</span>
          <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '14px' }}>{player.name}</span>
          <select
            value={player.job}
            onChange={(e) => { e.stopPropagation(); onJobChange(player.id, e.target.value); }}
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.badge,
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '2px 4px',
              fontSize: '10px',
              cursor: 'pointer'
            }}
          >
            {Object.entries(JOBS).map(([key, job]) => (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>
          <span style={{
            backgroundColor: 'rgba(201, 162, 39, 0.3)',
            color: '#c9a227',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 'bold'
          }}>
            P{stats.priorityScore}
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Progress bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '60px',
              height: '6px',
              backgroundColor: 'rgba(0,0,0,0.3)',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${stats.progressPercent}%`,
                height: '100%',
                backgroundColor: stats.progressPercent === 100 ? '#4a4' : '#c9a227',
                transition: 'width 0.3s'
              }} />
            </div>
            <span style={{ color: '#888', fontSize: '10px' }}>{stats.progressPercent}%</span>
          </div>
          
          {/* Sync status */}
          {player.lodestoneId ? (
            <span 
              style={{ color: '#4a4', fontSize: '10px', cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); onSyncClick(player.id); }}
              title={`Last synced: ${player.lastSync ? new Date(player.lastSync).toLocaleString() : 'Never'}`}
            >
              ✓ Synced
            </span>
          ) : (
            <span 
              style={{ color: '#888', fontSize: '10px', cursor: 'pointer' }}
              onClick={(e) => e.stopPropagation()}
            >
              ⟳ Link
            </span>
          )}
          
          <span style={{ color: '#888', fontSize: '14px' }}>{isExpanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div style={{ padding: '8px' }}>
          {/* Quick Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            marginBottom: '8px'
          }}>
            <div style={{ textAlign: 'center', padding: '4px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
              <div style={{ color: '#c44', fontSize: '14px', fontWeight: 'bold' }}>{stats.raidNeeded}</div>
              <div style={{ color: '#888', fontSize: '9px' }}>Raid Need</div>
            </div>
            <div style={{ textAlign: 'center', padding: '4px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
              <div style={{ color: '#4a4', fontSize: '14px', fontWeight: 'bold' }}>{stats.tomeNeeded}</div>
              <div style={{ color: '#888', fontSize: '9px' }}>Tome Need</div>
            </div>
            <div style={{ textAlign: 'center', padding: '4px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
              <div style={{ color: '#aaa', fontSize: '14px', fontWeight: 'bold' }}>{stats.polishNeeded + stats.weaveNeeded}</div>
              <div style={{ color: '#888', fontSize: '9px' }}>Upgrades</div>
            </div>
            <div style={{ textAlign: 'center', padding: '4px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
              <div style={{ color: '#aaa', fontSize: '14px', fontWeight: 'bold' }}>{stats.weeksForTomes}w</div>
              <div style={{ color: '#888', fontSize: '9px' }}>Tome Weeks</div>
            </div>
          </div>

          {/* Gear Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: '#888', fontSize: '9px' }}>
                <th style={{ textAlign: 'left', padding: '2px 4px' }}>Slot</th>
                <th style={{ textAlign: 'center', padding: '2px 4px' }}>BiS</th>
                <th style={{ textAlign: 'center', padding: '2px 4px' }}>Have</th>
                <th style={{ textAlign: 'center', padding: '2px 4px' }}>Aug</th>
              </tr>
            </thead>
            <tbody>
              {GEAR_SLOTS.map(slot => (
                <tr key={slot} style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <td style={{ padding: '3px 4px', color: '#ccc' }}>{SLOT_LABELS[slot]}</td>
                  <td style={{ textAlign: 'center', padding: '3px 4px' }}>
                    <select
                      value={gear[slot].bisSource}
                      onChange={(e) => handleSourceChange(slot, e.target.value)}
                      style={{
                        backgroundColor: gear[slot].bisSource === 'raid' ? 'rgba(196, 68, 68, 0.3)' : 'rgba(68, 170, 68, 0.3)',
                        color: gear[slot].bisSource === 'raid' ? '#c44' : '#4a4',
                        border: 'none',
                        borderRadius: '3px',
                        padding: '2px 4px',
                        fontSize: '10px',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="raid">Raid</option>
                      <option value="tome">Tome</option>
                    </select>
                  </td>
                  <td style={{ textAlign: 'center', padding: '3px 4px' }}>
                    <input
                      type="checkbox"
                      checked={gear[slot].hasItem}
                      onChange={() => handleHasItemChange(slot)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ textAlign: 'center', padding: '3px 4px' }}>
                    <input
                      type="checkbox"
                      checked={gear[slot].isAugmented}
                      onChange={() => handleAugmentedChange(slot)}
                      disabled={gear[slot].bisSource === 'raid'}
                      style={{ cursor: gear[slot].bisSource === 'raid' ? 'not-allowed' : 'pointer', opacity: gear[slot].bisSource === 'raid' ? 0.3 : 1 }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* BiS Link */}
          {player.bisLink && (
            <div style={{ marginTop: '8px', textAlign: 'center' }}>
              <a 
                href={player.bisLink} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: '#4a90c2', fontSize: '10px', textDecoration: 'none' }}
              >
                📊 View BiS on {player.bisLink.includes('etro') ? 'Etro' : 'XIVGear'}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Sticky Loot Priority Panel Component
const StickyLootPriorityPanel = ({ players, allGear, floor, isMinimized, onToggleMinimize }) => {
  const floorDrops = FLOOR_DROPS[floor];
  
  const getPriorityForItem = (item) => {
    const isUpgradeMaterial = ['Twine', 'Glaze', 'Solvent'].includes(item);
    
    return players.map(player => {
      const gear = allGear[player.id];
      const jobData = JOBS[player.job];
      const stats = calculateStats(gear, jobData.role);
      
      let needs = false;
      let score = 0;
      
      if (isUpgradeMaterial) {
        if (item === 'Twine') needs = stats.polishNeeded > 0;
        else if (item === 'Glaze') needs = stats.weaveNeeded > 0;
        else if (item === 'Solvent') needs = stats.weaponUpgrade > 0;
        score = needs ? stats.priorityScore : 0;
      } else {
        const slot = item.includes('ring') ? item : item;
        if (gear[slot]) {
          needs = gear[slot].bisSource === 'raid' && !gear[slot].hasItem;
          score = needs ? stats.priorityScore + BOOK_COSTS[slot].cost * 2 : 0;
        }
      }
      
      return { player, needs, score };
    })
    .filter(p => p.needs)
    .sort((a, b) => b.score - a.score);
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(10, 10, 18, 0.98)',
      borderTop: '2px solid #c9a227',
      boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.5)',
      zIndex: 1000,
      transition: 'transform 0.3s ease',
      transform: isMinimized ? 'translateY(calc(100% - 44px))' : 'translateY(0)'
    }}>
      {/* Header - Always visible */}
      <div 
        onClick={onToggleMinimize}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 20px',
          cursor: 'pointer',
          borderBottom: isMinimized ? 'none' : '1px solid rgba(201, 162, 39, 0.3)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: '#c9a227', fontSize: '14px', fontWeight: 'bold' }}>
            🎯 M{floor}S Loot Priority
          </span>
          <span style={{ 
            color: '#888', 
            fontSize: '11px',
            padding: '2px 8px',
            backgroundColor: 'rgba(201, 162, 39, 0.2)',
            borderRadius: '4px'
          }}>
            {floorDrops.length} items
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#888', fontSize: '11px' }}>
            {isMinimized ? 'Click to expand' : 'Click to minimize'}
          </span>
          <span style={{ 
            color: '#c9a227', 
            fontSize: '18px',
            transition: 'transform 0.3s',
            transform: isMinimized ? 'rotate(180deg)' : 'rotate(0deg)'
          }}>
            ▲
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{
        padding: '12px 20px 16px 20px',
        maxHeight: '200px',
        overflowY: 'auto'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${floorDrops.length}, 1fr)`,
          gap: '12px'
        }}>
          {floorDrops.map(item => {
            const priorities = getPriorityForItem(item);
            const isUpgrade = ['Twine', 'Glaze', 'Solvent'].includes(item);
            
            return (
              <div key={item} style={{
                backgroundColor: 'rgba(30, 30, 40, 0.8)',
                borderRadius: '6px',
                padding: '10px',
                border: '1px solid rgba(201, 162, 39, 0.2)'
              }}>
                <div style={{
                  color: isUpgrade ? '#aaa' : '#c9a227',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span>{isUpgrade ? '✦' : '⚔️'}</span>
                  {SLOT_LABELS[item] || item}
                </div>
                {priorities.length === 0 ? (
                  <div style={{ 
                    color: '#4a4', 
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span>✓</span> No one needs
                  </div>
                ) : (
                  priorities.slice(0, 3).map((p, i) => {
                    const jobData = JOBS[p.player.job];
                    const colors = ROLE_COLORS[jobData.role];
                    return (
                      <div key={p.player.id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '4px 6px',
                        backgroundColor: i === 0 ? 'rgba(201, 162, 39, 0.15)' : 'transparent',
                        borderRadius: '4px',
                        marginTop: '4px',
                        border: i === 0 ? '1px solid rgba(201, 162, 39, 0.3)' : '1px solid transparent'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ 
                            color: i === 0 ? '#c9a227' : '#666',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            width: '14px'
                          }}>
                            {i + 1}.
                          </span>
                          <span style={{
                            backgroundColor: colors.badge,
                            color: '#fff',
                            padding: '1px 4px',
                            borderRadius: '3px',
                            fontSize: '9px'
                          }}>
                            {p.player.job}
                          </span>
                          <span style={{ 
                            color: i === 0 ? '#fff' : '#aaa',
                            fontSize: '11px',
                            fontWeight: i === 0 ? 'bold' : 'normal'
                          }}>
                            {p.player.name}
                          </span>
                        </div>
                        <span style={{ 
                          color: '#888', 
                          fontSize: '9px',
                          backgroundColor: 'rgba(0,0,0,0.3)',
                          padding: '2px 4px',
                          borderRadius: '3px'
                        }}>
                          {p.score}
                        </span>
                      </div>
                    );
                  })
                )}
                {priorities.length > 3 && (
                  <div style={{ 
                    color: '#666', 
                    fontSize: '9px', 
                    marginTop: '4px',
                    textAlign: 'center'
                  }}>
                    +{priorities.length - 3} more
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Main App
export default function FFXIVRaidPlannerSticky() {
  const [players, setPlayers] = useState(initialPlayers);
  const [expandedPlayers, setExpandedPlayers] = useState(new Set([5, 6]));
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);
  const [allGear, setAllGear] = useState(() => {
    const gear = {};
    initialPlayers.forEach(p => { gear[p.id] = generateInitialGear(p.id); });
    return gear;
  });

  const handleJobChange = (playerId, newJob) => {
    setPlayers(prev => prev.map(p => 
      p.id === playerId ? { ...p, job: newJob } : p
    ));
  };

  const handleGearChange = (playerId, slot, newGear) => {
    setAllGear(prev => ({
      ...prev,
      [playerId]: { ...prev[playerId], [slot]: newGear }
    }));
  };

  const handleSyncClick = (playerId) => {
    setPlayers(prev => prev.map(p =>
      p.id === playerId ? { ...p, lastSync: new Date().toISOString() } : p
    ));
  };

  const toggleExpand = (playerId) => {
    setExpandedPlayers(prev => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  };

  // Sort by display order (Tank > Healer > DPS)
  const sortedPlayers = [...players].sort((a, b) => {
    const roleA = JOBS[a.job].role;
    const roleB = JOBS[b.job].role;
    return DISPLAY_ORDER.indexOf(roleA) - DISPLAY_ORDER.indexOf(roleB);
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a12 0%, #12121a 50%, #0a0a0f 100%)',
      padding: '20px',
      paddingBottom: isPanelMinimized ? '60px' : '260px', // Space for sticky panel
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        borderBottom: '1px solid rgba(201, 162, 39, 0.3)',
        paddingBottom: '16px'
      }}>
        <div>
          <h1 style={{
            color: '#c9a227',
            fontSize: '24px',
            fontWeight: 'normal',
            margin: 0,
            fontFamily: 'Cinzel, serif',
            letterSpacing: '2px'
          }}>
            SAVAGE RAID PLANNER
          </h1>
          <p style={{ color: '#888', fontSize: '11px', margin: '4px 0 0 0' }}>
            AAC Cruiserweight (Savage) • Week 4 • Auto-sync enabled
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={{
            backgroundColor: 'rgba(74, 144, 226, 0.2)',
            border: '1px solid #4a90c2',
            color: '#4a90c2',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px'
          }}>
            ⟳ Sync All
          </button>
          <button style={{
            backgroundColor: 'rgba(201, 162, 39, 0.2)',
            border: '1px solid #c9a227',
            color: '#c9a227',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px'
          }}>
            🔗 Share Link
          </button>
        </div>
      </div>

      {/* Floor Selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[1, 2, 3, 4].map(floor => (
          <button
            key={floor}
            onClick={() => setSelectedFloor(floor)}
            style={{
              backgroundColor: selectedFloor === floor ? 'rgba(201, 162, 39, 0.3)' : 'rgba(40, 40, 50, 0.8)',
              border: selectedFloor === floor ? '1px solid #c9a227' : '1px solid #444',
              color: selectedFloor === floor ? '#c9a227' : '#888',
              padding: '8px 20px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: selectedFloor === floor ? 'bold' : 'normal'
            }}
          >
            M{floor}S
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => {
            const allIds = players.map(p => p.id);
            const allExpanded = allIds.every(id => expandedPlayers.has(id));
            setExpandedPlayers(allExpanded ? new Set() : new Set(allIds));
          }}
          style={{
            backgroundColor: 'rgba(40, 40, 50, 0.8)',
            border: '1px solid #444',
            color: '#888',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          {expandedPlayers.size === players.length ? '▼ Collapse All' : '▶ Expand All'}
        </button>
      </div>

      {/* Player Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '12px',
        marginBottom: '16px'
      }}>
        {sortedPlayers.map(player => (
          <PlayerCard
            key={player.id}
            player={player}
            gear={allGear[player.id]}
            onJobChange={handleJobChange}
            onGearChange={handleGearChange}
            onSyncClick={handleSyncClick}
            isExpanded={expandedPlayers.has(player.id)}
            onToggleExpand={() => toggleExpand(player.id)}
          />
        ))}
      </div>

      {/* Legend */}
      <div style={{
        padding: '12px',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: '6px',
        fontSize: '10px',
        color: '#888'
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', flexWrap: 'wrap' }}>
          <span><span style={{ color: '#4a90c2' }}>■</span> Tank</span>
          <span><span style={{ color: '#4ab87a' }}>■</span> Healer</span>
          <span><span style={{ color: '#c24a4a' }}>■</span> Melee DPS (Priority 1)</span>
          <span><span style={{ color: '#c29a4a' }}>■</span> Ranged DPS (Priority 2)</span>
          <span><span style={{ color: '#a24ac2' }}>■</span> Caster (Priority 3)</span>
        </div>
        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          P score = Priority score (higher = gets loot first) • Click player header to expand/collapse • Display: Tank → Healer → DPS
        </div>
      </div>

      {/* Sticky Loot Priority Panel */}
      <StickyLootPriorityPanel 
        players={players} 
        allGear={allGear} 
        floor={selectedFloor}
        isMinimized={isPanelMinimized}
        onToggleMinimize={() => setIsPanelMinimized(!isPanelMinimized)}
      />
    </div>
  );
}
