import React, { useState } from 'react';

// New darker color palette
const colors = {
  bgPrimary: '#060608',
  bgSecondary: '#0c0c10',
  bgCard: 'rgba(14, 14, 18, 0.95)',
  bgHover: 'rgba(28, 28, 36, 0.9)',
  bgElevated: '#101014',
  accent: '#d4a82a',
  accentDim: 'rgba(212, 168, 42, 0.15)',
  accentBright: '#e8bc35',
  textPrimary: '#f0f0f0',
  textSecondary: '#9a9a9a',
  textMuted: '#555555',
  borderDefault: '#2a2a30',
  borderSubtle: '#1a1a20',
  // Role colors (unchanged)
  roleTank: '#4a90c2',
  roleHealer: '#4ab87a',
  roleMelee: '#c24a4a',
  roleRanged: '#c29a4a',
  roleCaster: '#a24ac2',
};

// Mock data
const mockTiers = [
  { id: 'aac-cruiserweight', name: 'AAC Cruiserweight (Savage)', shortName: 'M1S-M4S' },
  { id: 'aac-lightweight', name: 'AAC Lightweight (Savage)', shortName: 'M5S-M8S' },
];

const mockPlayers = [
  { id: '1', name: 'Warrior Main', job: 'WAR', role: 'tank', position: 'T1', tankRole: 'MT', configured: true, gear: Array(11).fill({ hasItem: true, bisSource: 'raid', isAugmented: false }) },
  { id: '2', name: 'Paladin OT', job: 'PLD', role: 'tank', position: 'T2', tankRole: 'OT', configured: true, gear: Array(11).fill({ hasItem: false, bisSource: 'raid', isAugmented: false }) },
  { id: '3', name: 'White Mage', job: 'WHM', role: 'healer', position: 'H1', configured: true, gear: Array(11).fill({ hasItem: true, bisSource: 'tome', isAugmented: true }) },
  { id: '4', name: 'Scholar', job: 'SCH', role: 'healer', position: 'H2', configured: true, gear: Array(11).fill({ hasItem: false, bisSource: 'raid', isAugmented: false }) },
  { id: '5', name: 'Monk DPS', job: 'MNK', role: 'melee', position: 'M1', configured: true, gear: Array(11).fill({ hasItem: true, bisSource: 'raid', isAugmented: false }) },
  { id: '6', name: 'Dragoon', job: 'DRG', role: 'melee', position: 'M2', configured: true, gear: Array(11).fill({ hasItem: false, bisSource: 'raid', isAugmented: false }) },
  { id: '7', name: '', job: '', role: '', position: 'R1', configured: false, gear: [] },
  { id: '8', name: '', job: '', role: '', position: 'R2', configured: false, gear: [] },
];

const GearIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const CopyIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

