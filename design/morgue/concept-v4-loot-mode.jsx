import React, { useState, useMemo } from 'react';

// ============================================
// GAME DATA
// ============================================

const JOBS = {
  PLD: { name: 'Paladin', role: 'tank', icon: '🛡️' },
  WAR: { name: 'Warrior', role: 'tank', icon: '🪓' },
  DRK: { name: 'Dark Knight', role: 'tank', icon: '⚔️' },
  GNB: { name: 'Gunbreaker', role: 'tank', icon: '🔫' },
  WHM: { name: 'White Mage', role: 'healer', icon: '✨' },
  SCH: { name: 'Scholar', role: 'healer', icon: '📖' },
  AST: { name: 'Astrologian', role: 'healer', icon: '🌟' },
  SGE: { name: 'Sage', role: 'healer', icon: '💎' },
  MNK: { name: 'Monk', role: 'melee', icon: '👊' },
  DRG: { name: 'Dragoon', role: 'melee', icon: '🐉' },
  NIN: { name: 'Ninja', role: 'melee', icon: '🥷' },
  SAM: { name: 'Samurai', role: 'melee', icon: '⚔️' },
  RPR: { name: 'Reaper', role: 'melee', icon: '🌙' },
  VPR: { name: 'Viper', role: 'melee', icon: '🐍' },
  BRD: { name: 'Bard', role: 'ranged', icon: '🎵' },
  MCH: { name: 'Machinist', role: 'ranged', icon: '🔧' },
  DNC: { name: 'Dancer', role: 'ranged', icon: '💃' },
  BLM: { name: 'Black Mage', role: 'caster', icon: '🔥' },
  SMN: { name: 'Summoner', role: 'caster', icon: '📕' },
  RDM: { name: 'Red Mage', role: 'caster', icon: '⚡' },
  PCT: { name: 'Pictomancer', role: 'caster', icon: '🎨' }
};

const ROLE_COLORS = {
  tank: { bg: 'rgba(30, 60, 100, 0.8)', border: '#3d7ab8', text: '#4a90c2' },
  healer: { bg: 'rgba(30, 80, 50, 0.8)', border: '#3d8b5c', text: '#4ab87a' },
  melee: { bg: 'rgba(100, 30, 30, 0.8)', border: '#b83d3d', text: '#c24a4a' },
  ranged: { bg: 'rgba(100, 60, 30, 0.8)', border: '#b87a3d', text: '#c29a4a' },
  caster: { bg: 'rgba(80, 30, 100, 0.8)', border: '#8b3db8', text: '#a24ac2' }
};

const ROLE_LABELS = {
  tank: 'Tank',
  healer: 'Healer', 
  melee: 'Melee DPS',
  ranged: 'Ranged DPS',
  caster: 'Caster'
};

const GEAR_SLOTS = ['weapon', 'head', 'body', 'hands', 'legs', 'feet', 'earring', 'necklace', 'bracelet', 'ring1', 'ring2'];

const FLOOR_DROPS = {
  1: { gear: ['earring', 'necklace', 'bracelet', 'ring'], upgrades: ['Glaze'] },
  2: { gear: ['head', 'hands', 'feet'], upgrades: ['Glaze'] },
  3: { gear: ['body', 'legs'], upgrades: ['Twine', 'Solvent'] },
  4: { gear: ['weapon'], upgrades: [] }
};

// ============================================
// INITIAL STATE - TEMPLATE STATIC
// ============================================

// This is what a NEW static looks like - 8 empty slots
const createTemplateStatic = () => ({
  players: [
    { id: 1, role: 'tank', slot: 1, name: null, job: null, configured: false },
    { id: 2, role: 'tank', slot: 2, name: null, job: null, configured: false },
    { id: 3, role: 'healer', slot: 1, name: null, job: null, configured: false },
    { id: 4, role: 'healer', slot: 2, name: null, job: null, configured: false },
    { id: 5, role: 'melee', slot: 1, name: null, job: null, configured: false },
    { id: 6, role: 'melee', slot: 2, name: null, job: null, configured: false },
    { id: 7, role: 'ranged', slot: 1, name: null, job: null, configured: false },
    { id: 8, role: 'caster', slot: 1, name: null, job: null, configured: false },
  ]
});

