import React, { useState, useMemo } from 'react';

// Constants for gear calculations
const TOME_CAP_PER_WEEK = 450;
const GEAR_SLOTS = ['weapon', 'helmet', 'chest', 'gloves', 'legs', 'feet', 'earring', 'necklace', 'bracelet', 'ring1', 'ring2'];
const LEFT_SIDE_SLOTS = ['helmet', 'chest', 'gloves', 'legs', 'feet'];
const RIGHT_SIDE_SLOTS = ['earring', 'necklace', 'bracelet', 'ring1', 'ring2'];

const TOME_COSTS = {
  weapon: 500, // Plus Universal Tomestone
  helmet: 495,
  chest: 825,
  gloves: 495,
  legs: 825,
  feet: 495,
  earring: 375,
  necklace: 375,
  bracelet: 375,
  ring1: 375,
  ring2: 375
};

const BOOK_COSTS = {
  weapon: { floor: 4, cost: 8 },
  helmet: { floor: 2, cost: 4 },
  chest: { floor: 3, cost: 6 },
  gloves: { floor: 2, cost: 4 },
  legs: { floor: 3, cost: 6 },
  feet: { floor: 2, cost: 4 },
  earring: { floor: 1, cost: 3 },
  necklace: { floor: 1, cost: 3 },
  bracelet: { floor: 1, cost: 3 },
  ring1: { floor: 1, cost: 3 },
  ring2: { floor: 1, cost: 3 }
};

const UPGRADE_MATERIAL_BOOK_COST = 4;

const SLOT_LABELS = {
  weapon: 'Weapon',
  helmet: 'Helmet',
  chest: 'Chest',
  gloves: 'Gloves',
  legs: 'Legs',
  feet: 'Feet',
  earring: 'Earring',
  necklace: 'Necklace',
  bracelet: 'Bracelet',
  ring1: 'Ring',
  ring2: 'Ring'
};

const ROLE_COLORS = {
  tank: { bg: '#1a3a5c', border: '#2d5a8a', header: '#0d2840' },
  healer: { bg: '#1a3d2e', border: '#2d6b4f', header: '#0d2818' },
  dps: { bg: '#4a1a1a', border: '#8a2d2d', header: '#2d0d0d' }
};

// Sample data - 8 players
const initialPlayers = [
  { id: 1, name: 'Alexander', job: 'PLD', role: 'tank', etroLink: '' },
  { id: 2, name: 'Grimm', job: 'WAR', role: 'tank', etroLink: '' },
  { id: 3, name: 'Binckle', job: 'WHM', role: 'healer', etroLink: '' },
  { id: 4, name: 'Demonic', job: 'SGE', role: 'healer', etroLink: 'https://xivgear.app/?page=sl|73551c' },
  { id: 5, name: 'Lloyd', job: 'DRG', role: 'dps', etroLink: '' },
  { id: 6, name: 'Theo', job: 'VPR', role: 'dps', etroLink: 'https://xivgear.app/?page=bis|vpr|cur' },
  { id: 7, name: 'Ferus', job: 'BLM', role: 'dps', etroLink: '' },
  { id: 8, name: 'Vel', job: 'MCH', role: 'dps', etroLink: '' }
];

// Generate initial gear state
const generateInitialGear = () => {
  const gear = {};
  GEAR_SLOTS.forEach(slot => {
    gear[slot] = {
      bisSource: 'raid', // 'raid' or 'tome'
      hasItem: false,
      isAugmented: false
    };
  });
  return gear;
};

