import React, { useState } from 'react';

// Concept A: Dark FFXIV-Themed Dashboard
// Design philosophy: Dark, atmospheric, evocative of FFXIV's UI with gold accents
// Key differentiator: Feels native to FFXIV players, immersive

const JOBS = {
  tanks: ['PLD', 'WAR', 'DRK', 'GNB'],
  healers: ['WHM', 'SCH', 'AST', 'SGE'],
  melee: ['MNK', 'DRG', 'NIN', 'SAM', 'RPR', 'VPR'],
  ranged: ['BRD', 'MCH', 'DNC'],
  caster: ['BLM', 'SMN', 'RDM', 'PCT']
};

const GEAR_SLOTS = [
  { id: 'weapon', name: 'Weapon', floor: 4 },
  { id: 'head', name: 'Head', floor: 2 },
  { id: 'body', name: 'Body', floor: 3 },
  { id: 'hands', name: 'Hands', floor: 2 },
  { id: 'legs', name: 'Legs', floor: 3 },
  { id: 'feet', name: 'Feet', floor: 2 },
  { id: 'earring', name: 'Earring', floor: 1 },
  { id: 'necklace', name: 'Necklace', floor: 1 },
  { id: 'bracelet', name: 'Bracelet', floor: 1 },
  { id: 'ring1', name: 'Ring', floor: 1 },
  { id: 'ring2', name: 'Ring', floor: 'tome' }
];

const MOCK_PLAYERS = [
  { id: 1, name: 'Udra Virias', job: 'DRK', role: 'tank', gear: { weapon: 'need', head: 'have', body: 'need', hands: 'have', legs: 'need', feet: 'have', earring: 'need', necklace: 'have', bracelet: 'need', ring1: 'have', ring2: 'tome' } },
  { id: 2, name: 'Tank Two', job: 'GNB', role: 'tank', gear: { weapon: 'need', head: 'need', body: 'have', hands: 'need', legs: 'have', feet: 'need', earring: 'have', necklace: 'need', bracelet: 'have', ring1: 'need', ring2: 'tome' } },
  { id: 3, name: 'Healer One', job: 'WHM', role: 'healer', gear: { weapon: 'need', head: 'have', body: 'need', hands: 'have', legs: 'need', feet: 'have', earring: 'need', necklace: 'have', bracelet: 'need', ring1: 'have', ring2: 'tome' } },
  { id: 4, name: 'Healer Two', job: 'SGE', role: 'healer', gear: { weapon: 'need', head: 'need', body: 'have', hands: 'need', legs: 'have', feet: 'need', earring: 'have', necklace: 'need', bracelet: 'have', ring1: 'need', ring2: 'tome' } },
  { id: 5, name: 'DPS One', job: 'SAM', role: 'melee', gear: { weapon: 'have', head: 'have', body: 'need', hands: 'have', legs: 'need', feet: 'have', earring: 'need', necklace: 'have', bracelet: 'need', ring1: 'have', ring2: 'tome' } },
  { id: 6, name: 'DPS Two', job: 'NIN', role: 'melee', gear: { weapon: 'need', head: 'need', body: 'need', hands: 'need', legs: 'have', feet: 'need', earring: 'have', necklace: 'need', bracelet: 'have', ring1: 'need', ring2: 'tome' } },
  { id: 7, name: 'DPS Three', job: 'BRD', role: 'ranged', gear: { weapon: 'need', head: 'have', body: 'need', hands: 'have', legs: 'need', feet: 'have', earring: 'need', necklace: 'have', bracelet: 'need', ring1: 'have', ring2: 'tome' } },
  { id: 8, name: 'DPS Four', job: 'PCT', role: 'caster', gear: { weapon: 'need', head: 'need', body: 'have', hands: 'need', legs: 'have', feet: 'need', earring: 'have', necklace: 'need', bracelet: 'have', ring1: 'need', ring2: 'tome' } },
];

const roleColors = {
  tank: { bg: 'rgba(59, 130, 246, 0.2)', border: '#3b82f6', text: '#93c5fd' },
  healer: { bg: 'rgba(34, 197, 94, 0.2)', border: '#22c55e', text: '#86efac' },
  melee: { bg: 'rgba(239, 68, 68, 0.2)', border: '#ef4444', text: '#fca5a5' },
  ranged: { bg: 'rgba(239, 68, 68, 0.2)', border: '#ef4444', text: '#fca5a5' },
  caster: { bg: 'rgba(239, 68, 68, 0.2)', border: '#ef4444', text: '#fca5a5' },
};