// Demo static with actual data
const createDemoStatic = () => ({
  players: [
    { id: 1, role: 'tank', name: 'Alexander', job: 'PLD', configured: true, gear: generateGear(), bisLink: null, lodestoneId: null },
    { id: 2, role: 'tank', name: 'Grimm', job: 'WAR', configured: true, gear: generateGear(), bisLink: null, lodestoneId: null },
    { id: 3, role: 'healer', name: 'Binckle', job: 'WHM', configured: true, gear: generateGear(), bisLink: null, lodestoneId: null },
    { id: 4, role: 'healer', name: 'Demonic', job: 'SGE', configured: true, gear: generateGear(), bisLink: 'xivgear', lodestoneId: null },
    { id: 5, role: 'melee', name: 'Lloyd', job: 'DRG', configured: true, gear: generateGear('lloyd'), bisLink: 'xivgear', lodestoneId: '26213642' },
    { id: 6, role: 'melee', name: 'Theo', job: 'VPR', configured: true, gear: generateGear('theo'), bisLink: 'xivgear', lodestoneId: null },
    { id: 7, role: 'ranged', name: 'Vel', job: 'MCH', configured: true, gear: generateGear(), bisLink: null, lodestoneId: null },
    { id: 8, role: 'caster', name: 'Ferus', job: 'BLM', configured: true, gear: generateGear(), bisLink: null, lodestoneId: null },
  ]
});

