import React, { useState } from 'react';

// Concept B: Clean Modern Dashboard
// Design philosophy: Light, airy, focused on clarity and data visualization
// Key differentiator: Approachable, less intimidating, emphasizes progress

const GEAR_SLOTS = ['Weapon', 'Head', 'Body', 'Hands', 'Legs', 'Feet', 'Ear', 'Neck', 'Wrist', 'Ring', 'Ring'];

const MOCK_PLAYERS = [
  { id: 1, name: 'Udra Virias', job: 'DRK', role: 'Tank', progress: 45, needs: ['Weapon', 'Body', 'Legs', 'Ear', 'Wrist'] },
  { id: 2, name: 'Tank Two', job: 'GNB', role: 'Tank', progress: 55, needs: ['Head', 'Hands', 'Feet', 'Neck', 'Ring'] },
  { id: 3, name: 'Healer One', job: 'WHM', role: 'Healer', progress: 63, needs: ['Weapon', 'Body', 'Legs'] },
  { id: 4, name: 'Healer Two', job: 'SGE', role: 'Healer', progress: 36, needs: ['Weapon', 'Head', 'Hands', 'Feet', 'Neck', 'Ring'] },
  { id: 5, name: 'DPS One', job: 'SAM', role: 'DPS', progress: 72, needs: ['Body', 'Legs', 'Ear'] },
  { id: 6, name: 'DPS Two', job: 'NIN', role: 'DPS', progress: 27, needs: ['Weapon', 'Head', 'Body', 'Hands', 'Feet', 'Neck', 'Ring'] },
  { id: 7, name: 'DPS Three', job: 'BRD', role: 'DPS', progress: 54, needs: ['Weapon', 'Body', 'Legs', 'Ear', 'Wrist'] },
  { id: 8, name: 'DPS Four', job: 'PCT', role: 'DPS', progress: 45, needs: ['Weapon', 'Head', 'Hands', 'Feet', 'Neck', 'Ring'] },
];

const roleColors = {
  Tank: '#3b82f6',
  Healer: '#10b981',
  DPS: '#f59e0b',
};

