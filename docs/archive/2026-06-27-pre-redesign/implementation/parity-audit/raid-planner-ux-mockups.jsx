import React, { useState } from 'react';

// Color scheme matching existing app
const colors = {
  bg: '#0d1117',
  bgCard: '#161b22',
  bgHover: '#1f2937',
  border: '#30363d',
  text: '#e6edf3',
  textMuted: '#8b949e',
  accent: '#2dd4bf',
  accentDim: '#14b8a6',
  raid: '#f97316',
  tome: '#3b82f6',
  tomeUp: '#8b5cf6',
  catchup: '#22c55e',
  crafted: '#eab308',
  relic: '#f472b6',
  trash: '#6b7280',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
};

// Gear category configuration
const GEAR_CATEGORIES = {
  savage: { label: 'Savage', color: '#8b5cf6', ilv: 790 },
  tome_up: { label: 'Tome ↑', color: '#3b82f6', ilv: 790 },
  catchup: { label: 'Catchup', color: '#22c55e', ilv: 780 },
  tome: { label: 'Tome', color: '#60a5fa', ilv: 780 },
  relic: { label: 'Relic', color: '#f472b6', ilv: 770 },
  crafted: { label: 'Crafted', color: '#eab308', ilv: 770 },
  prep: { label: 'Prep', color: '#a3e635', ilv: 770 },
  trash: { label: 'Trash', color: '#6b7280', ilv: 760 },
  wow: { label: 'Wow', color: '#ef4444', ilv: 740 },
};

const MARKERS = {
  craft: { icon: '🔨', label: 'Plan to craft' },
  pages: { icon: '📃', label: 'Buying with pages' },
  floor4pages: { icon: '♻️', label: 'Using F4 pages' },
  alliance: { icon: '💰', label: 'From alliance raid' },
  next: { icon: '◀️', label: 'Improve next' },
  have_token: { icon: '💾', label: 'Already have token' },
};