function generateGear(preset = null) {
  const gear = {};
  GEAR_SLOTS.forEach(slot => {
    gear[slot] = { bisSource: 'raid', hasItem: false, isAugmented: false };
  });
  
  if (preset === 'lloyd') {
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
  
  if (preset === 'theo') {
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
}

// ============================================
// CALCULATIONS
// ============================================

const LOOT_PRIORITY = ['melee', 'ranged', 'caster', 'tank', 'healer'];

function calculateStats(player) {
  if (!player.configured || !player.gear) {
    return { raidNeed: 0, tomeNeed: 0, augNeed: 0, completed: 0, total: 11, priority: 0 };
  }
  
  let raidNeed = 0, tomeNeed = 0, augNeed = 0, completed = 0;
  
  GEAR_SLOTS.forEach(slot => {
    const g = player.gear[slot];
    if (!g) return;
    
    if (g.bisSource === 'raid') {
      if (g.hasItem) completed++;
      else raidNeed++;
    } else {
      if (g.hasItem && g.isAugmented) completed++;
      else if (g.hasItem) augNeed++;
      else tomeNeed++;
    }
  });
  
  const rolePriority = LOOT_PRIORITY.indexOf(player.role);
  const priority = (5 - rolePriority) * 20 + (11 - completed) * 5;
  
  return { raidNeed, tomeNeed, augNeed, completed, total: 11, priority };
}

function getLootPriority(players, floor) {
  const drops = FLOOR_DROPS[floor];
  const results = {};
  
  // Gear drops
  drops.gear.forEach(slot => {
    const needers = players
      .filter(p => p.configured && p.gear)
      .map(p => {
        const slotKey = slot === 'ring' ? 'ring1' : slot;
        const g = p.gear[slotKey];
        const needs = g?.bisSource === 'raid' && !g?.hasItem;
        const stats = calculateStats(p);
        return { player: p, needs, score: stats.priority, reason: needs ? 'Needs for BiS' : null };
      })
      .filter(x => x.needs)
      .sort((a, b) => b.score - a.score);
    
    results[slot] = needers;
  });
  
  // Upgrade materials
  drops.upgrades.forEach(mat => {
    const needers = players
      .filter(p => p.configured && p.gear)
      .map(p => {
        const stats = calculateStats(p);
        let needs = false;
        let count = 0;
        
        if (mat === 'Twine') {
          // Count unaugmented tome left-side pieces
          ['head', 'body', 'hands', 'legs', 'feet'].forEach(s => {
            const g = p.gear[s];
            if (g?.bisSource === 'tome' && g?.hasItem && !g?.isAugmented) {
              needs = true;
              count++;
            }
          });
        } else if (mat === 'Glaze') {
          ['earring', 'necklace', 'bracelet', 'ring1', 'ring2'].forEach(s => {
            const g = p.gear[s];
            if (g?.bisSource === 'tome' && g?.hasItem && !g?.isAugmented) {
              needs = true;
              count++;
            }
          });
        } else if (mat === 'Solvent') {
          const g = p.gear.weapon;
          if (g?.bisSource === 'tome' && g?.hasItem && !g?.isAugmented) {
            needs = true;
            count = 1;
          }
        }
        
        return { 
          player: p, 
          needs, 
          score: stats.priority + count * 10,
          reason: needs ? `${count} piece${count > 1 ? 's' : ''} to augment` : null
        };
      })
      .filter(x => x.needs)
      .sort((a, b) => b.score - a.score);
    
    results[mat] = needers;
  });
  
  return results;
}

// ============================================
// COMPONENTS
// ============================================

// Empty Slot Card (Template)
function EmptySlotCard({ slot, onConfigure }) {
  const colors = ROLE_COLORS[slot.role];
  const roleLabel = ROLE_LABELS[slot.role];
  
  return (
    <div 
      onClick={() => onConfigure(slot.id)}
      className="cursor-pointer transition-all hover:scale-[1.02]"
      style={{
        backgroundColor: 'rgba(20, 20, 30, 0.6)',
        border: `2px dashed ${colors.border}`,
        borderRadius: '8px',
        padding: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '6px',
          backgroundColor: colors.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
          opacity: 0.5
        }}>
          {slot.role === 'tank' ? '🛡️' : slot.role === 'healer' ? '✨' : slot.role === 'melee' ? '⚔️' : slot.role === 'ranged' ? '🎯' : '🔮'}
        </div>
        <div>
          <div style={{ color: colors.text, fontWeight: 'bold', fontSize: '14px' }}>
            {roleLabel} {slot.slot || ''}
          </div>
          <div style={{ color: '#666', fontSize: '12px' }}>
            Click to set up player
          </div>
        </div>
      </div>
    </div>
  );
}

// Configured Player Card (Compact)
function PlayerCardCompact({ player, onExpand, onCopy }) {
  const job = JOBS[player.job];
  const colors = ROLE_COLORS[player.role];
  const stats = calculateStats(player);
  
  return (
    <div style={{
      backgroundColor: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      {/* Main row */}
      <div 
        onClick={onExpand}
        style={{
          padding: '12px',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '4px',
            backgroundColor: colors.border,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px'
          }}>
            {job?.icon || '?'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '15px' }}>{player.name}</span>
              <span style={{
                backgroundColor: colors.border,
                color: '#fff',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 'bold'
              }}>
                {player.job}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '2px', fontSize: '11px' }}>
              <span style={{ color: player.bisLink ? '#4a90c2' : '#555' }}>
                BiS: {player.bisLink ? '✓ XIVGear' : 'Not set'}
              </span>
              <span style={{ color: player.lodestoneId ? '#4ab87a' : '#555' }}>
                {player.lodestoneId ? '✓ Synced' : 'Not linked'}
              </span>
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            backgroundColor: stats.priority > 100 ? 'rgba(196, 68, 68, 0.3)' : stats.priority > 80 ? 'rgba(202, 162, 68, 0.3)' : 'rgba(68, 170, 68, 0.3)',
            color: stats.priority > 100 ? '#c44' : stats.priority > 80 ? '#ca4' : '#4a4',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold'
          }}>
            P{stats.priority}
          </div>
          <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '15px' }}>
            {stats.completed}/11
          </div>
          <span style={{ color: '#666', fontSize: '14px' }}>▶</span>
        </div>
      </div>
      
      {/* Stats row */}
      <div style={{
        padding: '8px 12px',
        paddingLeft: '58px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        gap: '20px',
        fontSize: '12px'
      }}>
        <span>
          <span style={{ color: '#c44' }}>■</span>{' '}
          <span style={{ color: '#aaa' }}>{stats.raidNeed} raid</span>
        </span>
        <span>
          <span style={{ color: '#4a4' }}>■</span>{' '}
          <span style={{ color: '#aaa' }}>{stats.tomeNeed} tome</span>
        </span>
        <span>
          <span style={{ color: '#ca4' }}>■</span>{' '}
          <span style={{ color: '#aaa' }}>{stats.augNeed} aug</span>
        </span>
        {/* Copy button */}
        <button
          onClick={(e) => { e.stopPropagation(); onCopy(player.id); }}
          style={{
            marginLeft: 'auto',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#555',
            cursor: 'pointer',
            fontSize: '11px',
            padding: '2px 6px',
            borderRadius: '4px'
          }}
          onMouseOver={(e) => e.target.style.color = '#888'}
          onMouseOut={(e) => e.target.style.color = '#555'}
          title="Copy player card"
        >
          ⧉ Copy
        </button>
      </div>
    </div>
  );
}

