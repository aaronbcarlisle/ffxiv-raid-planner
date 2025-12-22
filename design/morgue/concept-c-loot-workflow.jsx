import React, { useState } from 'react';

// Concept C: Loot Distribution Focus
// Design philosophy: Gamified, visual, focuses on the weekly loot distribution workflow
// Key differentiator: Makes loot distribution feel like part of the game experience

const MOCK_PLAYERS = [
  { id: 1, name: 'Udra', job: 'DRK', role: 'tank', avatar: '🛡️' },
  { id: 2, name: 'Tank2', job: 'GNB', role: 'tank', avatar: '⚔️' },
  { id: 3, name: 'Healer1', job: 'WHM', role: 'healer', avatar: '✨' },
  { id: 4, name: 'Healer2', job: 'SGE', role: 'healer', avatar: '💫' },
  { id: 5, name: 'DPS1', job: 'SAM', role: 'dps', avatar: '🗡️' },
  { id: 6, name: 'DPS2', job: 'NIN', role: 'dps', avatar: '🌀' },
  { id: 7, name: 'DPS3', job: 'BRD', role: 'dps', avatar: '🎯' },
  { id: 8, name: 'DPS4', job: 'PCT', role: 'dps', avatar: '🎨' },
];

const FLOOR_DROPS = {
  1: [
    { id: 'ear', name: 'Earring', icon: '💎', rarity: 'blue' },
    { id: 'neck', name: 'Necklace', icon: '📿', rarity: 'blue' },
    { id: 'wrist', name: 'Bracelet', icon: '⌚', rarity: 'blue' },
    { id: 'ring', name: 'Ring', icon: '💍', rarity: 'blue' },
  ],
  2: [
    { id: 'head', name: 'Head', icon: '🎭', rarity: 'purple' },
    { id: 'hands', name: 'Hands', icon: '🧤', rarity: 'purple' },
    { id: 'feet', name: 'Feet', icon: '👢', rarity: 'purple' },
    { id: 'glaze', name: 'Glaze', icon: '✨', rarity: 'gold' },
  ],
  3: [
    { id: 'body', name: 'Body', icon: '🎽', rarity: 'purple' },
    { id: 'legs', name: 'Legs', icon: '👖', rarity: 'purple' },
    { id: 'twine', name: 'Twine', icon: '🧵', rarity: 'gold' },
    { id: 'solvent', name: 'Solvent', icon: '🧪', rarity: 'gold' },
  ],
  4: [
    { id: 'weapon', name: 'Weapon Coffer', icon: '⚔️', rarity: 'orange' },
    { id: 'coffer', name: 'Gear Coffer', icon: '📦', rarity: 'orange' },
    { id: 'mount', name: 'Mount', icon: '🐉', rarity: 'orange' },
  ],
};

const rarityColors = {
  blue: { bg: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)', border: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
  purple: { bg: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)', border: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.4)' },
  gold: { bg: 'linear-gradient(135deg, #78350f 0%, #d97706 100%)', border: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)' },
  orange: { bg: 'linear-gradient(135deg, #9a3412 0%, #ea580c 100%)', border: '#f97316', glow: 'rgba(249, 115, 22, 0.4)' },
};

