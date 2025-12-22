import React, { useState, useMemo, useRef, useEffect } from 'react';

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
  tank: { bg: 'rgba(30, 60, 100, 0.8)', border: '#3d7ab8', text: '#4a90c2', headerBg: '#1a3a5c' },
  healer: { bg: 'rgba(30, 80, 50, 0.8)', border: '#3d8b5c', text: '#4ab87a', headerBg: '#1a4a2c' },
  melee: { bg: 'rgba(100, 30, 30, 0.8)', border: '#b83d3d', text: '#c24a4a', headerBg: '#5c1a1a' },
  ranged: { bg: 'rgba(100, 60, 30, 0.8)', border: '#b87a3d', text: '#c29a4a', headerBg: '#5c3a1a' },
  caster: { bg: 'rgba(80, 30, 100, 0.8)', border: '#8b3db8', text: '#a24ac2', headerBg: '#4a1a5c' }
};

const ROLE_LABELS = { tank: 'Tank', healer: 'Healer', melee: 'Melee DPS', ranged: 'Ranged DPS', caster: 'Caster' };
const ROLE_ORDER = ['tank', 'healer', 'melee', 'ranged', 'caster'];

const GEAR_SLOTS = ['weapon', 'head', 'body', 'hands', 'legs', 'feet', 'earring', 'necklace', 'bracelet', 'ring1', 'ring2'];
const SLOT_LABELS = {
  weapon: 'Weapon', head: 'Head', body: 'Body', hands: 'Hands', legs: 'Legs', 
  feet: 'Feet', earring: 'Earring', necklace: 'Necklace', bracelet: 'Bracelet', 
  ring1: 'Ring 1', ring2: 'Ring 2'
};

// Book costs per floor (from gearing math doc)
const BOOK_COSTS = {
  weapon: { floor: 4, cost: 8, weeks: 8 },
  head: { floor: 2, cost: 6, weeks: 3 },
  body: { floor: 3, cost: 8, weeks: 4 },
  hands: { floor: 2, cost: 6, weeks: 3 },
  legs: { floor: 3, cost: 8, weeks: 4 },
  feet: { floor: 2, cost: 6, weeks: 3 },
  earring: { floor: 1, cost: 4, weeks: 2 },
  necklace: { floor: 1, cost: 4, weeks: 2 },
  bracelet: { floor: 1, cost: 4, weeks: 2 },
  ring1: { floor: 1, cost: 4, weeks: 2 },
  ring2: { floor: 1, cost: 4, weeks: 2 }
};

const BOOKS_PER_FLOOR = { 1: 2, 2: 2, 3: 2, 4: 1 };

const FLOOR_DROPS = {
  1: { gear: ['earring', 'necklace', 'bracelet', 'ring'], upgrades: [] },
  2: { gear: ['head', 'hands', 'feet'], upgrades: ['glaze'] },
  3: { gear: ['body', 'legs'], upgrades: ['twine', 'solvent'] },
  4: { gear: ['weapon'], upgrades: [] }
};

// ============================================
// INITIAL STATE
// ============================================

const createTemplateStatic = () => ({
  name: 'New Static',
  tier: 'AAC Cruiserweight (Savage)',
  week: 1,
  players: [
    { id: 1, role: 'tank', slot: 1, configured: false },
    { id: 2, role: 'tank', slot: 2, configured: false },
    { id: 3, role: 'healer', slot: 1, configured: false },
    { id: 4, role: 'healer', slot: 2, configured: false },
    { id: 5, role: 'melee', slot: 1, configured: false },
    { id: 6, role: 'melee', slot: 2, configured: false },
    { id: 7, role: 'ranged', slot: 1, configured: false },
    { id: 8, role: 'caster', slot: 1, configured: false },
  ]
});