// Player Card Component
const PlayerCard = ({ player, gear, onGearChange }) => {
  const colors = ROLE_COLORS[player.role];
  
  // Calculate derived stats
  const stats = useMemo(() => {
    let raidPiecesNeeded = 0;
    let tomePiecesNeeded = 0;
    let polishNeeded = 0; // Twine for left side
    let weaveNeeded = 0;  // Glaze for right side
    let weaponUpgradeNeeded = 0;
    let totalTomesNeeded = 0;
    
    // Pages/books needed per floor
    const pagesNeeded = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const pagesForGear = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const pagesForUpgrades = { 1: 0, 2: 0, 3: 0, 4: 0 };
    
    GEAR_SLOTS.forEach(slot => {
      const slotGear = gear[slot];
      const isLeftSide = LEFT_SIDE_SLOTS.includes(slot);
      const isRightSide = RIGHT_SIDE_SLOTS.includes(slot);
      const isWeapon = slot === 'weapon';
      
      if (slotGear.bisSource === 'raid') {
        if (!slotGear.hasItem) {
          raidPiecesNeeded++;
          // Add book cost for this slot
          const bookInfo = BOOK_COSTS[slot];
          pagesForGear[bookInfo.floor] += bookInfo.cost;
        }
      } else { // tome
        if (!slotGear.hasItem) {
          tomePiecesNeeded++;
          totalTomesNeeded += TOME_COSTS[slot];
        }
        
        // Count upgrade materials needed
        if (!slotGear.isAugmented) {
          if (isLeftSide) {
            polishNeeded++;
            if (!slotGear.hasItem) {
              pagesForUpgrades[3] += UPGRADE_MATERIAL_BOOK_COST;
            }
          } else if (isRightSide) {
            weaveNeeded++;
            if (!slotGear.hasItem) {
              pagesForUpgrades[2] += UPGRADE_MATERIAL_BOOK_COST;
            }
          } else if (isWeapon) {
            weaponUpgradeNeeded = 1;
          }
        }
      }
    });
    
    // Total pages needed
    [1, 2, 3, 4].forEach(floor => {
      pagesNeeded[floor] = pagesForGear[floor] + pagesForUpgrades[floor];
    });
    
    const weeksForTomes = totalTomesNeeded > 0 ? Math.ceil(totalTomesNeeded / TOME_CAP_PER_WEEK) : 0;
    
    return {
      raidPiecesNeeded,
      tomePiecesNeeded,
      polishNeeded,
      weaveNeeded,
      weaponUpgradeNeeded,
      totalTomesNeeded,
      weeksForTomes,
      pagesNeeded,
      pagesForGear,
      pagesForUpgrades
    };
  }, [gear]);

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
      borderRadius: '4px',
      overflow: 'hidden',
      fontSize: '11px',
      minWidth: '280px',
      maxWidth: '320px'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: colors.header,
        padding: '6px 10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: `1px solid ${colors.border}`
      }}>
        <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '13px' }}>{player.name}</span>
        <span style={{ 
          color: player.etroLink ? '#6eb5ff' : '#888',
          fontSize: '10px',
          textDecoration: player.etroLink ? 'underline' : 'none',
          cursor: player.etroLink ? 'pointer' : 'default'
        }}>
          {player.etroLink ? 'BiS Link' : 'bis link for reference'}
        </span>
      </div>

      {/* Gear Table */}
      <div style={{ padding: '4px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: '#aaa', fontSize: '10px' }}>
              <th style={{ textAlign: 'left', padding: '2px 4px' }}></th>
              <th style={{ textAlign: 'center', padding: '2px', width: '50px' }}></th>
              <th style={{ textAlign: 'center', padding: '2px', width: '40px' }}>Have?</th>
              <th style={{ textAlign: 'center', padding: '2px', width: '60px' }}>Augmented?</th>
            </tr>
          </thead>
          <tbody>
            {GEAR_SLOTS.map(slot => {
              const slotGear = gear[slot];
              const canAugment = slotGear.bisSource === 'tome';
              
              return (
                <tr key={slot} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ color: '#ccc', padding: '3px 4px' }}>{SLOT_LABELS[slot]}</td>
                  <td style={{ padding: '2px' }}>
                    <select
                      value={slotGear.bisSource}
                      onChange={(e) => handleSourceChange(slot, e.target.value)}
                      style={{
                        backgroundColor: slotGear.bisSource === 'raid' ? '#c44' : '#4a4',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '2px',
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
                      onChange={() => handleHasItemChange(slot)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ textAlign: 'center', padding: '2px' }}>
                    {canAugment ? (
                      <input
                        type="checkbox"
                        checked={slotGear.isAugmented}
                        onChange={() => handleAugmentedChange(slot)}
                        style={{ cursor: 'pointer' }}
                        disabled={!slotGear.hasItem}
                      />
                    ) : (
                      <span style={{ color: '#555' }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Upgrade Materials Section */}
      <div style={{ 
        borderTop: `1px solid ${colors.border}`,
        padding: '6px',
        backgroundColor: 'rgba(0,0,0,0.2)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
          <thead>
            <tr style={{ color: '#888' }}>
              <th style={{ textAlign: 'left', padding: '2px' }}></th>
              <th style={{ textAlign: 'center', padding: '2px', color: '#f88' }}>Total Need</th>
              <th style={{ textAlign: 'center', padding: '2px', color: '#8f8' }}>Bought</th>
              <th style={{ textAlign: 'center', padding: '2px', color: '#88f' }}>Drops</th>
              <th style={{ textAlign: 'center', padding: '2px', color: '#ff8' }}>Still Need</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ color: '#ccc', padding: '2px' }}>Polish</td>
              <td style={{ textAlign: 'center', color: '#f88' }}>{stats.polishNeeded}</td>
              <td style={{ textAlign: 'center', color: '#8f8' }}>0</td>
              <td style={{ textAlign: 'center', color: '#88f' }}>0</td>
              <td style={{ textAlign: 'center', color: '#ff8', fontWeight: 'bold' }}>{stats.polishNeeded}</td>
            </tr>
            <tr>
              <td style={{ color: '#ccc', padding: '2px' }}>Weave</td>
              <td style={{ textAlign: 'center', color: '#f88' }}>{stats.weaveNeeded}</td>
              <td style={{ textAlign: 'center', color: '#8f8' }}>0</td>
              <td style={{ textAlign: 'center', color: '#88f' }}>0</td>
              <td style={{ textAlign: 'center', color: '#ff8', fontWeight: 'bold' }}>{stats.weaveNeeded}</td>
            </tr>
            <tr>
              <td style={{ color: '#ccc', padding: '2px' }}>Weapon</td>
              <td style={{ textAlign: 'center', color: '#f88' }}>{stats.weaponUpgradeNeeded}</td>
              <td style={{ textAlign: 'center', color: '#8f8' }}>0</td>
              <td style={{ textAlign: 'center', color: '#88f' }}>0</td>
              <td style={{ textAlign: 'center', color: '#ff8', fontWeight: 'bold' }}>{stats.weaponUpgradeNeeded}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Pages/Books Section */}
      <div style={{ 
        borderTop: `1px solid ${colors.border}`,
        padding: '6px',
        backgroundColor: 'rgba(0,0,0,0.15)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
          <thead>
            <tr style={{ color: '#888' }}>
              <th style={{ textAlign: 'left', padding: '2px' }}>Pages for:</th>
              <th style={{ textAlign: 'center', padding: '2px' }}>Gear only</th>
              <th style={{ textAlign: 'center', padding: '2px' }}>Upgrades</th>
              <th style={{ textAlign: 'center', padding: '2px', color: '#ff8' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4].map(floor => (
              <tr key={floor}>
                <td style={{ color: '#ccc', padding: '2px' }}>{floor === 1 ? '1st' : floor === 2 ? '2nd' : floor === 3 ? '3rd' : '4th'}</td>
                <td style={{ textAlign: 'center', color: '#aaa' }}>{stats.pagesForGear[floor] || '-'}</td>
                <td style={{ textAlign: 'center', color: '#aaa' }}>{stats.pagesForUpgrades[floor] || '-'}</td>
                <td style={{ 
                  textAlign: 'center', 
                  color: stats.pagesNeeded[floor] > 0 ? '#ff8' : '#4a4',
                  fontWeight: 'bold'
                }}>
                  {stats.pagesNeeded[floor]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tomestone Summary */}
      <div style={{ 
        borderTop: `1px solid ${colors.border}`,
        padding: '6px',
        backgroundColor: 'rgba(0,0,0,0.25)',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '4px',
        fontSize: '10px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#888' }}>Total</div>
          <div style={{ color: '#fff', fontWeight: 'bold' }}>{stats.totalTomesNeeded}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#888' }}>Total weeks</div>
          <div style={{ color: '#fff', fontWeight: 'bold' }}>{stats.weeksForTomes.toFixed(2)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#888' }}>Still need</div>
          <div style={{ color: '#ff8', fontWeight: 'bold' }}>{stats.totalTomesNeeded}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#888' }}>Weeks left</div>
          <div style={{ color: '#ff8', fontWeight: 'bold' }}>{stats.weeksForTomes.toFixed(2)}</div>
        </div>
      </div>
      
      {/* Summary Footer */}
      <div style={{
        borderTop: `1px solid ${colors.border}`,
        padding: '6px',
        backgroundColor: 'rgba(0,0,0,0.3)',
        display: 'flex',
        justifyContent: 'space-around',
        fontSize: '10px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#f66' }}>■</span>
          <span style={{ color: '#ccc', marginLeft: '4px' }}>Raid: {stats.raidPiecesNeeded}</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#6f6' }}>■</span>
          <span style={{ color: '#ccc', marginLeft: '4px' }}>Tome: {stats.tomePiecesNeeded}</span>
        </div>
      </div>
    </div>
  );
};

// Main App
export default function FFXIVRaidPlanner() {
  const [players] = useState(initialPlayers);
  const [allGear, setAllGear] = useState(() => {
    const gear = {};
    initialPlayers.forEach(p => {
      gear[p.id] = generateInitialGear();
    });
    
    // Set Lloyd's gear to match the screenshot (5 raid, 6 tome)
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
    
    // Set Demonic's gear (with one tome piece having checkmark)
    gear[4] = {
      weapon: { bisSource: 'raid', hasItem: false, isAugmented: false },
      helmet: { bisSource: 'raid', hasItem: false, isAugmented: false },
      chest: { bisSource: 'tome', hasItem: true, isAugmented: false },
      gloves: { bisSource: 'raid', hasItem: false, isAugmented: false },
      legs: { bisSource: 'raid', hasItem: false, isAugmented: false },
      feet: { bisSource: 'raid', hasItem: false, isAugmented: false },
      earring: { bisSource: 'raid', hasItem: false, isAugmented: false },
      necklace: { bisSource: 'raid', hasItem: false, isAugmented: false },
      bracelet: { bisSource: 'raid', hasItem: false, isAugmented: false },
      ring1: { bisSource: 'raid', hasItem: false, isAugmented: false },
      ring2: { bisSource: 'tome', hasItem: false, isAugmented: false }
    };
    
    return gear;
  });

  const handleGearChange = (playerId, slot, newGear) => {
    setAllGear(prev => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [slot]: newGear
      }
    }));
  };

  // Group players by role
  const tanks = players.filter(p => p.role === 'tank');
  const healers = players.filter(p => p.role === 'healer');
  const dps = players.filter(p => p.role === 'dps');

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
        marginBottom: '24px',
        borderBottom: '1px solid rgba(201, 162, 39, 0.3)',
        paddingBottom: '16px'
      }}>
        <h1 style={{
          color: '#c9a227',
          fontSize: '28px',
          fontWeight: 'normal',
          margin: '0 0 8px 0',
          fontFamily: 'Cinzel, serif',
          letterSpacing: '2px'
        }}>
          RAID GEAR TRACKER
        </h1>
        <p style={{ color: '#888', fontSize: '12px', margin: 0 }}>
          AAC Light-heavyweight (Savage) • Week 1
        </p>
      </div>

      {/* Player Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '12px',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* Tanks */}
        {tanks.map(player => (
          <PlayerCard
            key={player.id}
            player={player}
            gear={allGear[player.id]}
            onGearChange={handleGearChange}
          />
        ))}
        
        {/* Healers */}
        {healers.map(player => (
          <PlayerCard
            key={player.id}
            player={player}
            gear={allGear[player.id]}
            onGearChange={handleGearChange}
          />
        ))}
        
        {/* DPS */}
        {dps.map(player => (
          <PlayerCard
            key={player.id}
            player={player}
            gear={allGear[player.id]}
            onGearChange={handleGearChange}
          />
        ))}
      </div>

      {/* Legend */}
      <div style={{
        marginTop: '24px',
        padding: '12px',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: '4px',
        maxWidth: '600px',
        margin: '24px auto 0'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '24px',
          fontSize: '11px',
          color: '#888'
        }}>
          <span><span style={{ color: '#c44' }}>■</span> Raid = Savage drop BiS</span>
          <span><span style={{ color: '#4a4' }}>■</span> Tome = Tomestone gear BiS</span>
          <span><span style={{ color: '#ff8' }}>■</span> = Still needed</span>
        </div>
        <div style={{
          marginTop: '8px',
          fontSize: '10px',
          color: '#666',
          textAlign: 'center'
        }}>
          Polish = Twine (armor upgrade) • Weave = Glaze (accessory upgrade) • Weapon = Solvent
        </div>
      </div>
    </div>
  );
}