export default function ModernRaidPlanner() {
  const [view, setView] = useState('overview');
  const [selectedFloor, setSelectedFloor] = useState(null);

  const avgProgress = Math.round(MOCK_PLAYERS.reduce((a, p) => a + p.progress, 0) / MOCK_PLAYERS.length);

  const ProgressRing = ({ progress, size = 120, strokeWidth = 8, color }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (progress / 100) * circumference;
    
    return (
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
    );
  };

  const PlayerCard = ({ player }) => (
    <div style={{
      background: '#fff',
      borderRadius: '16px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      border: '1px solid #f3f4f6',
      transition: 'all 0.2s ease',
      cursor: 'pointer',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
    }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{
              background: roleColors[player.role],
              color: '#fff',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '600',
            }}>{player.job}</span>
            <span style={{
              color: roleColors[player.role],
              fontSize: '11px',
              fontWeight: '500',
            }}>{player.role}</span>
          </div>
          <h3 style={{
            margin: '0',
            fontSize: '16px',
            fontWeight: '600',
            color: '#111827',
          }}>{player.name}</h3>
        </div>
        
        <div style={{ position: 'relative', width: '50px', height: '50px' }}>
          <ProgressRing progress={player.progress} size={50} strokeWidth={4} color={roleColors[player.role]} />
          <span style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(90deg)',
            fontSize: '12px',
            fontWeight: '600',
            color: '#374151',
          }}>{player.progress}%</span>
        </div>
      </div>
      
      <div style={{ marginTop: '16px' }}>
        <div style={{
          fontSize: '11px',
          color: '#6b7280',
          marginBottom: '8px',
        }}>Still needs ({player.needs.length} items)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {player.needs.map((item, i) => (
            <span key={i} style={{
              background: '#f3f4f6',
              color: '#4b5563',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '11px',
            }}>{item}</span>
          ))}
        </div>
      </div>
    </div>
  );

  const FloorCard = ({ floor, drops, clears }) => (
    <button
      onClick={() => setSelectedFloor(floor)}
      style={{
        background: selectedFloor === floor ? '#f0fdf4' : '#fff',
        border: selectedFloor === floor ? '2px solid #10b981' : '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '16px',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          fontSize: '13px',
          fontWeight: '600',
          color: '#111827',
        }}>Floor {floor}</span>
        <span style={{
          fontSize: '12px',
          color: '#6b7280',
        }}>{clears} clears</span>
      </div>
      <div style={{
        marginTop: '8px',
        fontSize: '11px',
        color: '#6b7280',
      }}>
        {drops.join(' • ')}
      </div>
    </button>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #fafafa 0%, #f5f5f5 100%)',
      fontFamily: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif',
    }}>
      {/* Header */}
      <header style={{
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        padding: '16px 32px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '18px',
              fontWeight: 'bold',
            }}>R</div>
            <div>
              <h1 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '700',
                color: '#111827',
              }}>Arcadion Heavyweight</h1>
              <p style={{
                margin: 0,
                fontSize: '12px',
                color: '#6b7280',
              }}>Savage Tier • Week 3 of Progression</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{
              display: 'flex',
              background: '#f3f4f6',
              borderRadius: '10px',
              padding: '4px',
            }}>
              {['overview', 'loot', 'priority'].map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    padding: '8px 16px',
                    background: view === v ? '#fff' : 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: view === v ? '600' : '400',
                    color: view === v ? '#111827' : '#6b7280',
                    cursor: 'pointer',
                    boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.15s ease',
                    textTransform: 'capitalize',
                  }}
                >{v}</button>
              ))}
            </div>
            
            <button style={{
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16,6 12,2 8,6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              Share
            </button>
          </div>
        </div>
      </header>

      <main style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Progress Overview */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '300px 1fr',
          gap: '24px',
          marginBottom: '32px',
        }}>
          {/* Team Progress */}
          <div style={{
            background: '#fff',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}>
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <ProgressRing progress={avgProgress} size={140} strokeWidth={12} color="#6366f1" />
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: '700',
                  color: '#111827',
                }}>{avgProgress}%</div>
                <div style={{
                  fontSize: '11px',
                  color: '#6b7280',
                }}>Team BiS</div>
              </div>
            </div>
            <h3 style={{
              margin: '0 0 4px 0',
              fontSize: '15px',
              fontWeight: '600',
              color: '#111827',
            }}>On Track for Week 8</h3>
            <p style={{
              margin: 0,
              fontSize: '12px',
              color: '#6b7280',
            }}>47 drops remaining across all floors</p>
          </div>

          {/* Floors */}
          <div style={{
            background: '#fff',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}>
            <h3 style={{
              margin: '0 0 16px 0',
              fontSize: '14px',
              fontWeight: '600',
              color: '#111827',
            }}>Floor Progress</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <FloorCard floor={1} drops={['Earring', 'Necklace', 'Bracelet', 'Ring']} clears={3} />
              <FloorCard floor={2} drops={['Head', 'Hands', 'Feet', 'Glaze']} clears={3} />
              <FloorCard floor={3} drops={['Body', 'Legs', 'Twine', 'Solvent']} clears={2} />
              <FloorCard floor={4} drops={['Weapon', 'Coffer', 'Mount']} clears={0} />
            </div>
          </div>
        </div>

        {/* Player Grid */}
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}>
            <h2 style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: '600',
              color: '#111827',
            }}>Team Members</h2>
            <button style={{
              padding: '8px 16px',
              background: '#f3f4f6',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#374151',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Filter by role
            </button>
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px',
          }}>
            {MOCK_PLAYERS.map(player => (
              <PlayerCard key={player.id} player={player} />
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{
          marginTop: '32px',
          padding: '20px 24px',
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          borderRadius: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h3 style={{
              margin: '0 0 4px 0',
              fontSize: '15px',
              fontWeight: '600',
              color: '#fff',
            }}>Ready for tonight's raid?</h3>
            <p style={{
              margin: 0,
              fontSize: '12px',
              color: 'rgba(255,255,255,0.8)',
            }}>Based on current priority, DPS Two should get the next weapon drop</p>
          </div>
          <button style={{
            padding: '10px 20px',
            background: '#fff',
            border: 'none',
            borderRadius: '10px',
            color: '#6366f1',
            fontWeight: '600',
            fontSize: '13px',
            cursor: 'pointer',
          }}>View Loot Priority</button>
        </div>
      </main>
    </div>
  );
}