const createDemoStatic = () => ({
  name: 'Demo Static',
  tier: 'AAC Cruiserweight (Savage)',
  week: 4,
  players: [
    { id: 1, role: 'tank', name: 'Alexander', job: 'PLD', configured: true, gear: generateGear(), books: { 1: 8, 2: 8, 3: 8, 4: 4 } },
    { id: 2, role: 'tank', name: 'Grimm', job: 'WAR', configured: true, gear: generateGear(), books: { 1: 8, 2: 8, 3: 8, 4: 4 } },
    { id: 3, role: 'healer', name: 'Binckle', job: 'WHM', configured: true, gear: generateGear(), books: { 1: 8, 2: 8, 3: 8, 4: 4 } },
    { id: 4, role: 'healer', name: 'Demonic', job: 'SGE', configured: true, gear: generateGear(), bisLink: 'xivgear', books: { 1: 8, 2: 8, 3: 8, 4: 4 } },
    { id: 5, role: 'melee', name: 'Lloyd', job: 'DRG', configured: true, gear: generateGear('lloyd'), bisLink: 'xivgear', lodestoneId: '26213642', books: { 1: 8, 2: 8, 3: 8, 4: 4 } },
    { id: 6, role: 'melee', name: 'Theo', job: 'VPR', configured: true, gear: generateGear('theo'), bisLink: 'xivgear', books: { 1: 8, 2: 8, 3: 8, 4: 4 } },
    { id: 7, role: 'ranged', name: 'Vel', job: 'MCH', configured: true, gear: generateGear(), books: { 1: 8, 2: 8, 3: 8, 4: 4 } },
    { id: 8, role: 'caster', name: 'Ferus', job: 'BLM', configured: true, gear: generateGear(), books: { 1: 8, 2: 8, 3: 8, 4: 4 } },
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

// ============================================
// COMPONENTS
// ============================================

// Inline Edit Form for Empty Slot
function InlinePlayerEdit({ slot, onSave, onCancel }) {
  const [name, setName] = useState('');
  const [job, setJob] = useState('');
  const [showJobPicker, setShowJobPicker] = useState(false);
  const colors = ROLE_COLORS[slot.role];
  const inputRef = useRef(null);
  
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  
  const jobsForRole = Object.entries(JOBS).filter(([_, j]) => j.role === slot.role);
  
  const handleSave = () => {
    if (name.trim() && job) {
      onSave({ name: name.trim(), job });
    }
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') onCancel();
  };
  
  return (
    <div style={{
      backgroundColor: colors.bg,
      border: `2px solid ${colors.border}`,
      borderRadius: '8px',
      padding: '16px',
      animation: 'fadeIn 0.2s ease'
    }}>
      <div style={{ marginBottom: '12px' }}>
        <label style={{ color: '#888', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
          Player Name
        </label>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter name..."
          style={{
            width: '100%',
            backgroundColor: 'rgba(0,0,0,0.3)',
            border: '1px solid #444',
            borderRadius: '4px',
            padding: '8px 12px',
            color: '#fff',
            fontSize: '14px',
            outline: 'none'
          }}
        />
      </div>
      
      <div style={{ marginBottom: '16px' }}>
        <label style={{ color: '#888', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
          Job ({ROLE_LABELS[slot.role]})
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {jobsForRole.map(([abbr, jobData]) => (
            <button
              key={abbr}
              onClick={() => setJob(abbr)}
              style={{
                padding: '6px 10px',
                backgroundColor: job === abbr ? colors.border : 'rgba(0,0,0,0.3)',
                border: job === abbr ? `2px solid ${colors.text}` : '1px solid #444',
                borderRadius: '4px',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px'
              }}
            >
              <span>{jobData.icon}</span>
              <span>{abbr}</span>
            </button>
          ))}
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            backgroundColor: 'transparent',
            border: '1px solid #444',
            borderRadius: '4px',
            color: '#888',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim() || !job}
          style={{
            padding: '8px 16px',
            backgroundColor: name.trim() && job ? colors.border : '#333',
            border: 'none',
            borderRadius: '4px',
            color: name.trim() && job ? '#fff' : '#666',
            cursor: name.trim() && job ? 'pointer' : 'not-allowed',
            fontSize: '12px',
            fontWeight: 'bold'
          }}
        >
          Add Player
        </button>
      </div>
    </div>
  );
}

// Empty Slot Card
function EmptySlotCard({ slot, onStartEdit }) {
  const colors = ROLE_COLORS[slot.role];
  
  return (
    <div 
      onClick={onStartEdit}
      style={{
        backgroundColor: 'rgba(20, 20, 30, 0.6)',
        border: `2px dashed ${colors.border}`,
        borderRadius: '8px',
        padding: '20px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        minHeight: '80px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.backgroundColor = colors.bg;
        e.currentTarget.style.borderStyle = 'solid';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(20, 20, 30, 0.6)';
        e.currentTarget.style.borderStyle = 'dashed';
      }}
    >
      <div style={{
        width: '44px',
        height: '44px',
        borderRadius: '6px',
        backgroundColor: 'rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        opacity: 0.4
      }}>
        +
      </div>
      <div>
        <div style={{ color: colors.text, fontWeight: 'bold', fontSize: '14px' }}>
          {ROLE_LABELS[slot.role]} {slot.slot}
        </div>
        <div style={{ color: '#555', fontSize: '12px' }}>
          Click to add player
        </div>
      </div>
    </div>
  );
}

// Compact Player Card
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
      {/* Header row */}
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
            width: '40px',
            height: '40px',
            borderRadius: '6px',
            backgroundColor: colors.headerBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px'
          }}>
            {job?.icon}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px', fontSize: '11px' }}>
              <span style={{ color: player.bisLink ? '#4a90c2' : '#444' }}>
                BiS: {player.bisLink ? '✓ Set' : '—'}
              </span>
              <span style={{ color: player.lodestoneId ? '#4ab87a' : '#444' }}>
                {player.lodestoneId ? '✓ Synced' : '○ Not linked'}
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
          <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '16px' }}>
            {stats.completed}/11
          </div>
          <span style={{ color: '#555', fontSize: '12px' }}>▶</span>
        </div>
      </div>
      
      {/* Stats row */}
      <div style={{
        padding: '8px 12px',
        paddingLeft: '62px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
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
        <button
          onClick={(e) => { e.stopPropagation(); onCopy(); }}
          style={{
            marginLeft: 'auto',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#444',
            cursor: 'pointer',
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '4px',
            transition: 'color 0.2s'
          }}
          onMouseOver={(e) => e.target.style.color = '#888'}
          onMouseOut={(e) => e.target.style.color = '#444'}
        >
          ⧉ Copy
        </button>
      </div>
    </div>
  );
}

// Expanded Player Card (with Gear Table)
function PlayerCardExpanded({ player, onCollapse, onGearChange, onCopy }) {
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
      {/* Header */}
      <div 
        onClick={onCollapse}
        style={{
          padding: '12px',
          backgroundColor: colors.headerBg,
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '6px',
            backgroundColor: colors.border,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px'
          }}>
            {job?.icon}
          </div>
          <div>
            <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '16px' }}>{player.name}</span>
            <span style={{ color: colors.text, marginLeft: '8px', fontSize: '14px' }}>{player.job}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: '#fff', fontWeight: 'bold' }}>{stats.completed}/11</span>
          <span style={{ color: '#888', fontSize: '12px' }}>▼</span>
        </div>
      </div>
      
      {/* Gear Table */}
      <div style={{ padding: '12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ color: '#666' }}>
              <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 'normal' }}>Slot</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 'normal' }}>BiS Source</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 'normal' }}>Have</th>
              <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 'normal' }}>Aug</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 'normal' }}>Books</th>
            </tr>
          </thead>
          <tbody>
            {GEAR_SLOTS.map(slot => {
              const g = player.gear[slot];
              const bookInfo = BOOK_COSTS[slot];
              return (
                <tr key={slot} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '8px', color: '#ccc' }}>{SLOT_LABELS[slot]}</td>
                  <td style={{ textAlign: 'center', padding: '8px' }}>
                    <select
                      value={g.bisSource}
                      onChange={(e) => onGearChange(slot, { ...g, bisSource: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        backgroundColor: g.bisSource === 'raid' ? 'rgba(196, 68, 68, 0.3)' : 'rgba(68, 170, 68, 0.3)',
                        color: g.bisSource === 'raid' ? '#c44' : '#4a4',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontSize: '11px'
                      }}
                    >
                      <option value="raid">Raid</option>
                      <option value="tome">Tome</option>
                    </select>
                  </td>
                  <td style={{ textAlign: 'center', padding: '8px' }}>
                    <input
                      type="checkbox"
                      checked={g.hasItem}
                      onChange={() => onGearChange(slot, { ...g, hasItem: !g.hasItem })}
                      onClick={(e) => e.stopPropagation()}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                  </td>
                  <td style={{ textAlign: 'center', padding: '8px' }}>
                    <input
                      type="checkbox"
                      checked={g.isAugmented}
                      onChange={() => onGearChange(slot, { ...g, isAugmented: !g.isAugmented })}
                      onClick={(e) => e.stopPropagation()}
                      disabled={g.bisSource === 'raid'}
                      style={{ 
                        cursor: g.bisSource === 'raid' ? 'not-allowed' : 'pointer',
                        opacity: g.bisSource === 'raid' ? 0.3 : 1,
                        width: '16px',
                        height: '16px'
                      }}
                    />
                  </td>
                  <td style={{ textAlign: 'right', padding: '8px', color: '#666', fontSize: '10px' }}>
                    {g.bisSource === 'raid' && !g.hasItem ? `F${bookInfo.floor}: ${bookInfo.cost}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {/* Actions */}
        <div style={{ 
          marginTop: '12px', 
          paddingTop: '12px', 
          borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            onClick={(e) => { e.stopPropagation(); onCopy(); }}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #444',
              color: '#888',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px'
            }}
          >
            ⧉ Duplicate
          </button>
          <button
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#664444',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '11px'
            }}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// View Toggle
function ViewToggle({ view, onViewChange }) {
  return (
    <div style={{
      display: 'inline-flex',
      backgroundColor: 'rgba(40, 40, 50, 0.8)',
      borderRadius: '6px',
      padding: '3px'
    }}>
      <button
        onClick={() => onViewChange('compact')}
        title="Compact view"
        style={{
          padding: '6px 12px',
          borderRadius: '4px',
          border: 'none',
          backgroundColor: view === 'compact' ? 'rgba(201, 162, 39, 0.3)' : 'transparent',
          color: view === 'compact' ? '#c9a227' : '#555',
          cursor: 'pointer',
          fontSize: '16px',
          lineHeight: 1
        }}
      >
        ▤
      </button>
      <button
        onClick={() => onViewChange('expanded')}
        title="Expanded view"
        style={{
          padding: '6px 12px',
          borderRadius: '4px',
          border: 'none',
          backgroundColor: view === 'expanded' ? 'rgba(201, 162, 39, 0.3)' : 'transparent',
          color: view === 'expanded' ? '#c9a227' : '#555',
          cursor: 'pointer',
          fontSize: '16px',
          lineHeight: 1
        }}
      >
        ☰
      </button>
    </div>
  );
}

// ============================================
// MAIN APP
// ============================================

export default function FFXIVRaidPlannerV5() {
  const [showTemplate, setShowTemplate] = useState(true); // Start with template to demo
  const [staticData, setStaticData] = useState(createTemplateStatic());
  const [viewMode, setViewMode] = useState('compact');
  const [editingSlot, setEditingSlot] = useState(null);
  
  const handleConfigurePlayer = (slotId, data) => {
    setStaticData(prev => ({
      ...prev,
      players: prev.players.map(p => 
        p.id === slotId 
          ? { ...p, ...data, configured: true, gear: generateGear(), books: { 1: 0, 2: 0, 3: 0, 4: 0 } }
          : p
      )
    }));
    setEditingSlot(null);
  };
  
  const handleGearChange = (playerId, slot, newGear) => {
    setStaticData(prev => ({
      ...prev,
      players: prev.players.map(p =>
        p.id === playerId
          ? { ...p, gear: { ...p.gear, [slot]: newGear } }
          : p
      )
    }));
  };
  
  const sortedPlayers = [...staticData.players].sort((a, b) => {
    return ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
  });

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
            fontSize: '22px',
            fontWeight: 'normal',
            margin: 0,
            fontFamily: 'Cinzel, serif',
            letterSpacing: '2px'
          }}>
            {staticData.name.toUpperCase()}
          </h1>
          <p style={{ color: '#888', fontSize: '11px', margin: '4px 0 0 0' }}>
            {staticData.tier} • Week {staticData.week}
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => {
              setShowTemplate(!showTemplate);
              setStaticData(showTemplate ? createDemoStatic() : createTemplateStatic());
              setEditingSlot(null);
            }}
            style={{
              backgroundColor: 'rgba(80, 80, 80, 0.3)',
              border: '1px solid #555',
              color: '#888',
              padding: '8px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '11px'
            }}
          >
            {showTemplate ? 'Show Filled Static' : 'Show Empty Template'}
          </button>
          
          <ViewToggle view={viewMode} onViewChange={setViewMode} />
        </div>
      </div>

      {/* Info Banner for Template */}
      {showTemplate && (
        <div style={{
          backgroundColor: 'rgba(201, 162, 39, 0.1)',
          border: '1px solid rgba(201, 162, 39, 0.3)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ fontSize: '18px' }}>💡</span>
          <div>
            <div style={{ color: '#c9a227', fontWeight: 'bold', fontSize: '13px' }}>Template Static</div>
            <div style={{ color: '#888', fontSize: '12px' }}>
              Click any slot to configure a player. Pre-filled with standard 8-player composition.
            </div>
          </div>
        </div>
      )}

      {/* Player Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '12px'
      }}>
        {sortedPlayers.map(player => {
          // If editing this slot, show inline edit form
          if (editingSlot === player.id) {
            return (
              <InlinePlayerEdit
                key={player.id}
                slot={player}
                onSave={(data) => handleConfigurePlayer(player.id, data)}
                onCancel={() => setEditingSlot(null)}
              />
            );
          }
          
          // If not configured, show empty slot
          if (!player.configured) {
            return (
              <EmptySlotCard
                key={player.id}
                slot={player}
                onStartEdit={() => setEditingSlot(player.id)}
              />
            );
          }
          
          // Configured player - compact or expanded based on view mode
          if (viewMode === 'expanded') {
            return (
              <PlayerCardExpanded
                key={player.id}
                player={player}
                onCollapse={() => {}}
                onGearChange={(slot, gear) => handleGearChange(player.id, slot, gear)}
                onCopy={() => console.log('Copy', player.id)}
              />
            );
          }
          
          return (
            <PlayerCardCompact
              key={player.id}
              player={player}
              onExpand={() => {}}
              onCopy={() => console.log('Copy', player.id)}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div style={{
        marginTop: '24px',
        padding: '12px',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: '6px',
        fontSize: '10px',
        color: '#666'
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <span><span style={{ color: '#4a90c2' }}>■</span> Tank</span>
          <span><span style={{ color: '#4ab87a' }}>■</span> Healer</span>
          <span><span style={{ color: '#c24a4a' }}>■</span> Melee</span>
          <span><span style={{ color: '#c29a4a' }}>■</span> Ranged</span>
          <span><span style={{ color: '#a24ac2' }}>■</span> Caster</span>
        </div>
        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          Toggle view: ▤ Compact | ☰ Expanded with gear table
        </div>
      </div>
    </div>
  );
}
