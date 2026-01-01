import React, { useState } from 'react';

// New color palette: Obsidian & Amber
const colors = {
  bgPrimary: '#050508',
  bgSecondary: '#0a0a10',
  bgCard: '#0e0e14',
  bgElevated: '#141420',
  bgHover: '#1a1a28',
  accent: '#d4a422',
  accentBright: '#f0c040',
  accentMuted: '#8a7428',
  borderDefault: '#1f1f2e',
  borderSubtle: '#14141e',
  textPrimary: '#f0f0f5',
  textSecondary: '#9090a0',
  textMuted: '#505060',
  roleTank: '#5a9fd4',
  roleHealer: '#5ad490',
  roleMelee: '#d45a5a',
  roleRanged: '#d4a05a',
  roleCaster: '#b45ad4',
};

const ChevronDown = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const GridIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const ListIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const UserIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const CopyIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

// Mock data
const mockPlayers = [
  { id: 1, name: 'Warrior Tank', job: 'WAR', role: 'tank', position: 'T1', tankRole: 'MT', completion: 8, total: 11 },
  { id: 2, name: 'Paladin Tank', job: 'PLD', role: 'tank', position: 'T2', tankRole: 'OT', completion: 6, total: 11 },
  { id: 3, name: 'White Mage', job: 'WHM', role: 'healer', position: 'H1', completion: 9, total: 11 },
  { id: 4, name: 'Scholar', job: 'SCH', role: 'healer', position: 'H2', completion: 7, total: 11 },
  { id: 5, name: 'Dragoon', job: 'DRG', role: 'melee', position: 'M1', completion: 10, total: 11 },
  { id: 6, name: 'Samurai', job: 'SAM', role: 'melee', position: 'M2', completion: 5, total: 11 },
  { id: 7, name: 'Bard', job: 'BRD', role: 'ranged', position: 'R1', completion: 8, total: 11 },
  { id: 8, name: 'Black Mage', job: 'BLM', role: 'caster', position: 'R2', completion: 11, total: 11 },
];

const getRoleColor = (role) => {
  const roleColors = {
    tank: colors.roleTank,
    healer: colors.roleHealer,
    melee: colors.roleMelee,
    ranged: colors.roleRanged,
    caster: colors.roleCaster,
  };
  return roleColors[role] || colors.textMuted;
};