// Share Code Button with copy functionality
function ShareCodeButton({ code }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2 py-1 rounded transition-colors"
      style={{ 
        backgroundColor: copied ? 'rgba(68, 170, 68, 0.1)' : colors.bgHover,
      }}
    >
      <span style={{ fontFamily: 'monospace', fontSize: '13px', color: colors.accent }}>
        {code}
      </span>
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

// Settings Popover
function SettingsPopover({ onAction }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded transition-colors"
        style={{ 
          color: isOpen ? colors.textPrimary : colors.textSecondary,
          backgroundColor: isOpen ? colors.bgHover : 'transparent',
        }}
        onMouseEnter={(e) => e.target.style.backgroundColor = colors.bgHover}
        onMouseLeave={(e) => e.target.style.backgroundColor = isOpen ? colors.bgHover : 'transparent'}
      >
        <GearIcon />
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0" 
            onClick={() => setIsOpen(false)}
          />
          <div 
            className="absolute right-0 top-full mt-2 w-56 rounded-lg shadow-xl z-50"
            style={{ 
              backgroundColor: colors.bgElevated,
              border: `1px solid ${colors.borderSubtle}`,
            }}
          >
            <div className="p-1">
              <PopoverItem icon="+" label="Add Player" badge="6/8" onClick={() => { setIsOpen(false); onAction?.('add'); }} />
              <PopoverItem icon="📄" label="New Tier" onClick={() => { setIsOpen(false); onAction?.('newTier'); }} />
              <PopoverItem icon="↻" label="Copy to New Tier" onClick={() => { setIsOpen(false); onAction?.('rollover'); }} />
              <hr style={{ margin: '4px 0', borderColor: colors.borderSubtle }} />
              <PopoverItem icon="⚙" label="Static Settings" onClick={() => { setIsOpen(false); onAction?.('settings'); }} />
              <PopoverItem icon="🗑" label="Delete Tier" danger onClick={() => { setIsOpen(false); onAction?.('delete'); }} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PopoverItem({ icon, label, badge, danger, onClick }) {
  const [hovered, setHovered] = useState(false);
  
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center gap-3 px-3 py-2 text-left rounded transition-colors"
      style={{ 
        color: danger ? '#f87171' : colors.textPrimary,
        backgroundColor: hovered ? (danger ? 'rgba(248, 113, 113, 0.1)' : colors.bgHover) : 'transparent',
      }}
    >
      <span className="w-4 text-center">{icon}</span>
      <span>{label}</span>
      {badge && (
        <span 
          className="ml-auto text-xs px-1.5 py-0.5 rounded"
          style={{ backgroundColor: colors.bgHover, color: colors.textMuted }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

// Tier Dropdown
function TierDropdown({ tiers, currentTier, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const current = tiers.find(t => t.id === currentTier);
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded transition-colors"
        style={{ 
          backgroundColor: colors.bgCard,
          border: `1px solid ${colors.borderDefault}`,
          color: colors.textPrimary,
        }}
      >
        <span>{current?.shortName || 'Select Tier'}</span>
        <ChevronDownIcon />
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0" onClick={() => setIsOpen(false)} />
          <div 
            className="absolute left-0 top-full mt-1 w-64 rounded-lg shadow-xl z-50"
            style={{ 
              backgroundColor: colors.bgElevated,
              border: `1px solid ${colors.borderSubtle}`,
            }}
          >
            {tiers.map(tier => (
              <button
                key={tier.id}
                onClick={() => { onChange(tier.id); setIsOpen(false); }}
                className="w-full px-3 py-2 text-left transition-colors first:rounded-t-lg last:rounded-b-lg"
                style={{ 
                  backgroundColor: tier.id === currentTier ? colors.accentDim : 'transparent',
                  color: colors.textPrimary,
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = tier.id === currentTier ? colors.accentDim : colors.bgHover}
                onMouseLeave={(e) => e.target.style.backgroundColor = tier.id === currentTier ? colors.accentDim : 'transparent'}
              >
                {tier.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// User Menu
function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
      >
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: colors.accent, color: colors.bgPrimary }}
        >
          A
        </div>
        <ChevronDownIcon />
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0" onClick={() => setIsOpen(false)} />
          <div 
            className="absolute right-0 top-full mt-2 w-48 rounded-lg shadow-xl z-50"
            style={{ 
              backgroundColor: colors.bgElevated,
              border: `1px solid ${colors.borderSubtle}`,
            }}
          >
            <div className="p-2">
              <div className="px-3 py-2" style={{ color: colors.textSecondary }}>
                AaronZak
              </div>
              <hr style={{ borderColor: colors.borderSubtle, margin: '4px 0' }} />
              <button className="w-full px-3 py-2 text-left rounded transition-colors" style={{ color: colors.textPrimary }}>
                My Statics
              </button>
              <button className="w-full px-3 py-2 text-left rounded transition-colors" style={{ color: '#f87171' }}>
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Mini Player Card for the mockup
function MiniPlayerCard({ player }) {
  const roleColors = {
    tank: colors.roleTank,
    healer: colors.roleHealer,
    melee: colors.roleMelee,
    ranged: colors.roleRanged,
    caster: colors.roleCaster,
  };
  
  if (!player.configured) {
    return (
      <div 
        className="rounded-lg p-4 border-2 border-dashed"
        style={{ 
          backgroundColor: colors.bgCard,
          borderColor: colors.borderDefault,
        }}
      >
        <div className="text-center py-6" style={{ color: colors.textMuted }}>
          <div className="text-lg mb-1">Player Slot</div>
          <div className="text-sm">Click to configure</div>
        </div>
      </div>
    );
  }
  
  const completed = player.gear.filter(g => g.hasItem).length;
  const total = player.gear.length;
  
  return (
    <div 
      className="rounded-lg overflow-hidden"
      style={{ 
        backgroundColor: colors.bgCard,
        border: `1px solid ${colors.borderSubtle}`,
      }}
    >
      {/* Role color bar */}
      <div className="h-1" style={{ backgroundColor: roleColors[player.role] || colors.borderDefault }} />
      
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Job icon placeholder */}
            <div 
              className="w-10 h-10 rounded flex items-center justify-center font-bold"
              style={{ 
                backgroundColor: roleColors[player.role] + '20',
                color: roleColors[player.role],
              }}
            >
              {player.job}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span style={{ color: colors.textPrimary, fontWeight: 500 }}>{player.name}</span>
                {player.position && (
                  <span 
                    className="px-1.5 py-0.5 rounded text-xs font-bold"
                    style={{ 
                      backgroundColor: roleColors[player.role] + '20',
                      color: roleColors[player.role],
                    }}
                  >
                    {player.position}
                  </span>
                )}
              </div>
              <div className="text-sm" style={{ color: colors.textSecondary }}>
                {player.job} {player.tankRole && `• ${player.tankRole}`}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold" style={{ color: colors.textPrimary }}>
              {completed}/{total}
            </div>
          </div>
        </div>
      </div>
      
      {/* Needs footer */}
      <div 
        className="px-4 py-2 flex items-center gap-4 text-xs"
        style={{ 
          backgroundColor: colors.bgHover,
          borderTop: `1px solid ${colors.borderSubtle}`,
        }}
      >
        <span style={{ color: '#c44444' }}>
          <span className="font-bold">{Math.max(0, total - completed)}</span> Raid
        </span>
        <span style={{ color: '#44aa44' }}>
          <span className="font-bold">1</span> Tome
        </span>
        <span style={{ color: colors.accentBright }}>
          <span className="font-bold">0</span> Aug
        </span>
        <span style={{ color: colors.textMuted }}>
          <span className="font-bold">2</span> Wks
        </span>
      </div>
    </div>
  );
}

// Tab Navigation
function TabNav({ activeTab, onChange }) {
  const tabs = [
    { id: 'players', label: 'Party', icon: '👥' },
    { id: 'loot', label: 'Loot', icon: '📦' },
    { id: 'stats', label: 'Stats', icon: '📊' },
  ];
  
  return (
    <div className="flex gap-1">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className="flex items-center gap-2 px-4 py-2 rounded transition-colors"
          style={{ 
            backgroundColor: activeTab === tab.id ? colors.accentDim : 'transparent',
            color: activeTab === tab.id ? colors.accent : colors.textSecondary,
            border: activeTab === tab.id ? `1px solid ${colors.accent}40` : '1px solid transparent',
          }}
        >
          <span>{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

// Main App
export default function HeaderRedesignMockup() {
  const [currentTier, setCurrentTier] = useState('aac-cruiserweight');
  const [activeTab, setActiveTab] = useState('players');
  const [showComparison, setShowComparison] = useState(true);
  
  return (
    <div style={{ backgroundColor: colors.bgPrimary, minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* Toggle for comparison */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setShowComparison(!showComparison)}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{ 
            backgroundColor: colors.accent,
            color: colors.bgPrimary,
          }}
        >
          {showComparison ? 'Hide Old Design' : 'Show Comparison'}
        </button>
      </div>
      
      {showComparison && (
        <div style={{ backgroundColor: '#0a0a12', borderBottom: `2px solid ${colors.accent}`, padding: '20px 0' }}>
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-xs uppercase tracking-wider mb-3" style={{ color: colors.accent }}>
              Current Design (Before)
            </div>
            {/* Old header simulation */}
            <div style={{ backgroundColor: '#12121a', borderBottom: '1px solid #444', padding: '12px 16px' }}>
              <div className="flex justify-between items-center">
                <span style={{ fontFamily: 'Cinzel, serif', color: '#c9a227', fontSize: '20px' }}>FFXIV Raid Planner</span>
                <div className="flex items-center gap-3">
                  <button className="px-4 py-2 rounded" style={{ backgroundColor: '#c9a22730', color: '#c9a227' }}>My Statics</button>
                  <div className="w-8 h-8 rounded-full" style={{ backgroundColor: '#c9a227' }} />
                </div>
              </div>
            </div>
            {/* Old group header */}
            <div className="flex flex-wrap items-center justify-between gap-4 py-4" style={{ borderBottom: '1px solid #333' }}>
              <div className="flex items-center gap-3">
                <span style={{ fontFamily: 'Cinzel, serif', color: '#c9a227', fontSize: '24px' }}>TEST (Copy)</span>
                <span className="px-2 py-0.5 rounded text-xs border" style={{ backgroundColor: '#eab30830', color: '#eab308', borderColor: '#eab30850' }}>Owner</span>
                <button className="p-1.5 rounded" style={{ color: '#666' }}>⚙️</button>
                <button className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ backgroundColor: '#ffffff10', color: '#c9a227' }}>
                  H9VE4P 📋
                </button>
              </div>
              {/* Old tier controls */}
              <div className="flex items-center gap-3">
                <select className="px-3 py-2 rounded" style={{ backgroundColor: '#20202a', border: '1px solid #444', color: '#fff' }}>
                  <option>AAC Cruiserweight (Savage)</option>
                </select>
                <button className="px-3 py-2 rounded" style={{ backgroundColor: '#c9a22720', color: '#c9a227' }}>🗑️</button>
                <button className="px-3 py-2 rounded" style={{ backgroundColor: '#a855f720', color: '#a855f7' }}>↻</button>
                <button className="px-3 py-2 rounded" style={{ backgroundColor: '#c9a22720', color: '#c9a227' }}>+ Add 6/8</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* NEW DESIGN */}
      <div>
        <div className="text-xs uppercase tracking-wider px-4 py-2" style={{ color: colors.accent, backgroundColor: colors.bgSecondary }}>
          {showComparison ? 'New Design (After) - Single Row Header' : 'New Simplified Header Design'}
        </div>
        
        {/* New unified header */}
        <header 
          className="sticky top-0 z-40"
          style={{ 
            backgroundColor: colors.bgSecondary,
            borderBottom: `1px solid ${colors.borderSubtle}`,
          }}
        >
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
            {/* Left: Logo + Static Context */}
            <div className="flex items-center gap-6">
              <span style={{ fontFamily: 'Cinzel, serif', color: colors.accent, fontSize: '18px' }}>
                FFXIV Raid Planner
              </span>
              
              {/* Static context */}
              <div 
                className="flex items-center gap-3 pl-6"
                style={{ borderLeft: `1px solid ${colors.borderSubtle}` }}
              >
                <span style={{ color: colors.textPrimary, fontWeight: 500 }}>TEST (Copy)</span>
                <ShareCodeButton code="H9VE4P" />
              </div>
            </div>
            
            {/* Right: Tier + Settings + User */}
            <div className="flex items-center gap-3">
              <TierDropdown 
                tiers={mockTiers}
                currentTier={currentTier}
                onChange={setCurrentTier}
              />
              
              <SettingsPopover onAction={(action) => console.log('Action:', action)} />
              
              <div style={{ borderLeft: `1px solid ${colors.borderSubtle}`, paddingLeft: '12px' }}>
                <UserMenu />
              </div>
            </div>
          </div>
        </header>
        
        {/* Content area with toolbar */}
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-6">
            <TabNav activeTab={activeTab} onChange={setActiveTab} />
            
            <div className="flex items-center gap-3">
              {/* View controls (only visible on Party tab) */}
              <select 
                className="px-3 py-1.5 rounded text-sm"
                style={{ 
                  backgroundColor: colors.bgCard,
                  border: `1px solid ${colors.borderDefault}`,
                  color: colors.textPrimary,
                }}
              >
                <option>Standard</option>
                <option>DPS First</option>
                <option>Healer First</option>
              </select>
              
              <button 
                className="px-3 py-1.5 rounded text-sm"
                style={{ 
                  backgroundColor: colors.bgCard,
                  border: `1px solid ${colors.borderDefault}`,
                  color: colors.textSecondary,
                }}
              >
                G1/G2
              </button>
              
              <div className="flex rounded overflow-hidden" style={{ border: `1px solid ${colors.borderDefault}` }}>
                <button 
                  className="px-3 py-1.5"
                  style={{ backgroundColor: colors.accentDim, color: colors.accent }}
                >
                  ▤
                </button>
                <button 
                  className="px-3 py-1.5"
                  style={{ backgroundColor: colors.bgCard, color: colors.textMuted }}
                >
                  ☰
                </button>
              </div>
            </div>
          </div>
          
          {/* Player Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {mockPlayers.map(player => (
              <MiniPlayerCard key={player.id} player={player} />
            ))}
          </div>
        </div>
      </div>
      
      {/* Design notes */}
      <div className="max-w-7xl mx-auto px-4 py-8 mt-8" style={{ borderTop: `1px solid ${colors.borderSubtle}` }}>
        <h2 style={{ color: colors.accent, fontFamily: 'Cinzel, serif', marginBottom: '16px' }}>
          Design Changes Summary
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 style={{ color: colors.textPrimary, fontWeight: 600, marginBottom: '8px' }}>Header Simplification</h3>
            <ul style={{ color: colors.textSecondary, fontSize: '14px' }} className="space-y-2">
              <li>• Single-row header combining app nav + static context + tier selector</li>
              <li>• Consolidated settings/actions into popover menu (⚙️ icon)</li>
              <li>• Share code integrated inline with static name</li>
              <li>• ~50% vertical space reduction</li>
            </ul>
          </div>
          <div>
            <h3 style={{ color: colors.textPrimary, fontWeight: 600, marginBottom: '8px' }}>Color Palette</h3>
            <ul style={{ color: colors.textSecondary, fontSize: '14px' }} className="space-y-2">
              <li>• Deeper blacks for backgrounds (#060608 → #0c0c10)</li>
              <li>• Subtler borders (#1a1a20 vs #444444)</li>
              <li>• Warmer gold accent (#d4a82a)</li>
              <li>• Softer text contrast for reduced eye strain</li>
              <li>• Role colors unchanged (visual identity preserved)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