export default function LootDistributionPlanner() {
  const [currentWeek, setCurrentWeek] = useState(3);
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [assignedLoot, setAssignedLoot] = useState({});
  const [draggedItem, setDraggedItem] = useState(null);

  const handleDragStart = (item) => {
    setDraggedItem(item);
  };

  const handleDrop = (playerId) => {
    if (draggedItem) {
      setAssignedLoot(prev => ({
        ...prev,
        [`${selectedFloor}-${draggedItem.id}`]: playerId
      }));
      setDraggedItem(null);
    }
  };

  const LootItem = ({ item, assigned }) => {
    const colors = rarityColors[item.rarity];
    const assignedPlayer = assigned ? MOCK_PLAYERS.find(p => p.id === assigned) : null;
    
    return (
      <div
        draggable={!assigned}
        onDragStart={() => handleDragStart(item)}
        style={{
          background: colors.bg,
          border: `2px solid ${colors.border}`,
          borderRadius: '12px',
          padding: '16px',
          cursor: assigned ? 'default' : 'grab',
          opacity: assigned ? 0.6 : 1,
          position: 'relative',
          transition: 'all 0.2s ease',
          boxShadow: `0 4px 20px ${colors.glow}`,
        }}
        onMouseEnter={(e) => {
          if (!assigned) {
            e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
            e.currentTarget.style.boxShadow = `0 8px 30px ${colors.glow}`;
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.boxShadow = `0 4px 20px ${colors.glow}`;
        }}
      >
        <div style={{
          fontSize: '32px',
          marginBottom: '8px',
          textAlign: 'center',
        }}>{item.icon}</div>
        <div style={{
          fontSize: '13px',
          fontWeight: '600',
          color: '#fff',
          textAlign: 'center',
        }}>{item.name}</div>
        
        {assignedPlayer && (
          <div style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            background: '#10b981',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            {assignedPlayer.avatar} {assignedPlayer.name}
          </div>
        )}
      </div>
    );
  };

  const PlayerDropZone = ({ player }) => {
    const roleColor = player.role === 'tank' ? '#3b82f6' : player.role === 'healer' ? '#10b981' : '#ef4444';
    
    return (
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => handleDrop(player.id)}
        style={{
          background: draggedItem ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
          border: draggedItem ? '2px dashed #fff' : '2px solid transparent',
          borderRadius: '12px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.2s ease',
          cursor: draggedItem ? 'pointer' : 'default',
        }}
      >
        <div style={{
          width: '48px',
          height: '48px',
          background: `linear-gradient(135deg, ${roleColor}40 0%, ${roleColor}20 100%)`,
          border: `2px solid ${roleColor}`,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
        }}>{player.avatar}</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '13px',
            fontWeight: '600',
            color: '#fff',
          }}>{player.name}</div>
          <div style={{
            fontSize: '11px',
            color: roleColor,
            fontWeight: '500',
          }}>{player.job}</div>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at top, #1a1a2e 0%, #0f0f1a 50%, #0a0a10 100%)',
      color: '#fff',
      fontFamily: '"Rajdhani", "Orbitron", system-ui, sans-serif',
    }}>
      {/* Animated background particles effect simulation */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `
          radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.1) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.08) 0%, transparent 50%),
          radial-gradient(circle at 40% 40%, rgba(120, 219, 255, 0.05) 0%, transparent 50%)
        `,
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <header style={{
        padding: '20px 32px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(10, 10, 16, 0.8)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              background: 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              boxShadow: '0 4px 20px rgba(249, 115, 22, 0.4)',
            }}>⚔️</div>
            <div>
              <h1 style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: '700',
                letterSpacing: '2px',
                background: 'linear-gradient(90deg, #fff 0%, #f97316 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>ARCADION SAVAGE</h1>
              <div style={{
                fontSize: '12px',
                color: 'rgba(255,255,255,0.6)',
                letterSpacing: '3px',
              }}>HEAVYWEIGHT DIVISION</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Week Selector */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255,255,255,0.1)',
              padding: '8px 16px',
              borderRadius: '10px',
            }}>
              <button 
                onClick={() => setCurrentWeek(w => Math.max(1, w - 1))}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '18px',
                }}>◀</button>
              <span style={{
                fontSize: '14px',
                fontWeight: '600',
                minWidth: '80px',
                textAlign: 'center',
              }}>Week {currentWeek}</span>
              <button 
                onClick={() => setCurrentWeek(w => w + 1)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '18px',
                }}>▶</button>
            </div>

            <button style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
              letterSpacing: '1px',
              boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)',
            }}>
              🔗 SHARE PLAN
            </button>
          </div>
        </div>
      </header>

      <main style={{ padding: '32px', position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '32px' }}>
          {/* Main Loot Area */}
          <div>
            {/* Floor Tabs */}
            <div style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '24px',
            }}>
              {[1, 2, 3, 4].map((floor) => (
                <button
                  key={floor}
                  onClick={() => setSelectedFloor(floor)}
                  style={{
                    flex: 1,
                    padding: '16px',
                    background: selectedFloor === floor 
                      ? 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)'
                      : 'rgba(255,255,255,0.05)',
                    border: selectedFloor === floor 
                      ? '2px solid rgba(255,255,255,0.3)'
                      : '2px solid transparent',
                    borderRadius: '12px',
                    color: '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{
                    fontSize: '24px',
                    marginBottom: '4px',
                  }}>{floor === 1 ? '💎' : floor === 2 ? '🎭' : floor === 3 ? '🎽' : '⚔️'}</div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                  }}>M{floor}</div>
                  <div style={{
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.6)',
                  }}>{floor === 1 ? 'Accessories' : floor === 2 ? 'Left Side' : floor === 3 ? 'Body' : 'Weapons'}</div>
                </button>
              ))}
            </div>

            {/* Loot Items */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '20px',
              padding: '24px',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <h3 style={{
                margin: '0 0 16px 0',
                fontSize: '14px',
                color: 'rgba(255,255,255,0.6)',
                letterSpacing: '2px',
              }}>AVAILABLE DROPS</h3>
              <p style={{
                margin: '0 0 20px 0',
                fontSize: '12px',
                color: 'rgba(255,255,255,0.4)',
              }}>Drag items to assign to players</p>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '16px',
              }}>
                {FLOOR_DROPS[selectedFloor].map((item) => (
                  <LootItem 
                    key={item.id} 
                    item={item}
                    assigned={assignedLoot[`${selectedFloor}-${item.id}`]}
                  />
                ))}
              </div>
            </div>

            {/* Player Drop Zones */}
            <div style={{
              marginTop: '24px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '20px',
              padding: '24px',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <h3 style={{
                margin: '0 0 20px 0',
                fontSize: '14px',
                color: 'rgba(255,255,255,0.6)',
                letterSpacing: '2px',
              }}>ASSIGN TO PLAYER</h3>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)',
                gap: '12px',
              }}>
                {MOCK_PLAYERS.map((player) => (
                  <PlayerDropZone key={player.id} player={player} />
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '20px',
            padding: '24px',
            border: '1px solid rgba(255,255,255,0.1)',
            height: 'fit-content',
          }}>
            <h3 style={{
              margin: '0 0 20px 0',
              fontSize: '14px',
              color: 'rgba(255,255,255,0.6)',
              letterSpacing: '2px',
            }}>WEEK {currentWeek} SUMMARY</h3>
            
            {/* Loot Log */}
            <div style={{ marginBottom: '24px' }}>
              {Object.entries(assignedLoot).length === 0 ? (
                <p style={{
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.4)',
                  textAlign: 'center',
                  padding: '20px',
                }}>No loot assigned yet</p>
              ) : (
                Object.entries(assignedLoot).map(([key, playerId]) => {
                  const [floor, itemId] = key.split('-');
                  const item = FLOOR_DROPS[floor].find(i => i.id === itemId);
                  const player = MOCK_PLAYERS.find(p => p.id === playerId);
                  return (
                    <div key={key} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '10px',
                      marginBottom: '8px',
                    }}>
                      <span style={{ fontSize: '20px' }}>{item?.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: '500' }}>{item?.name}</div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>M{floor}</div>
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#10b981',
                        fontWeight: '500',
                      }}>{player?.name}</div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Priority Queue */}
            <h4 style={{
              margin: '0 0 12px 0',
              fontSize: '12px',
              color: 'rgba(255,255,255,0.6)',
              letterSpacing: '1px',
            }}>PRIORITY QUEUE</h4>
            
            {[
              { player: 'DPS2', item: 'Weapon', reason: 'Lowest iLvl' },
              { player: 'Healer2', item: 'Body', reason: 'BiS needed' },
              { player: 'Tank2', item: 'Head', reason: 'Next in line' },
            ].map((entry, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px',
                background: i === 0 ? 'rgba(249, 115, 22, 0.2)' : 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
                marginBottom: '6px',
                border: i === 0 ? '1px solid rgba(249, 115, 22, 0.3)' : '1px solid transparent',
              }}>
                <span style={{
                  width: '24px',
                  height: '24px',
                  background: i === 0 ? '#f97316' : 'rgba(255,255,255,0.1)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: '600',
                }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: '500' }}>{entry.player} → {entry.item}</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>{entry.reason}</div>
                </div>
              </div>
            ))}

            <button style={{
              width: '100%',
              marginTop: '20px',
              padding: '14px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
              letterSpacing: '1px',
            }}>
              ✓ SAVE WEEK {currentWeek}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