const PlayerCard = ({ player, isCompact }) => {
  const roleColor = getRoleColor(player.role);
  const isComplete = player.completion === player.total;
  
  return (
    <div 
      className="rounded-lg transition-all duration-200 overflow-hidden"
      style={{ 
        background: colors.bgCard,
        borderLeft: `3px solid ${roleColor}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <div className="p-3">
        {/* Header row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {/* Job icon placeholder */}
            <div 
              className="w-10 h-10 rounded flex items-center justify-center text-xs font-bold"
              style={{ background: `${roleColor}20`, color: roleColor }}
            >
              {player.job}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span style={{ color: colors.textPrimary }} className="font-medium">
                  {player.name}
                </span>
                <span 
                  className="text-xs px-1.5 py-0.5 rounded font-bold"
                  style={{ 
                    background: `${roleColor}20`, 
                    color: roleColor 
                  }}
                >
                  {player.position}
                </span>
                {player.tankRole && (
                  <span 
                    className="text-xs px-1.5 py-0.5 rounded font-bold"
                    style={{ 
                      background: `${colors.roleTank}20`, 
                      color: colors.roleTank 
                    }}
                  >
                    {player.tankRole}
                  </span>
                )}
              </div>
              <div className="text-xs" style={{ color: colors.textSecondary }}>
                {player.job}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div 
              className="text-lg font-bold"
              style={{ color: isComplete ? colors.accent : colors.textPrimary }}
            >
              {player.completion}/{player.total}
            </div>
          </div>
        </div>
        
        {/* Needs footer */}
        <div 
          className="flex gap-4 text-xs pt-2 mt-2"
          style={{ borderTop: `1px solid ${colors.borderSubtle}` }}
        >
          <div className="flex gap-1">
            <span style={{ color: colors.roleMelee }}>{11 - player.completion}</span>
            <span style={{ color: colors.textMuted }}>Raid</span>
          </div>
          <div className="flex gap-1">
            <span style={{ color: colors.roleHealer }}>1</span>
            <span style={{ color: colors.textMuted }}>Tome</span>
          </div>
          <div className="flex gap-1">
            <span style={{ color: colors.accent }}>0</span>
            <span style={{ color: colors.textMuted }}>Aug</span>
          </div>
          <div className="flex gap-1">
            <span style={{ color: colors.textPrimary }}>2</span>
            <span style={{ color: colors.textMuted }}>Wks</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function SimplifiedHeaderMockup() {
  const [activeTab, setActiveTab] = useState('party');
  const [viewMode, setViewMode] = useState('grid');
  const [showComparison, setShowComparison] = useState(true);
  
  return (
    <div style={{ background: colors.bgPrimary, minHeight: '100vh' }}>
      {/* Toggle for Before/After comparison */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setShowComparison(!showComparison)}
          className="px-3 py-1.5 rounded text-sm font-medium transition-all"
          style={{ 
            background: colors.accent, 
            color: colors.bgPrimary,
          }}
        >
          {showComparison ? 'Show New Design Only' : 'Show Comparison'}
        </button>
      </div>

      {showComparison && (
        <>
          {/* BEFORE: Current Design */}
          <div className="pb-8" style={{ borderBottom: `2px dashed ${colors.accent}` }}>
            <div className="text-center py-2" style={{ background: colors.roleMelee + '20' }}>
              <span className="text-sm font-bold" style={{ color: colors.roleMelee }}>
                ⬆️ CURRENT DESIGN (3+ rows of chrome)
              </span>
            </div>
            
            {/* Current Header Row 1 */}
            <div style={{ background: colors.bgSecondary, borderBottom: `1px solid ${colors.borderDefault}` }}>
              <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
                <span className="text-xl" style={{ color: colors.accent, fontFamily: 'serif' }}>
                  FFXIV Raid Planner
                </span>
                <div className="flex items-center gap-3">
                  <button 
                    className="px-4 py-2 rounded font-medium"
                    style={{ background: `${colors.accent}20`, color: colors.accent }}
                  >
                    My Statics
                  </button>
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: colors.bgHover }}
                  >
                    <UserIcon />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Current Row 2: Group info + Tier controls */}
            <div className="max-w-6xl mx-auto px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl" style={{ color: colors.accent, fontFamily: 'serif' }}>
                    TEST (Copy)
                  </h1>
                  <span 
                    className="text-xs px-2 py-0.5 rounded border"
                    style={{ 
                      background: '#eab30820', 
                      color: '#eab308',
                      borderColor: '#eab30830'
                    }}
                  >
                    Owner
                  </span>
                  <button className="p-1.5 rounded" style={{ color: colors.textMuted }}>
                    ⚙️
                  </button>
                  <button 
                    className="flex items-center gap-1.5 px-2 py-1 rounded"
                    style={{ background: `${colors.textPrimary}05` }}
                  >
                    <span className="font-mono text-sm" style={{ color: colors.accent }}>H9VE4P</span>
                    <CopyIcon />
                  </button>
                </div>
                
                <div className="flex items-center gap-3">
                  <select 
                    className="px-3 py-2 rounded"
                    style={{ 
                      background: colors.bgCard, 
                      color: colors.textPrimary,
                      border: `1px solid ${colors.borderDefault}`
                    }}
                  >
                    <option>AAC Cruiserweight (Savage)</option>
                  </select>
                  <button className="p-2 rounded" style={{ color: colors.roleMelee }}>🗑️</button>
                  <button 
                    className="px-3 py-2 rounded font-medium"
                    style={{ background: colors.accent, color: colors.bgPrimary }}
                  >
                    + Add 3/8
                  </button>
                </div>
              </div>
            </div>
            
            {/* Current Row 3: Tabs + Controls */}
            <div className="max-w-6xl mx-auto px-4 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {['Party', 'Loot', 'Stats'].map((tab) => (
                    <button
                      key={tab}
                      className="px-4 py-2 rounded font-medium text-sm"
                      style={{ 
                        background: tab === 'Party' ? colors.accent : 'transparent',
                        color: tab === 'Party' ? colors.bgPrimary : colors.textSecondary
                      }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <select 
                    className="px-3 py-1.5 rounded text-sm"
                    style={{ 
                      background: colors.bgCard, 
                      color: colors.textPrimary,
                      border: `1px solid ${colors.borderDefault}`
                    }}
                  >
                    <option>Standard</option>
                  </select>
                  <button 
                    className="px-3 py-1.5 rounded text-sm"
                    style={{ 
                      background: colors.bgCard, 
                      color: colors.textSecondary,
                      border: `1px solid ${colors.borderDefault}`
                    }}
                  >
                    👥 G1/G2
                  </button>
                  <div className="flex rounded overflow-hidden" style={{ border: `1px solid ${colors.borderDefault}` }}>
                    <button className="p-2" style={{ background: colors.accent, color: colors.bgPrimary }}>
                      <GridIcon />
                    </button>
                    <button className="p-2" style={{ background: colors.bgCard, color: colors.textMuted }}>
                      <ListIcon />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* AFTER: New Simplified Design */}
      <div className="pt-4">
        {showComparison && (
          <div className="text-center py-2" style={{ background: colors.roleHealer + '20' }}>
            <span className="text-sm font-bold" style={{ color: colors.roleHealer }}>
              ⬇️ NEW DESIGN (2 compact rows)
            </span>
          </div>
        )}
        
        {/* New Header - Row 1: Everything in one line */}
        <div 
          className="sticky top-0 z-40"
          style={{ 
            background: `${colors.bgSecondary}ee`, 
            borderBottom: `1px solid ${colors.borderSubtle}`,
            backdropFilter: 'blur(8px)'
          }}
        >
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            {/* Left: Logo + Context */}
            <div className="flex items-center gap-4">
              <span style={{ color: colors.accent, fontFamily: 'serif' }} className="text-lg">
                FFXIV Raid Planner
              </span>
              <span style={{ color: colors.textMuted }}>/</span>
              <div className="flex items-center gap-2">
                <span style={{ color: colors.textSecondary }}>TEST (Copy)</span>
                <button 
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs opacity-60 hover:opacity-100 transition-opacity"
                  style={{ background: `${colors.textPrimary}10` }}
                >
                  <span className="font-mono" style={{ color: colors.accent }}>H9VE4P</span>
                  <CopyIcon />
                </button>
              </div>
            </div>
            
            {/* Right: Tier + Add + User */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: colors.textMuted }}>Tier:</span>
                <button 
                  className="flex items-center gap-1 px-2 py-1 rounded text-sm"
                  style={{ 
                    background: colors.bgHover, 
                    color: colors.textPrimary,
                  }}
                >
                  M5S-M8S
                  <ChevronDown />
                </button>
              </div>
              <button 
                className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium transition-all hover:translate-y-[-1px]"
                style={{ 
                  background: colors.accent, 
                  color: colors.bgPrimary,
                }}
              >
                <PlusIcon />
                <span>Player</span>
                <span className="opacity-70">3/8</span>
              </button>
              <button 
                className="text-sm transition-colors"
                style={{ color: colors.textSecondary }}
              >
                My Statics
              </button>
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors"
                style={{ background: colors.bgHover, color: colors.textSecondary }}
              >
                <UserIcon />
              </div>
            </div>
          </div>
        </div>
        
        {/* New Row 2: Tabs + Controls (ultra compact) */}
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Tabs */}
            <div className="flex gap-1">
              {[
                { id: 'party', label: 'Party' },
                { id: 'loot', label: 'Loot' },
                { id: 'stats', label: 'Stats' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="px-3 py-1.5 rounded text-sm font-medium transition-all"
                  style={{ 
                    background: activeTab === tab.id ? colors.accent : 'transparent',
                    color: activeTab === tab.id ? colors.bgPrimary : colors.textSecondary
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            
            {/* Controls - Icon only for compactness */}
            <div className="flex items-center gap-2">
              <select 
                className="px-2 py-1 rounded text-sm appearance-none cursor-pointer"
                style={{ 
                  background: 'transparent', 
                  color: colors.textSecondary,
                  border: `1px solid ${colors.borderDefault}`,
                  paddingRight: '24px'
                }}
              >
                <option>Standard</option>
                <option>DPS First</option>
                <option>Healer First</option>
              </select>
              <button 
                className="p-1.5 rounded transition-colors"
                style={{ 
                  background: colors.bgHover,
                  color: colors.textMuted 
                }}
                title="Group View"
              >
                👥
              </button>
              <div 
                className="flex rounded overflow-hidden"
                style={{ border: `1px solid ${colors.borderDefault}` }}
              >
                <button 
                  onClick={() => setViewMode('grid')}
                  className="p-1.5 transition-colors"
                  style={{ 
                    background: viewMode === 'grid' ? colors.accent : colors.bgCard, 
                    color: viewMode === 'grid' ? colors.bgPrimary : colors.textMuted 
                  }}
                >
                  <GridIcon />
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className="p-1.5 transition-colors"
                  style={{ 
                    background: viewMode === 'list' ? colors.accent : colors.bgCard, 
                    color: viewMode === 'list' ? colors.bgPrimary : colors.textMuted 
                  }}
                >
                  <ListIcon />
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Content Area - Player Cards */}
        <div className="max-w-6xl mx-auto px-4 pb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {mockPlayers.map((player) => (
              <PlayerCard key={player.id} player={player} isCompact={viewMode === 'grid'} />
            ))}
          </div>
        </div>
        
        {/* Color Palette Reference */}
        <div className="max-w-6xl mx-auto px-4 py-8 mt-8" style={{ borderTop: `1px solid ${colors.borderDefault}` }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: colors.accent }}>
            NEW COLOR PALETTE: "Obsidian & Amber"
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <div className="font-medium mb-2" style={{ color: colors.textPrimary }}>Backgrounds</div>
              {[
                { name: 'Primary', color: colors.bgPrimary },
                { name: 'Secondary', color: colors.bgSecondary },
                { name: 'Card', color: colors.bgCard },
                { name: 'Elevated', color: colors.bgElevated },
                { name: 'Hover', color: colors.bgHover },
              ].map(({ name, color }) => (
                <div key={name} className="flex items-center gap-2 mb-1">
                  <div className="w-4 h-4 rounded border" style={{ background: color, borderColor: colors.borderDefault }} />
                  <span style={{ color: colors.textSecondary }}>{name}</span>
                  <span style={{ color: colors.textMuted }}>{color}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="font-medium mb-2" style={{ color: colors.textPrimary }}>Accent (Gold)</div>
              {[
                { name: 'Primary', color: colors.accent },
                { name: 'Bright', color: colors.accentBright },
                { name: 'Muted', color: colors.accentMuted },
              ].map(({ name, color }) => (
                <div key={name} className="flex items-center gap-2 mb-1">
                  <div className="w-4 h-4 rounded" style={{ background: color }} />
                  <span style={{ color: colors.textSecondary }}>{name}</span>
                  <span style={{ color: colors.textMuted }}>{color}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="font-medium mb-2" style={{ color: colors.textPrimary }}>Role Colors</div>
              {[
                { name: 'Tank', color: colors.roleTank },
                { name: 'Healer', color: colors.roleHealer },
                { name: 'Melee', color: colors.roleMelee },
                { name: 'Ranged', color: colors.roleRanged },
                { name: 'Caster', color: colors.roleCaster },
              ].map(({ name, color }) => (
                <div key={name} className="flex items-center gap-2 mb-1">
                  <div className="w-4 h-4 rounded" style={{ background: color }} />
                  <span style={{ color: colors.textSecondary }}>{name}</span>
                  <span style={{ color: colors.textMuted }}>{color}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="font-medium mb-2" style={{ color: colors.textPrimary }}>Text & Borders</div>
              {[
                { name: 'Text Primary', color: colors.textPrimary },
                { name: 'Text Secondary', color: colors.textSecondary },
                { name: 'Text Muted', color: colors.textMuted },
                { name: 'Border Default', color: colors.borderDefault },
                { name: 'Border Subtle', color: colors.borderSubtle },
              ].map(({ name, color }) => (
                <div key={name} className="flex items-center gap-2 mb-1">
                  <div className="w-4 h-4 rounded border" style={{ background: color, borderColor: colors.borderDefault }} />
                  <span style={{ color: colors.textSecondary }}>{name}</span>
                  <span style={{ color: colors.textMuted }}>{color}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