// ==========================================
// MOCKUP 1: Enhanced Player Card with Current Gear Source
// ==========================================
const EnhancedPlayerCard = () => {
  const [slots, setSlots] = useState([
    { name: 'Weapon', bisSource: 'raid', currentSource: 'crafted', hasItem: false, markers: [], ilv: 770 },
    { name: 'Head', bisSource: 'tome', currentSource: 'tome', hasItem: true, isAugmented: false, markers: ['next'], ilv: 780 },
    { name: 'Body', bisSource: 'raid', currentSource: 'catchup', hasItem: true, markers: [], ilv: 780 },
    { name: 'Hands', bisSource: 'tome', currentSource: 'tome_up', hasItem: true, isAugmented: true, markers: [], ilv: 790 },
    { name: 'Legs', bisSource: 'raid', currentSource: 'trash', hasItem: true, markers: ['craft'], ilv: 760 },
    { name: 'Feet', bisSource: 'tome', currentSource: 'crafted', hasItem: false, markers: ['pages'], ilv: 770 },
    { name: 'Ears', bisSource: 'raid', currentSource: 'savage', hasItem: true, markers: [], ilv: 790 },
    { name: 'Neck', bisSource: 'tome', currentSource: 'relic', hasItem: true, markers: [], ilv: 770 },
    { name: 'Wrists', bisSource: 'raid', currentSource: 'trash', hasItem: false, markers: [], ilv: 760 },
    { name: 'R. Ring', bisSource: 'raid', currentSource: 'catchup', hasItem: true, markers: [], ilv: 780 },
    { name: 'L. Ring', bisSource: 'tome', currentSource: 'tome', hasItem: true, isAugmented: false, markers: ['next'], ilv: 780 },
  ]);
  
  const [showMarkerPicker, setShowMarkerPicker] = useState(null);
  
  const avgIlv = Math.round(slots.reduce((sum, s) => sum + s.ilv, 0) / slots.length);
  const completedSlots = slots.filter(s => {
    if (s.bisSource === 'raid') return s.currentSource === 'savage';
    if (s.bisSource === 'tome') return s.currentSource === 'tome_up';
    return false;
  }).length;
  
  const toggleMarker = (slotIdx, marker) => {
    setSlots(prev => prev.map((s, i) => {
      if (i !== slotIdx) return s;
      const markers = s.markers.includes(marker)
        ? s.markers.filter(m => m !== marker)
        : [...s.markers, marker];
      return { ...s, markers };
    }));
  };
  
  return (
    <div style={{
      background: colors.bgCard,
      borderRadius: 12,
      border: `1px solid ${colors.border}`,
      padding: 16,
      width: 380,
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 8,
            background: `linear-gradient(135deg, ${colors.accent}40, ${colors.accent}10)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20
          }}>⚔️</div>
          <div>
            <div style={{ color: colors.text, fontWeight: 600, fontSize: 16 }}>MrDark</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <span style={{
                background: colors.accent,
                color: colors.bg,
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600
              }}>M1</span>
              <span style={{
                background: `${colors.accent}30`,
                color: colors.accent,
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 11,
              }}>DRG</span>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: colors.text, fontWeight: 700, fontSize: 18 }}>
            {completedSlots}<span style={{ color: colors.textMuted }}>/11</span>
          </div>
          <div style={{
            color: colors.accent,
            fontSize: 12,
            fontWeight: 500,
            marginTop: 2
          }}>
            iLv {avgIlv}
          </div>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div style={{
        height: 6,
        background: colors.bg,
        borderRadius: 3,
        marginBottom: 16,
        overflow: 'hidden'
      }}>
        <div style={{
          height: '100%',
          width: `${(completedSlots / 11) * 100}%`,
          background: `linear-gradient(90deg, ${colors.accent}, ${colors.accentDim})`,
          borderRadius: 3,
          transition: 'width 0.3s ease'
        }} />
      </div>
      
      {/* Gear Table */}
      <div style={{ fontSize: 13 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '85px 90px 70px 50px 40px 40px',
          gap: 4,
          padding: '8px 0',
          borderBottom: `1px solid ${colors.border}`,
          color: colors.textMuted,
          fontSize: 11,
          fontWeight: 500
        }}>
          <span>Slot</span>
          <span>Current</span>
          <span>BiS</span>
          <span style={{ textAlign: 'center' }}>iLv</span>
          <span style={{ textAlign: 'center' }}>✓</span>
          <span style={{ textAlign: 'center' }}>⚑</span>
        </div>
        
        {slots.map((slot, idx) => {
          const currentCat = GEAR_CATEGORIES[slot.currentSource];
          const isBis = slot.currentSource === 'savage' || slot.currentSource === 'tome_up';
          
          return (
            <div
              key={slot.name}
              style={{
                display: 'grid',
                gridTemplateColumns: '85px 90px 70px 50px 40px 40px',
                gap: 4,
                padding: '8px 0',
                borderBottom: `1px solid ${colors.border}20`,
                alignItems: 'center',
              }}
            >
              <span style={{ color: colors.text }}>{slot.name}</span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <span style={{
                  background: `${currentCat.color}20`,
                  color: currentCat.color,
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 500,
                  border: `1px solid ${currentCat.color}40`
                }}>
                  {currentCat.label}
                </span>
              </span>
              <span style={{
                background: slot.bisSource === 'raid' ? `${colors.raid}20` : `${colors.tome}20`,
                color: slot.bisSource === 'raid' ? colors.raid : colors.tome,
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 500
              }}>
                {slot.bisSource === 'raid' ? 'Raid' : 'Tome'}
              </span>
              <span style={{
                textAlign: 'center',
                color: isBis ? colors.success : colors.textMuted,
                fontWeight: isBis ? 600 : 400,
                fontSize: 12
              }}>
                {slot.ilv}
              </span>
              <span style={{ textAlign: 'center' }}>
                {isBis && (
                  <span style={{ color: colors.success, fontSize: 14 }}>✓</span>
                )}
              </span>
              <span 
                style={{ 
                  textAlign: 'center', 
                  cursor: 'pointer',
                  position: 'relative'
                }}
                onClick={() => setShowMarkerPicker(showMarkerPicker === idx ? null : idx)}
              >
                {slot.markers.length > 0 ? (
                  <span style={{ fontSize: 14 }}>
                    {slot.markers.map(m => MARKERS[m].icon).join('')}
                  </span>
                ) : (
                  <span style={{ color: colors.textMuted, fontSize: 12 }}>+</span>
                )}
                
                {/* Marker Picker Popup */}
                {showMarkerPicker === idx && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    padding: 8,
                    zIndex: 100,
                    minWidth: 180,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                  }}>
                    {Object.entries(MARKERS).map(([key, { icon, label }]) => (
                      <div
                        key={key}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMarker(idx, key);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 8px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          background: slot.markers.includes(key) ? `${colors.accent}20` : 'transparent',
                          color: slot.markers.includes(key) ? colors.accent : colors.text,
                        }}
                      >
                        <span style={{ fontSize: 16 }}>{icon}</span>
                        <span style={{ fontSize: 12 }}>{label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </span>
            </div>
          );
        })}
      </div>
      
      {/* Legend */}
      <div style={{
        marginTop: 16,
        padding: 12,
        background: colors.bg,
        borderRadius: 8,
        fontSize: 11
      }}>
        <div style={{ color: colors.textMuted, marginBottom: 8, fontWeight: 500 }}>Gear Categories</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Object.entries(GEAR_CATEGORIES).map(([key, { label, color, ilv }]) => (
            <span
              key={key}
              style={{
                background: `${color}20`,
                color: color,
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 10,
              }}
            >
              {label} ({ilv})
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// MOCKUP 2: Loot Adjustments Panel
// ==========================================
const LootAdjustmentsPanel = () => {
  const [players, setPlayers] = useState([
    { name: 'MrDark', job: 'DRG', lootAdjust: 0, weaponAdjust: 0, pageAdjust: { I: 0, II: 0, III: 0, IV: 0 }, joinedWeek: 1 },
    { name: 'Leylie', job: 'WHM', lootAdjust: 3, weaponAdjust: 1, pageAdjust: { I: 6, II: 6, III: 0, IV: 0 }, joinedWeek: 4 },
    { name: 'Goony', job: 'WAR', lootAdjust: 0, weaponAdjust: 0, pageAdjust: { I: 0, II: 0, III: 0, IV: 0 }, joinedWeek: 1 },
  ]);
  
  const [expandedPlayer, setExpandedPlayer] = useState(1);
  
  return (
    <div style={{
      background: colors.bgCard,
      borderRadius: 12,
      border: `1px solid ${colors.border}`,
      padding: 20,
      width: 500,
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: 16 
      }}>
        <div>
          <h3 style={{ color: colors.text, margin: 0, fontSize: 16, fontWeight: 600 }}>
            Player Adjustments
          </h3>
          <p style={{ color: colors.textMuted, margin: '4px 0 0', fontSize: 12 }}>
            Adjust loot counts and pages for mid-tier joins
          </p>
        </div>
        <div style={{
          background: `${colors.warning}20`,
          color: colors.warning,
          padding: '4px 10px',
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 500
        }}>
          1 player adjusted
        </div>
      </div>
      
      {players.map((player, idx) => {
        const isExpanded = expandedPlayer === idx;
        const hasAdjustments = player.lootAdjust !== 0 || 
          player.weaponAdjust !== 0 || 
          Object.values(player.pageAdjust).some(v => v !== 0);
        
        return (
          <div
            key={player.name}
            style={{
              background: colors.bg,
              borderRadius: 8,
              marginBottom: 8,
              border: `1px solid ${hasAdjustments ? colors.warning + '40' : colors.border}`,
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                cursor: 'pointer',
              }}
              onClick={() => setExpandedPlayer(isExpanded ? null : idx)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>⚔️</span>
                <div>
                  <div style={{ color: colors.text, fontWeight: 500 }}>{player.name}</div>
                  <div style={{ color: colors.textMuted, fontSize: 11 }}>
                    {player.job} • Joined Week {player.joinedWeek}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {hasAdjustments && (
                  <span style={{
                    background: `${colors.warning}20`,
                    color: colors.warning,
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                  }}>
                    Adjusted
                  </span>
                )}
                <span style={{ 
                  color: colors.textMuted,
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s'
                }}>▼</span>
              </div>
            </div>
            
            {isExpanded && (
              <div style={{
                padding: '0 12px 16px',
                borderTop: `1px solid ${colors.border}`,
                marginTop: 0,
                paddingTop: 16
              }}>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: 12,
                  marginBottom: 16 
                }}>
                  <div>
                    <label style={{ color: colors.textMuted, fontSize: 11, display: 'block', marginBottom: 6 }}>
                      Loot Count Adjustment
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="number"
                        value={player.lootAdjust}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setPlayers(prev => prev.map((p, i) => 
                            i === idx ? { ...p, lootAdjust: val } : p
                          ));
                        }}
                        style={{
                          background: colors.bgCard,
                          border: `1px solid ${colors.border}`,
                          borderRadius: 6,
                          padding: '8px 12px',
                          color: colors.text,
                          width: 80,
                          fontSize: 14
                        }}
                      />
                      <span style={{ color: colors.textMuted, fontSize: 12 }}>
                        {player.lootAdjust >= 0 ? '+' : ''}{player.lootAdjust} drops
                      </span>
                    </div>
                  </div>
                  <div>
                    <label style={{ color: colors.textMuted, fontSize: 11, display: 'block', marginBottom: 6 }}>
                      Weapon Adjustment
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="number"
                        value={player.weaponAdjust}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setPlayers(prev => prev.map((p, i) => 
                            i === idx ? { ...p, weaponAdjust: val } : p
                          ));
                        }}
                        style={{
                          background: colors.bgCard,
                          border: `1px solid ${colors.border}`,
                          borderRadius: 6,
                          padding: '8px 12px',
                          color: colors.text,
                          width: 80,
                          fontSize: 14
                        }}
                      />
                      <span style={{ color: colors.textMuted, fontSize: 12 }}>
                        {player.weaponAdjust >= 0 ? '+' : ''}{player.weaponAdjust}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label style={{ color: colors.textMuted, fontSize: 11, display: 'block', marginBottom: 8 }}>
                    Page Adjustments (for players who joined mid-tier)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {['I', 'II', 'III', 'IV'].map((floor) => (
                      <div key={floor}>
                        <div style={{ 
                          color: colors.textMuted, 
                          fontSize: 10, 
                          marginBottom: 4,
                          textAlign: 'center'
                        }}>
                          Floor {floor}
                        </div>
                        <input
                          type="number"
                          value={player.pageAdjust[floor]}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setPlayers(prev => prev.map((p, i) => 
                              i === idx ? { ...p, pageAdjust: { ...p.pageAdjust, [floor]: val } } : p
                            ));
                          }}
                          style={{
                            background: colors.bgCard,
                            border: `1px solid ${colors.border}`,
                            borderRadius: 6,
                            padding: '6px 8px',
                            color: colors.text,
                            width: '100%',
                            fontSize: 13,
                            textAlign: 'center'
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                
                <div style={{
                  marginTop: 12,
                  padding: 10,
                  background: `${colors.accent}10`,
                  borderRadius: 6,
                  fontSize: 11,
                  color: colors.textMuted
                }}>
                  💡 <strong style={{ color: colors.accent }}>Tip:</strong> Use positive values to simulate loot/pages the player 
                  would have earned if they started from Week 1.
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ==========================================
// MOCKUP 3: Priority Mode & Loot Weight Settings
// ==========================================
const PrioritySettings = () => {
  const [priorityMode, setPriorityMode] = useState('role');
  const [lootWeights, setLootWeights] = useState({
    gear: true,
    weapons: true,
    mounts: false,
    music: false,
    coffers: true
  });
  
  return (
    <div style={{
      background: colors.bgCard,
      borderRadius: 12,
      border: `1px solid ${colors.border}`,
      padding: 20,
      width: 420,
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <h3 style={{ color: colors.text, margin: '0 0 20px', fontSize: 16, fontWeight: 600 }}>
        Priority Settings
      </h3>
      
      {/* Priority Mode Toggle */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ 
          color: colors.text, 
          fontSize: 13, 
          fontWeight: 500,
          display: 'block',
          marginBottom: 10
        }}>
          Priority Mode
        </label>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          background: colors.bg,
          padding: 4,
          borderRadius: 8
        }}>
          <button
            onClick={() => setPriorityMode('role')}
            style={{
              background: priorityMode === 'role' ? colors.accent : 'transparent',
              color: priorityMode === 'role' ? colors.bg : colors.textMuted,
              border: 'none',
              borderRadius: 6,
              padding: '10px 16px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 13,
              transition: 'all 0.2s'
            }}
          >
            Role-Based
          </button>
          <button
            onClick={() => setPriorityMode('lootCount')}
            style={{
              background: priorityMode === 'lootCount' ? colors.accent : 'transparent',
              color: priorityMode === 'lootCount' ? colors.bg : colors.textMuted,
              border: 'none',
              borderRadius: 6,
              padding: '10px 16px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 13,
              transition: 'all 0.2s'
            }}
          >
            Loot Count First
          </button>
        </div>
        <p style={{ color: colors.textMuted, fontSize: 11, margin: '8px 0 0' }}>
          {priorityMode === 'role' 
            ? 'Priority based on role order + slot weights + fairness modifiers'
            : 'Lowest loot count always wins, with pages as tie-breaker'}
        </p>
      </div>
      
      {/* Priority Order (visible in role mode) */}
      {priorityMode === 'role' && (
        <div style={{ marginBottom: 24 }}>
          <label style={{ 
            color: colors.text, 
            fontSize: 13, 
            fontWeight: 500,
            display: 'block',
            marginBottom: 10
          }}>
            Role Priority Order
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {['Melee DPS', 'Ranged DPS', 'Caster DPS', 'Tank', 'Healer'].map((role, idx) => (
              <div
                key={role}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  background: colors.bg,
                  borderRadius: 6,
                  cursor: 'grab'
                }}
              >
                <span style={{ color: colors.textMuted, fontSize: 12, width: 20 }}>
                  {idx + 1}.
                </span>
                <span style={{ 
                  color: colors.text, 
                  fontSize: 13,
                  flex: 1
                }}>
                  {role}
                </span>
                <span style={{ color: colors.textMuted, fontSize: 16 }}>⋮⋮</span>
              </div>
            ))}
          </div>
          <p style={{ color: colors.textMuted, fontSize: 11, margin: '8px 0 0' }}>
            Drag to reorder. Higher roles get priority for contested drops.
          </p>
        </div>
      )}
      
      {/* Loot Weights */}
      <div>
        <label style={{ 
          color: colors.text, 
          fontSize: 13, 
          fontWeight: 500,
          display: 'block',
          marginBottom: 10
        }}>
          Include in Loot Count
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.entries(lootWeights).map(([key, enabled]) => (
            <label
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                background: colors.bg,
                borderRadius: 6,
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>
                  {key === 'gear' && '👕'}
                  {key === 'weapons' && '⚔️'}
                  {key === 'mounts' && '🐴'}
                  {key === 'music' && '🎵'}
                  {key === 'coffers' && '📦'}
                </span>
                <span style={{ color: colors.text, fontSize: 13, textTransform: 'capitalize' }}>
                  {key}
                </span>
              </div>
              <div
                onClick={() => setLootWeights(prev => ({ ...prev, [key]: !prev[key] }))}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  background: enabled ? colors.accent : colors.border,
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: 2,
                  left: enabled ? 22 : 2,
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  background: colors.text,
                  transition: 'left 0.2s'
                }} />
              </div>
            </label>
          ))}
        </div>
        <p style={{ color: colors.textMuted, fontSize: 11, margin: '8px 0 0' }}>
          Disabled items won't count toward a player's total loot received.
        </p>
      </div>
    </div>
  );
};

// ==========================================
// MOCKUP 4: Enhanced Summary with iLv + Progress
// ==========================================
const EnhancedSummary = () => {
  const players = [
    { name: 'MrDark', job: 'DRG', pos: 'M1', gear: 45, avgIlv: 778, drops: 3, lootRank: 2 },
    { name: 'Leylie', job: 'WHM', pos: 'H1', gear: 27, avgIlv: 772, drops: 5, lootRank: 8 },
    { name: 'Goony', job: 'WAR', pos: 'T1', gear: 36, avgIlv: 775, drops: 4, lootRank: 5 },
    { name: 'Scholy', job: 'SCH', pos: 'H2', gear: 18, avgIlv: 768, drops: 2, lootRank: 1 },
    { name: 'Dancy', job: 'DNC', pos: 'R1', gear: 55, avgIlv: 781, drops: 6, lootRank: 7 },
    { name: 'Pally', job: 'PLD', pos: 'T2', gear: 63, avgIlv: 784, drops: 4, lootRank: 4 },
    { name: 'Whitey', job: 'AST', pos: 'H2', gear: 9, avgIlv: 765, drops: 3, lootRank: 3 },
    { name: 'Punchy', job: 'MNK', pos: 'M2', gear: 72, avgIlv: 786, drops: 5, lootRank: 6 },
  ];
  
  const avgTeamIlv = Math.round(players.reduce((s, p) => s + p.avgIlv, 0) / players.length);
  const avgTeamGear = Math.round(players.reduce((s, p) => s + p.gear, 0) / players.length);
  
  return (
    <div style={{
      background: colors.bgCard,
      borderRadius: 12,
      border: `1px solid ${colors.border}`,
      padding: 20,
      width: 700,
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: 20 
      }}>
        <h3 style={{ color: colors.text, margin: 0, fontSize: 16, fontWeight: 600 }}>
          Team Overview
        </h3>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: colors.textMuted, fontSize: 11 }}>Team Avg iLv</div>
            <div style={{ color: colors.accent, fontSize: 18, fontWeight: 700 }}>{avgTeamIlv}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: colors.textMuted, fontSize: 11 }}>Team Avg Gear</div>
            <div style={{ color: colors.accent, fontSize: 18, fontWeight: 700 }}>{avgTeamGear}%</div>
          </div>
        </div>
      </div>
      
      {/* Header Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '160px 1fr 70px 70px 80px',
        gap: 12,
        padding: '10px 12px',
        background: colors.bg,
        borderRadius: '8px 8px 0 0',
        fontSize: 11,
        fontWeight: 600,
        color: colors.textMuted
      }}>
        <span>Player</span>
        <span>BiS Progress</span>
        <span style={{ textAlign: 'center' }}>Avg iLv</span>
        <span style={{ textAlign: 'center' }}>Drops</span>
        <span style={{ textAlign: 'center' }}>Loot Rank</span>
      </div>
      
      {/* Player Rows */}
      {players.map((player, idx) => {
        const isLowLoot = player.lootRank <= 2;
        const isHighLoot = player.lootRank >= 7;
        
        return (
          <div
            key={player.name}
            style={{
              display: 'grid',
              gridTemplateColumns: '160px 1fr 70px 70px 80px',
              gap: 12,
              padding: '12px',
              background: idx % 2 === 0 ? 'transparent' : `${colors.bg}50`,
              alignItems: 'center',
              borderBottom: `1px solid ${colors.border}20`
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>⚔️</span>
              <div>
                <div style={{ color: colors.text, fontWeight: 500, fontSize: 13 }}>
                  {player.name}
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                  <span style={{
                    background: `${colors.accent}30`,
                    color: colors.accent,
                    padding: '1px 5px',
                    borderRadius: 3,
                    fontSize: 10,
                  }}>{player.pos}</span>
                  <span style={{
                    color: colors.textMuted,
                    fontSize: 10,
                  }}>{player.job}</span>
                </div>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  flex: 1,
                  height: 8,
                  background: colors.bg,
                  borderRadius: 4,
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${player.gear}%`,
                    background: player.gear >= 50 
                      ? `linear-gradient(90deg, ${colors.success}, ${colors.accent})`
                      : player.gear >= 25
                        ? `linear-gradient(90deg, ${colors.warning}, ${colors.success})`
                        : colors.danger,
                    borderRadius: 4,
                    transition: 'width 0.5s ease'
                  }} />
                </div>
                <span style={{ 
                  color: colors.text, 
                  fontSize: 12, 
                  fontWeight: 600,
                  minWidth: 35,
                  textAlign: 'right'
                }}>
                  {player.gear}%
                </span>
              </div>
            </div>
            
            <div style={{ 
              textAlign: 'center',
              color: player.avgIlv >= 780 ? colors.success : colors.text,
              fontWeight: player.avgIlv >= 780 ? 600 : 400,
              fontSize: 13
            }}>
              {player.avgIlv}
            </div>
            
            <div style={{ 
              textAlign: 'center',
              color: colors.text,
              fontSize: 13
            }}>
              {player.drops}
            </div>
            
            <div style={{ 
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}>
              <span style={{
                background: isLowLoot ? `${colors.success}20` : isHighLoot ? `${colors.warning}20` : `${colors.bg}`,
                color: isLowLoot ? colors.success : isHighLoot ? colors.warning : colors.textMuted,
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 500
              }}>
                #{player.lootRank}
              </span>
              {isLowLoot && <span style={{ color: colors.success, fontSize: 10 }}>↑ Priority</span>}
              {isHighLoot && <span style={{ color: colors.warning, fontSize: 10 }}>↓ Priority</span>}
            </div>
          </div>
        );
      })}
      
      {/* Legend */}
      <div style={{
        marginTop: 16,
        padding: 12,
        background: colors.bg,
        borderRadius: 8,
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 11
      }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ color: colors.textMuted }}>
            <span style={{ 
              display: 'inline-block', 
              width: 12, 
              height: 12, 
              borderRadius: 2, 
              background: colors.success,
              marginRight: 4,
              verticalAlign: 'middle'
            }} />
            High Progress (50%+)
          </span>
          <span style={{ color: colors.textMuted }}>
            <span style={{ 
              display: 'inline-block', 
              width: 12, 
              height: 12, 
              borderRadius: 2, 
              background: colors.warning,
              marginRight: 4,
              verticalAlign: 'middle'
            }} />
            Medium (25-49%)
          </span>
          <span style={{ color: colors.textMuted }}>
            <span style={{ 
              display: 'inline-block', 
              width: 12, 
              height: 12, 
              borderRadius: 2, 
              background: colors.danger,
              marginRight: 4,
              verticalAlign: 'middle'
            }} />
            Low (&lt;25%)
          </span>
        </div>
        <span style={{ color: colors.textMuted }}>
          Loot Rank affects priority scoring
        </span>
      </div>
    </div>
  );
};