// Loot Mode - Item Card
function LootItemCard({ itemName, needers, onAssign }) {
  const isUpgrade = ['Twine', 'Glaze', 'Solvent'].includes(itemName);
  
  return (
    <div style={{
      backgroundColor: 'rgba(20, 20, 30, 0.9)',
      borderRadius: '8px',
      padding: '12px',
      border: '1px solid rgba(201, 162, 39, 0.2)'
    }}>
      <div style={{
        color: isUpgrade ? '#aaa' : '#c9a227',
        fontWeight: 'bold',
        fontSize: '13px',
        marginBottom: '10px',
        paddingBottom: '8px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <span>{isUpgrade ? '✦' : '⚔️'}</span>
        {itemName.charAt(0).toUpperCase() + itemName.slice(1)}
      </div>
      
      {needers.length === 0 ? (
        <div style={{ color: '#4a4', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>✓</span> No one needs
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {needers.slice(0, 4).map((n, i) => {
            const colors = ROLE_COLORS[n.player.role];
            return (
              <div 
                key={n.player.id}
                onClick={() => onAssign?.(itemName, n.player.id)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 8px',
                  backgroundColor: i === 0 ? 'rgba(201, 162, 39, 0.15)' : 'transparent',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  border: i === 0 ? '1px solid rgba(201, 162, 39, 0.3)' : '1px solid transparent'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: i === 0 ? '#c9a227' : '#666', fontWeight: 'bold', fontSize: '11px', width: '16px' }}>
                    {i + 1}.
                  </span>
                  <span style={{
                    backgroundColor: colors.border,
                    color: '#fff',
                    padding: '1px 5px',
                    borderRadius: '3px',
                    fontSize: '10px',
                    fontWeight: 'bold'
                  }}>
                    {n.player.job}
                  </span>
                  <span style={{ color: i === 0 ? '#fff' : '#aaa', fontSize: '12px', fontWeight: i === 0 ? 'bold' : 'normal' }}>
                    {n.player.name}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {n.reason && (
                    <span style={{ color: '#666', fontSize: '10px' }}>{n.reason}</span>
                  )}
                  <span style={{ 
                    color: '#888', 
                    fontSize: '10px',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    padding: '2px 5px',
                    borderRadius: '3px'
                  }}>
                    P{n.score}
                  </span>
                </div>
              </div>
            );
          })}
          {needers.length > 4 && (
            <div style={{ color: '#666', fontSize: '10px', textAlign: 'center', marginTop: '4px' }}>
              +{needers.length - 4} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// View Toggle Component
function ViewToggle({ view, onViewChange }) {
  return (
    <div style={{
      display: 'flex',
      backgroundColor: 'rgba(40, 40, 50, 0.8)',
      borderRadius: '6px',
      padding: '2px'
    }}>
      <button
        onClick={() => onViewChange('compact')}
        style={{
          padding: '6px 12px',
          borderRadius: '4px',
          border: 'none',
          backgroundColor: view === 'compact' ? 'rgba(201, 162, 39, 0.3)' : 'transparent',
          color: view === 'compact' ? '#c9a227' : '#666',
          cursor: 'pointer',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}
        title="Compact view"
      >
        <span style={{ fontSize: '16px' }}>▤</span>
      </button>
      <button
        onClick={() => onViewChange('expanded')}
        style={{
          padding: '6px 12px',
          borderRadius: '4px',
          border: 'none',
          backgroundColor: view === 'expanded' ? 'rgba(201, 162, 39, 0.3)' : 'transparent',
          color: view === 'expanded' ? '#c9a227' : '#666',
          cursor: 'pointer',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}
        title="Expanded view"
      >
        <span style={{ fontSize: '16px' }}>☰</span>
      </button>
    </div>
  );
}

// ============================================
// MAIN APP
// ============================================

export default function FFXIVRaidPlannerV4() {
  const [showTemplateDemo, setShowTemplateDemo] = useState(false);
  const [staticData, setStaticData] = useState(createDemoStatic());
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [viewMode, setViewMode] = useState('compact'); // 'compact' | 'expanded'
  const [isLootMode, setIsLootMode] = useState(false);
  
  const lootPriority = useMemo(() => 
    getLootPriority(staticData.players, selectedFloor),
    [staticData.players, selectedFloor]
  );
  
  const handleConfigureSlot = (slotId) => {
    // In real app, this would open inline editing or a small popover
    console.log('Configure slot:', slotId);
  };
  
  const handleCopyPlayer = (playerId) => {
    console.log('Copy player:', playerId);
    // Would create a new player with same gear pattern
  };
  
  const handleAssignLoot = (item, playerId) => {
    console.log(`Assign ${item} to player ${playerId}`);
    // Would mark item as obtained for player
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a12 0%, #12121a 50%, #0a0a0f 100%)',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: '1px solid rgba(201, 162, 39, 0.3)',
        flexWrap: 'wrap',
        gap: '12px'
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
            AAC Cruiserweight (Savage) • Week 4
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Demo Toggle */}
          <button
            onClick={() => {
              setShowTemplateDemo(!showTemplateDemo);
              setStaticData(showTemplateDemo ? createDemoStatic() : createTemplateStatic());
            }}
            style={{
              backgroundColor: 'rgba(100, 100, 100, 0.2)',
              border: '1px solid #555',
              color: '#888',
              padding: '8px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '11px'
            }}
          >
            {showTemplateDemo ? 'Show Filled' : 'Show Template'}
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
            🔗 Share
          </button>
        </div>
      </div>

      {/* Mode Toggle + Floor Selector */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Left: Loot Mode Toggle */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setIsLootMode(false)}
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              border: !isLootMode ? '1px solid #c9a227' : '1px solid #444',
              backgroundColor: !isLootMode ? 'rgba(201, 162, 39, 0.2)' : 'rgba(40, 40, 50, 0.8)',
              color: !isLootMode ? '#c9a227' : '#888',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: !isLootMode ? 'bold' : 'normal'
            }}
          >
            👥 Players
          </button>
          <button
            onClick={() => setIsLootMode(true)}
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              border: isLootMode ? '1px solid #c9a227' : '1px solid #444',
              backgroundColor: isLootMode ? 'rgba(201, 162, 39, 0.2)' : 'rgba(40, 40, 50, 0.8)',
              color: isLootMode ? '#c9a227' : '#888',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: isLootMode ? 'bold' : 'normal'
            }}
          >
            🎯 Loot Mode
          </button>
        </div>
        
        {/* Center: Floor Selector */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[1, 2, 3, 4].map(floor => (
            <button
              key={floor}
              onClick={() => setSelectedFloor(floor)}
              style={{
                backgroundColor: selectedFloor === floor ? 'rgba(201, 162, 39, 0.3)' : 'rgba(40, 40, 50, 0.8)',
                border: selectedFloor === floor ? '1px solid #c9a227' : '1px solid #444',
                color: selectedFloor === floor ? '#c9a227' : '#888',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: selectedFloor === floor ? 'bold' : 'normal'
              }}
            >
              M{floor}S
            </button>
          ))}
        </div>
        
        {/* Right: View Toggle (only in Players mode) */}
        {!isLootMode && (
          <ViewToggle view={viewMode} onViewChange={setViewMode} />
        )}
      </div>

      {/* Main Content */}
      {isLootMode ? (
        /* LOOT MODE VIEW */
        <div>
          <div style={{
            backgroundColor: 'rgba(201, 162, 39, 0.1)',
            border: '1px solid rgba(201, 162, 39, 0.3)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '16px' }}>🎯</span>
            <span style={{ color: '#c9a227', fontWeight: 'bold' }}>Loot Mode Active</span>
            <span style={{ color: '#888', fontSize: '12px' }}>— Click a player to assign loot</span>
          </div>
          
          {/* Loot Grid - Responsive */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '12px'
          }}>
            {/* Gear Drops */}
            {FLOOR_DROPS[selectedFloor].gear.map(item => (
              <LootItemCard 
                key={item}
                itemName={item}
                needers={lootPriority[item] || []}
                onAssign={handleAssignLoot}
              />
            ))}
            
            {/* Upgrade Materials */}
            {FLOOR_DROPS[selectedFloor].upgrades.map(item => (
              <LootItemCard 
                key={item}
                itemName={item}
                needers={lootPriority[item] || []}
                onAssign={handleAssignLoot}
              />
            ))}
          </div>
          
          {/* Quick Reference - who's in raid */}
          <div style={{
            marginTop: '20px',
            padding: '12px',
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderRadius: '6px'
          }}>
            <div style={{ color: '#888', fontSize: '11px', marginBottom: '8px' }}>Quick Reference - Priority Order</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {staticData.players
                .filter(p => p.configured)
                .sort((a, b) => calculateStats(b).priority - calculateStats(a).priority)
                .map(p => {
                  const colors = ROLE_COLORS[p.role];
                  const stats = calculateStats(p);
                  return (
                    <div key={p.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 8px',
                      backgroundColor: colors.bg,
                      borderRadius: '4px',
                      fontSize: '11px'
                    }}>
                      <span style={{ color: '#fff', fontWeight: 'bold' }}>{p.name}</span>
                      <span style={{ color: colors.text }}>P{stats.priority}</span>
                    </div>
                  );
                })
              }
            </div>
          </div>
        </div>
      ) : (
        /* PLAYERS VIEW */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '12px'
        }}>
          {staticData.players.map(player => (
            player.configured ? (
              <PlayerCardCompact 
                key={player.id}
                player={player}
                onExpand={() => console.log('Expand:', player.id)}
                onCopy={handleCopyPlayer}
              />
            ) : (
              <EmptySlotCard 
                key={player.id}
                slot={player}
                onConfigure={handleConfigureSlot}
              />
            )
          ))}
        </div>
      )}

      {/* Legend */}
      <div style={{
        marginTop: '20px',
        padding: '12px',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: '6px',
        fontSize: '10px',
        color: '#888'
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <span><span style={{ color: '#4a90c2' }}>■</span> Tank</span>
          <span><span style={{ color: '#4ab87a' }}>■</span> Healer</span>
          <span><span style={{ color: '#c24a4a' }}>■</span> Melee (P1)</span>
          <span><span style={{ color: '#c29a4a' }}>■</span> Ranged (P2)</span>
          <span><span style={{ color: '#a24ac2' }}>■</span> Caster (P3)</span>
        </div>
        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          Toggle "Show Template" to see new static creation flow with empty slots
        </div>
      </div>
    </div>
  );
}