export default function FFXIVRaidPlanner() {
  const [activeTab, setActiveTab] = useState('gear');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [floorClears, setFloorClears] = useState({ 1: 2, 2: 2, 3: 1, 4: 0 });

  const GearCell = ({ status, onClick }) => {
    const styles = {
      need: { bg: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', border: '#c9a227', icon: '○' },
      have: { bg: 'linear-gradient(135deg, #0d3320 0%, #064e3b 100%)', border: '#22c55e', icon: '✓' },
      tome: { bg: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', border: '#8b5cf6', icon: '◆' },
    };
    const style = styles[status] || styles.need;
    
    return (
      <button
        onClick={onClick}
        style={{
          width: '32px',
          height: '32px',
          background: style.bg,
          border: `1px solid ${style.border}`,
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          color: style.border,
          fontSize: '14px',
          fontWeight: 'bold',
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'scale(1.1)';
          e.target.style.boxShadow = `0 0 12px ${style.border}40`;
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'scale(1)';
          e.target.style.boxShadow = 'none';
        }}
      >
        {style.icon}
      </button>
    );
  };

  const PlayerRow = ({ player }) => {
    const role = roleColors[player.role];
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '180px repeat(11, 40px)',
          gap: '4px',
          alignItems: 'center',
          padding: '8px 12px',
          background: role.bg,
          borderLeft: `3px solid ${role.border}`,
          borderRadius: '0 8px 8px 0',
          marginBottom: '4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            background: role.border,
            color: '#0a0a0f',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 'bold',
            fontFamily: 'monospace',
          }}>
            {player.job}
          </span>
          <span style={{ color: '#e5e5e5', fontSize: '13px', fontWeight: '500' }}>
            {player.name}
          </span>
        </div>
        {GEAR_SLOTS.map((slot) => (
          <GearCell
            key={slot.id}
            status={player.gear[slot.id]}
            onClick={() => console.log(`Toggle ${player.name} ${slot.id}`)}
          />
        ))}
      </div>
    );
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0a0f 0%, #12121a 50%, #0a0a0f 100%)',
      color: '#e5e5e5',
      fontFamily: '"Cinzel", "Times New Roman", serif',
      padding: '0',
    }}>
      {/* Decorative top border */}
      <div style={{
        height: '4px',
        background: 'linear-gradient(90deg, transparent 0%, #c9a227 20%, #f4d03f 50%, #c9a227 80%, transparent 100%)',
      }} />
      
      {/* Header */}
      <header style={{
        padding: '20px 32px',
        borderBottom: '1px solid #2a2a3a',
        background: 'linear-gradient(180deg, #12121a 0%, #0a0a0f 100%)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: '600',
              background: 'linear-gradient(135deg, #c9a227 0%, #f4d03f 50%, #c9a227 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '2px',
            }}>
              ARCADION HEAVYWEIGHT
            </h1>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '12px',
              color: '#6b7280',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              fontFamily: 'system-ui',
            }}>
              Savage Raid Planning • Week 3
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{
              display: 'flex',
              gap: '8px',
              padding: '8px 16px',
              background: '#1a1a2e',
              borderRadius: '8px',
              border: '1px solid #2a2a3a',
            }}>
              {[1, 2, 3, 4].map((floor) => (
                <div key={floor} style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '10px',
                    color: '#6b7280',
                    marginBottom: '2px',
                  }}>M{floor}</div>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: floorClears[floor] > 0 ? '#22c55e' : '#4b5563',
                    fontFamily: 'monospace',
                  }}>{floorClears[floor]}</div>
                </div>
              ))}
            </div>
            
            <button style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #c9a227 0%, #a67c00 100%)',
              border: 'none',
              borderRadius: '6px',
              color: '#0a0a0f',
              fontWeight: 'bold',
              fontSize: '12px',
              letterSpacing: '1px',
              cursor: 'pointer',
              fontFamily: 'system-ui',
            }}>
              SHARE LINK
            </button>
          </div>
        </div>
        
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginTop: '20px' }}>
          {['gear', 'loot', 'priority', 'history'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 24px',
                background: activeTab === tab 
                  ? 'linear-gradient(180deg, #1a1a2e 0%, #12121a 100%)'
                  : 'transparent',
                border: activeTab === tab 
                  ? '1px solid #c9a227'
                  : '1px solid transparent',
                borderBottom: activeTab === tab ? '1px solid #12121a' : '1px solid #2a2a3a',
                borderRadius: '8px 8px 0 0',
                color: activeTab === tab ? '#c9a227' : '#6b7280',
                fontSize: '12px',
                fontWeight: '600',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                fontFamily: 'system-ui',
                marginBottom: '-1px',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main style={{ padding: '24px 32px' }}>
        {/* Gear Overview */}
        <div style={{
          background: 'linear-gradient(180deg, #12121a 0%, #0a0a0f 100%)',
          border: '1px solid #2a2a3a',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          {/* Column Headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '180px repeat(11, 40px)',
            gap: '4px',
            padding: '12px 12px 8px 12px',
            borderBottom: '1px solid #2a2a3a',
            background: '#0a0a0f',
          }}>
            <div style={{ fontSize: '11px', color: '#6b7280', fontFamily: 'system-ui' }}>PLAYER</div>
            {GEAR_SLOTS.map((slot) => (
              <div key={slot.id} style={{
                fontSize: '9px',
                color: '#6b7280',
                textAlign: 'center',
                fontFamily: 'system-ui',
              }}>
                {slot.name.slice(0, 4).toUpperCase()}
              </div>
            ))}
          </div>

          {/* Player Rows */}
          <div style={{ padding: '8px' }}>
            {/* Tanks */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{
                fontSize: '10px',
                color: '#3b82f6',
                letterSpacing: '2px',
                marginBottom: '4px',
                paddingLeft: '4px',
                fontFamily: 'system-ui',
              }}>TANKS</div>
              {MOCK_PLAYERS.filter(p => p.role === 'tank').map(player => (
                <PlayerRow key={player.id} player={player} />
              ))}
            </div>

            {/* Healers */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{
                fontSize: '10px',
                color: '#22c55e',
                letterSpacing: '2px',
                marginBottom: '4px',
                paddingLeft: '4px',
                fontFamily: 'system-ui',
              }}>HEALERS</div>
              {MOCK_PLAYERS.filter(p => p.role === 'healer').map(player => (
                <PlayerRow key={player.id} player={player} />
              ))}
            </div>

            {/* DPS */}
            <div>
              <div style={{
                fontSize: '10px',
                color: '#ef4444',
                letterSpacing: '2px',
                marginBottom: '4px',
                paddingLeft: '4px',
                fontFamily: 'system-ui',
              }}>DAMAGE</div>
              {MOCK_PLAYERS.filter(p => ['melee', 'ranged', 'caster'].includes(p.role)).map(player => (
                <PlayerRow key={player.id} player={player} />
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div style={{
          display: 'flex',
          gap: '24px',
          marginTop: '16px',
          padding: '12px 16px',
          background: '#12121a',
          borderRadius: '8px',
          border: '1px solid #2a2a3a',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '24px',
              height: '24px',
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
              border: '1px solid #c9a227',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c9a227',
              fontSize: '12px',
            }}>○</div>
            <span style={{ fontSize: '12px', color: '#9ca3af', fontFamily: 'system-ui' }}>Need (Savage)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '24px',
              height: '24px',
              background: 'linear-gradient(135deg, #0d3320 0%, #064e3b 100%)',
              border: '1px solid #22c55e',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#22c55e',
              fontSize: '12px',
            }}>✓</div>
            <span style={{ fontSize: '12px', color: '#9ca3af', fontFamily: 'system-ui' }}>Have</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '24px',
              height: '24px',
              background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
              border: '1px solid #8b5cf6',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#8b5cf6',
              fontSize: '12px',
            }}>◆</div>
            <span style={{ fontSize: '12px', color: '#9ca3af', fontFamily: 'system-ui' }}>Tome Gear</span>
          </div>
        </div>

        {/* Quick Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          marginTop: '24px',
        }}>
          {[
            { label: 'Total Drops Needed', value: '47', color: '#c9a227' },
            { label: 'Weapons Remaining', value: '7/8', color: '#ef4444' },
            { label: 'Tomes This Week', value: '450', color: '#8b5cf6' },
            { label: 'Est. BiS Complete', value: 'Week 8', color: '#22c55e' },
          ].map((stat, i) => (
            <div key={i} style={{
              padding: '16px',
              background: 'linear-gradient(180deg, #12121a 0%, #0a0a0f 100%)',
              border: '1px solid #2a2a3a',
              borderRadius: '8px',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: stat.color,
                fontFamily: 'monospace',
              }}>{stat.value}</div>
              <div style={{
                fontSize: '11px',
                color: '#6b7280',
                marginTop: '4px',
                fontFamily: 'system-ui',
              }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        padding: '16px 32px',
        borderTop: '1px solid #2a2a3a',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '11px',
        color: '#4b5563',
        fontFamily: 'system-ui',
      }}>
        <span>Last updated: 2 minutes ago • 3 members online</span>
        <span>Plan ID: arc-hwt-x7k9m</span>
      </footer>
    </div>
  );
}