// ==========================================
// MOCKUP 5: Alt Job Tracking Panel
// ==========================================
const AltJobPanel = () => {
  const [mainJob, setMainJob] = useState({
    name: 'DRG',
    icon: '🐉',
    gear: 45,
    pagesI: 8, pagesII: 12, pagesIII: 6, pagesIV: 4
  });
  
  const [altJobs, setAltJobs] = useState([
    { name: 'NIN', icon: '🗡️', gear: 18, priority: 'bis' },
    { name: 'RPR', icon: '🌙', gear: 0, priority: 'padding' },
  ]);
  
  const [showAddAlt, setShowAddAlt] = useState(false);
  
  // Shared page pool
  const totalPagesNeeded = mainJob.pagesI + mainJob.pagesII + mainJob.pagesIII + mainJob.pagesIV +
    altJobs.reduce((sum, alt) => sum + (alt.priority === 'bis' ? 8 : 4), 0);
  
  return (
    <div style={{
      background: colors.bgCard,
      borderRadius: 12,
      border: `1px solid ${colors.border}`,
      padding: 20,
      width: 380,
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: 16 
      }}>
        <h3 style={{ color: colors.text, margin: 0, fontSize: 16, fontWeight: 600 }}>
          Jobs & Alt Tracking
        </h3>
        <span style={{
          background: `${colors.accent}20`,
          color: colors.accent,
          padding: '4px 10px',
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 500
        }}>
          {altJobs.length} alt{altJobs.length !== 1 ? 's' : ''}
        </span>
      </div>
      
      {/* Main Job */}
      <div style={{
        background: `linear-gradient(135deg, ${colors.accent}15, ${colors.accent}05)`,
        border: `1px solid ${colors.accent}30`,
        borderRadius: 8,
        padding: 14,
        marginBottom: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>{mainJob.icon}</span>
            <div>
              <div style={{ color: colors.text, fontWeight: 600, fontSize: 14 }}>{mainJob.name}</div>
              <div style={{ color: colors.accent, fontSize: 11 }}>Main Job</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: colors.text, fontWeight: 600 }}>{mainJob.gear}%</div>
            <div style={{ color: colors.textMuted, fontSize: 11 }}>BiS Progress</div>
          </div>
        </div>
        
        {/* Page Summary */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
          paddingTop: 12,
          borderTop: `1px solid ${colors.accent}20`
        }}>
          {['I', 'II', 'III', 'IV'].map((floor, idx) => (
            <div key={floor} style={{ textAlign: 'center' }}>
              <div style={{ color: colors.textMuted, fontSize: 10, marginBottom: 4 }}>F{floor}</div>
              <div style={{ color: colors.text, fontWeight: 600, fontSize: 13 }}>
                {[mainJob.pagesI, mainJob.pagesII, mainJob.pagesIII, mainJob.pagesIV][idx]}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Alt Jobs */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ 
          color: colors.textMuted, 
          fontSize: 11, 
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>Alt Jobs (shared page pool)</span>
        </div>
        
        {altJobs.map((alt, idx) => (
          <div
            key={alt.name}
            style={{
              background: colors.bg,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              padding: 12,
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>{alt.icon}</span>
              <div>
                <div style={{ color: colors.text, fontWeight: 500, fontSize: 13 }}>{alt.name}</div>
                <div style={{ 
                  color: alt.priority === 'bis' ? colors.tomeUp : colors.catchup, 
                  fontSize: 10,
                  textTransform: 'uppercase',
                  fontWeight: 500
                }}>
                  {alt.priority === 'bis' ? 'BiS Priority' : 'iLv Padding'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: colors.text, fontWeight: 500, fontSize: 12 }}>{alt.gear}%</div>
              </div>
              <button
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: colors.textMuted,
                  cursor: 'pointer',
                  padding: 4,
                  fontSize: 16
                }}
              >
                ⋮
              </button>
            </div>
          </div>
        ))}
        
        <button
          onClick={() => setShowAddAlt(true)}
          style={{
            width: '100%',
            background: 'transparent',
            border: `1px dashed ${colors.border}`,
            borderRadius: 8,
            padding: 12,
            color: colors.textMuted,
            cursor: 'pointer',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6
          }}
        >
          <span style={{ fontSize: 16 }}>+</span>
          Add Alt Job
        </button>
      </div>
      
      {/* Shared Pool Summary */}
      <div style={{
        background: colors.bg,
        borderRadius: 8,
        padding: 12,
        marginTop: 16
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: 8
        }}>
          <span style={{ color: colors.textMuted, fontSize: 11 }}>Shared Page Pool</span>
          <span style={{ color: colors.warning, fontSize: 11 }}>
            {totalPagesNeeded} pages needed across all jobs
          </span>
        </div>
        <div style={{ 
          color: colors.textMuted, 
          fontSize: 10,
          lineHeight: 1.5
        }}>
          💡 Pages are shared between main and alt jobs. Loot for alts appears in the "Alt Priority" tier during coffer distribution.
        </div>
      </div>
    </div>
  );
};

// ==========================================
// MOCKUP 6: Coffer Priority Interface
// ==========================================
const CofferPriority = () => {
  const [cofferType, setCofferType] = useState('body');
  
  const priorities = {
    bis: [
      { name: 'MrDark', job: 'DRG', score: 280, reason: 'BiS slot, lowest loot' },
      { name: 'Goony', job: 'WAR', score: 255, reason: 'BiS slot' },
    ],
    padding: [
      { name: 'Scholy', job: 'SCH', score: 180, reason: 'iLv upgrade (+10)' },
      { name: 'Leylie', job: 'WHM', score: 165, reason: 'iLv upgrade (+20)' },
    ],
    alts: [
      { name: 'Dancy', job: 'DNC', altJob: 'BRD', score: 90, reason: 'Alt job BiS' },
    ],
    free: [
      { name: 'Pally', job: 'PLD', score: 0, reason: 'Has BiS, any slot use' },
    ]
  };
  
  return (
    <div style={{
      background: colors.bgCard,
      borderRadius: 12,
      border: `1px solid ${colors.border}`,
      padding: 20,
      width: 400,
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: 16 
      }}>
        <div>
          <h3 style={{ color: colors.text, margin: 0, fontSize: 16, fontWeight: 600 }}>
            Coffer Priority
          </h3>
          <p style={{ color: colors.textMuted, margin: '4px 0 0', fontSize: 12 }}>
            Body Coffer dropped from M12S
          </p>
        </div>
        <select
          value={cofferType}
          onChange={(e) => setCofferType(e.target.value)}
          style={{
            background: colors.bg,
            border: `1px solid ${colors.border}`,
            borderRadius: 6,
            padding: '6px 10px',
            color: colors.text,
            fontSize: 12
          }}
        >
          <option value="body">Body Coffer</option>
          <option value="head">Head Coffer</option>
          <option value="hands">Hands Coffer</option>
          <option value="legs">Legs Coffer</option>
          <option value="feet">Feet Coffer</option>
        </select>
      </div>
      
      {/* Priority Tiers */}
      {[
        { key: 'bis', label: 'BiS Priority', color: colors.tomeUp, desc: 'Slot is in their Best-in-Slot' },
        { key: 'padding', label: 'iLv Padding', color: colors.catchup, desc: 'Would improve item level' },
        { key: 'alts', label: 'Alt Jobs', color: colors.warning, desc: 'For alternate job gear' },
        { key: 'free', label: 'Free Roll', color: colors.textMuted, desc: 'Anyone who wants it' },
      ].map(tier => (
        <div key={tier.key} style={{ marginBottom: 16 }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8,
            marginBottom: 8
          }}>
            <div style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: tier.color
            }} />
            <span style={{ color: colors.text, fontSize: 13, fontWeight: 600 }}>
              {tier.label}
            </span>
            <span style={{ color: colors.textMuted, fontSize: 11 }}>
              — {tier.desc}
            </span>
          </div>
          
          {priorities[tier.key].length > 0 ? (
            <div style={{ marginLeft: 20 }}>
              {priorities[tier.key].map((player, idx) => (
                <div
                  key={player.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: idx === 0 && tier.key === 'bis' ? `${tier.color}15` : colors.bg,
                    border: idx === 0 && tier.key === 'bis' ? `1px solid ${tier.color}40` : `1px solid ${colors.border}`,
                    borderRadius: 6,
                    marginBottom: 6
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ 
                      color: idx === 0 && tier.key === 'bis' ? tier.color : colors.textMuted, 
                      fontSize: 12, 
                      fontWeight: 600,
                      minWidth: 20
                    }}>
                      {idx + 1}.
                    </span>
                    <span style={{ fontSize: 14 }}>⚔️</span>
                    <div>
                      <div style={{ color: colors.text, fontSize: 13, fontWeight: 500 }}>
                        {player.name}
                        {player.altJob && (
                          <span style={{ color: colors.textMuted, fontSize: 11, marginLeft: 4 }}>
                            ({player.altJob})
                          </span>
                        )}
                      </div>
                      <div style={{ color: colors.textMuted, fontSize: 10 }}>
                        {player.reason}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    color: tier.color,
                    fontSize: 12,
                    fontWeight: 600
                  }}>
                    {player.score}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ 
              marginLeft: 20, 
              padding: '8px 12px', 
              color: colors.textMuted,
              fontSize: 12,
              fontStyle: 'italic'
            }}>
              No players in this tier
            </div>
          )}
        </div>
      ))}
      
      {/* Award Button */}
      <button style={{
        width: '100%',
        background: `linear-gradient(135deg, ${colors.accent}, ${colors.accentDim})`,
        border: 'none',
        borderRadius: 8,
        padding: '12px 20px',
        color: colors.bg,
        fontWeight: 600,
        fontSize: 14,
        cursor: 'pointer',
        marginTop: 8
      }}>
        Award to MrDark (DRG)
      </button>
    </div>
  );
};

// ==========================================
// MAIN APP - Combined Mockups
// ==========================================
export default function RaidPlannerMockups() {
  const [activeTab, setActiveTab] = useState('playerCard');
  
  const tabs = [
    { id: 'playerCard', label: 'Enhanced Player Card' },
    { id: 'adjustments', label: 'Loot Adjustments' },
    { id: 'settings', label: 'Priority Settings' },
    { id: 'summary', label: 'Team Summary' },
    { id: 'altJobs', label: 'Alt Job Tracking' },
    { id: 'coffer', label: 'Coffer Priority' },
  ];
  
  return (
    <div style={{
      minHeight: '100vh',
      background: colors.bg,
      padding: 24,
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{ 
        textAlign: 'center', 
        marginBottom: 32,
        paddingBottom: 24,
        borderBottom: `1px solid ${colors.border}`
      }}>
        <h1 style={{ 
          color: colors.text, 
          margin: 0, 
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: '-0.5px'
        }}>
          FFXIV Raid Planner UX Mockups
        </h1>
        <p style={{ color: colors.textMuted, margin: '8px 0 0', fontSize: 14 }}>
          Addressing parity gaps from the January 2026 audit
        </p>
      </div>
      
      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 24,
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: activeTab === tab.id ? colors.accent : colors.bgCard,
              color: activeTab === tab.id ? colors.bg : colors.textMuted,
              border: `1px solid ${activeTab === tab.id ? colors.accent : colors.border}`,
              borderRadius: 8,
              padding: '10px 18px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 13,
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Mockup Content */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        minHeight: 600
      }}>
        {activeTab === 'playerCard' && <EnhancedPlayerCard />}
        {activeTab === 'adjustments' && <LootAdjustmentsPanel />}
        {activeTab === 'settings' && <PrioritySettings />}
        {activeTab === 'summary' && <EnhancedSummary />}
        {activeTab === 'altJobs' && <AltJobPanel />}
        {activeTab === 'coffer' && <CofferPriority />}
      </div>
      
      {/* Feature Description */}
      <div style={{
        maxWidth: 700,
        margin: '40px auto 0',
        padding: 20,
        background: colors.bgCard,
        borderRadius: 12,
        border: `1px solid ${colors.border}`
      }}>
        <h3 style={{ color: colors.text, margin: '0 0 12px', fontSize: 15, fontWeight: 600 }}>
          {activeTab === 'playerCard' && '📋 Enhanced Player Card with Gear Categories & Markers'}
          {activeTab === 'adjustments' && '⚖️ Loot & Page Adjustments for Mid-Tier Joins'}
          {activeTab === 'settings' && '⚙️ Priority Mode & Loot Weight Configuration'}
          {activeTab === 'summary' && '📊 Enhanced Team Summary with iLv Tracking'}
          {activeTab === 'altJobs' && '🔄 Alt Job Tracking with Shared Page Pool'}
          {activeTab === 'coffer' && '📦 Tiered Coffer Priority System'}
        </h3>
        <p style={{ color: colors.textMuted, margin: 0, fontSize: 13, lineHeight: 1.6 }}>
          {activeTab === 'playerCard' && 
            'Shows current gear source (9 categories like in Arcadion sheet), item levels per slot, average iLv, and planning markers (🔨📃♻️💰◀️💾). Click the flag column to add/remove markers for planning intent.'}
          {activeTab === 'adjustments' && 
            'Allows adjusting loot counts and page balances for players who join mid-tier. Positive values simulate the loot/pages they would have earned if starting from Week 1, ensuring fair priority calculations.'}
          {activeTab === 'settings' && 
            'Toggle between Role-Based priority (current system with role order + slot weights) and Loot Count First (spreadsheet-style lowest-loot-wins). Also configure which loot types count toward totals.'}
          {activeTab === 'summary' && 
            'Team overview with progress bars, average item levels, drop counts, and loot rank indicators. Low-loot players get priority boost visibility. Color-coded progress tiers match spreadsheet patterns.'}
          {activeTab === 'altJobs' && 
            'Track alternate jobs with shared page pool. Main job pages accumulate from clears, alts can use the same pool for their gear. Alts appear in separate priority tier during coffer distribution.'}
          {activeTab === 'coffer' && 
            'Tiered coffer priority: BiS Priority > iLv Padding > Alt Jobs > Free Roll. Mimics Arcadion spreadsheet hierarchy where players needing BiS slot get first pick, then those who would gain iLv, then alts.'}
        </p>
      </div>
    </div>
  );
}
