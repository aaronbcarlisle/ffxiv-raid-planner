import React, { useState } from 'react';

const FFXIVGearingVisual = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const [selectedWeek, setSelectedWeek] = useState(1);
  
  const floors = [
    { id: 1, name: 'M1S', books: 1, color: '#4a7c59', drops: ['Bracelet', 'Earrings', 'Necklace', 'Ring'], bookCost: { accessory: 3 } },
    { id: 2, name: 'M2S', books: 1, color: '#5a8f6a', drops: ['Head', 'Hands', 'Feet', 'Glaze', 'Tome Token'], bookCost: { armor: 4, glaze: 3 } },
    { id: 3, name: 'M3S', books: 1, color: '#6aa27b', drops: ['Body', 'Legs', 'Twine', 'Solvent'], bookCost: { armor: 6, twine: 4, solvent: 4 } },
    { id: 4, name: 'M4S', books: 1, color: '#7ab58c', drops: ['Weapon Coffer', 'Random Weapon', 'Mount'], bookCost: { weapon: 8 } },
  ];

  const weeklyBooks = (week) => ({
    f1: week * 1,
    f2: week * 1,
    f3: week * 1,
    f4: week * 1,
  });

  const canPurchase = (books, cost) => books >= cost;

  const currentBooks = weeklyBooks(selectedWeek);

  const FloorCard = ({ floor }) => (
    <div 
      className="relative overflow-hidden rounded-lg p-4 transition-all duration-300 hover:scale-105"
      style={{ 
        background: `linear-gradient(135deg, ${floor.color}22 0%, ${floor.color}44 100%)`,
        border: `2px solid ${floor.color}`,
        boxShadow: `0 4px 20px ${floor.color}33`
      }}
    >
      <div className="absolute top-0 right-0 w-20 h-20 opacity-10">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <polygon points="100,0 100,100 0,100" fill={floor.color} />
        </svg>
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-bold text-white tracking-wider">{floor.name}</h3>
          <div className="flex items-center gap-1 bg-black/30 px-2 py-1 rounded">
            <span className="text-amber-400 font-mono text-lg">{floor.books}</span>
            <span className="text-amber-200/70 text-xs">books</span>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-widest text-white/50 mb-1">Chest Drops</div>
          {floor.drops.map((drop, i) => (
            <div 
              key={i} 
              className="flex items-center gap-2 text-sm text-white/80 bg-black/20 rounded px-2 py-1"
            >
              <div className="w-2 h-2 rounded-full bg-amber-400/60"></div>
              {drop}
            </div>
          ))}
        </div>
        
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="text-xs uppercase tracking-widest text-white/50 mb-2">Book Costs</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(floor.bookCost).map(([type, cost]) => (
              <span 
                key={type}
                className="text-xs px-2 py-1 rounded bg-black/30 text-amber-200"
              >
                {type}: {cost}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const ChestRulesDiagram = () => (
    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-6 border border-slate-700/50">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5z" />
        </svg>
        Chest Spawn Rules
      </h3>
      
      <div className="space-y-3">
        {[
          { cleared: '0 players', chests: 2, color: 'emerald', desc: 'All fresh' },
          { cleared: '1-4 players', chests: 1, color: 'amber', desc: 'Mixed group' },
          { cleared: '5+ players', chests: 0, color: 'red', desc: 'Mostly cleared' },
        ].map((rule, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className={`w-32 text-sm text-${rule.color}-400 font-medium`}>
              {rule.cleared}
            </div>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex gap-1">
                {[...Array(2)].map((_, j) => (
                  <div 
                    key={j}
                    className={`w-8 h-8 rounded border-2 flex items-center justify-center transition-all
                      ${j < rule.chests 
                        ? `border-${rule.color}-400 bg-${rule.color}-400/20` 
                        : 'border-slate-600 bg-slate-800/50 opacity-30'
                      }`}
                  >
                    <svg className={`w-4 h-4 ${j < rule.chests ? `text-${rule.color}-400` : 'text-slate-600'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v2H2V6zM2 10h16v6a2 2 0 01-2 2H4a2 2 0 01-2-2v-6z" />
                    </svg>
                  </div>
                ))}
              </div>
              <span className="text-slate-400 text-sm">{rule.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const BookProgressTracker = () => (
    <div className="bg-gradient-to-br from-amber-900/20 to-amber-950/40 rounded-xl p-6 border border-amber-700/30">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
        </svg>
        Book Accumulation (Week {selectedWeek})
      </h3>
      
      <div className="mb-4">
        <input
          type="range"
          min="1"
          max="12"
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>Week 1</span>
          <span>Week 12</span>
        </div>
      </div>
      
      <div className="grid grid-cols-4 gap-3">
        {floors.map((floor) => {
          const books = currentBooks[`f${floor.id}`];
          const maxBooks = floor.id === 4 ? 8 : 12; // Max needed for any single purchase type
          const pct = Math.min((books / maxBooks) * 100, 100);
          
          return (
            <div key={floor.id} className="text-center">
              <div className="text-xs text-slate-400 mb-1">Ed. {['I', 'II', 'III', 'IV'][floor.id - 1]}</div>
              <div className="relative h-24 w-full bg-slate-800 rounded overflow-hidden">
                <div 
                  className="absolute bottom-0 w-full transition-all duration-500"
                  style={{ 
                    height: `${pct}%`,
                    background: `linear-gradient(to top, ${floor.color}, ${floor.color}88)`
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white font-bold text-lg drop-shadow-lg">{books}</span>
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-1">{floor.name}</div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-4 pt-4 border-t border-amber-700/30">
        <div className="text-xs text-slate-400 mb-2">Available Purchases:</div>
        <div className="flex flex-wrap gap-2">
          {currentBooks.f1 >= 3 && <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Accessory (3 Ed.I) ✓</span>}
          {currentBooks.f2 >= 4 && <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Minor Armor (4 Ed.II) ✓</span>}
          {currentBooks.f2 >= 3 && <span className="text-xs px-2 py-1 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">Glaze (3 Ed.II) ✓</span>}
          {currentBooks.f3 >= 6 && <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Body/Legs (6 Ed.III) ✓</span>}
          {currentBooks.f3 >= 4 && <span className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">Twine/Solvent (4 Ed.III) ✓</span>}
          {currentBooks.f4 >= 8 && <span className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">Weapon (8 Ed.IV) ✓</span>}
        </div>
      </div>
    </div>
  );

  const UpgradeMaterialFlow = () => (
    <div className="bg-gradient-to-br from-purple-900/20 to-indigo-950/40 rounded-xl p-6 border border-purple-700/30">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
        </svg>
        Upgrade Material Paths (Tome → Augmented)
      </h3>
      
      <div className="space-y-4">
        {[
          { name: 'Twine', target: 'Left Side', slots: ['Head', 'Body', 'Hands', 'Legs', 'Feet'], color: 'rose', source: 'M3S/M7S', books: '4 Ed.III' },
          { name: 'Glaze', target: 'Right Side', slots: ['Earring', 'Neck', 'Wrist', 'Ring', 'Ring'], color: 'cyan', source: 'M2S/M6S', books: '3 Ed.II' },
          { name: 'Solvent', target: 'Weapon', slots: ['Weapon'], color: 'amber', source: 'M3S/M7S', books: '4 Ed.III' },
        ].map((mat) => (
          <div key={mat.name} className="flex items-center gap-4">
            <div className={`w-24 text-center p-2 rounded bg-${mat.color}-500/20 border border-${mat.color}-500/30`}>
              <div className={`text-${mat.color}-400 font-bold`}>{mat.name}</div>
              <div className="text-xs text-slate-500">{mat.source}</div>
              <div className="text-xs text-slate-400">{mat.books}</div>
            </div>
            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <div className="flex-1">
              <div className="text-xs text-slate-400 mb-1">{mat.target}</div>
              <div className="flex gap-1 flex-wrap">
                {mat.slots.map((slot, i) => (
                  <div 
                    key={i}
                    className={`text-xs px-2 py-1 rounded bg-${mat.color}-500/10 text-${mat.color}-300 border border-${mat.color}-500/20`}
                  >
                    {slot}
                  </div>
                ))}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">{mat.slots.length}×8</div>
              <div className="text-xs text-slate-500">= {mat.slots.length * 8} total</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const PrioritySystemCard = ({ title, pros, cons, emoji }) => (
    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50 hover:border-slate-600/50 transition-all">
      <div className="text-xl mb-2">{emoji}</div>
      <h4 className="font-semibold text-white mb-2">{title}</h4>
      <div className="space-y-2 text-sm">
        <div>
          <span className="text-emerald-400 text-xs">+</span>
          <span className="text-slate-300 ml-2">{pros}</span>
        </div>
        <div>
          <span className="text-rose-400 text-xs">−</span>
          <span className="text-slate-400 ml-2">{cons}</span>
        </div>
      </div>
    </div>
  );

  const TimelineView = () => (
    <div className="bg-gradient-to-br from-slate-800/30 to-slate-900/50 rounded-xl p-6 border border-slate-700/50">
      <h3 className="text-lg font-semibold text-white mb-6">Gearing Timeline</h3>
      
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-500 via-amber-500 to-rose-500"></div>
        
        {[
          { weeks: '1-2', phase: 'Early', items: 'First accessories via books', color: 'emerald' },
          { weeks: '3-4', phase: 'Prog', items: 'Minor armor pieces, some upgrades', color: 'emerald' },
          { weeks: '5-6', phase: 'Midtier', items: 'Body/Legs, more upgrades', color: 'amber' },
          { weeks: '7-8', phase: 'Weapons', items: 'Weapon via books available', color: 'amber' },
          { weeks: '9-10', phase: 'Cleanup', items: 'Fill remaining BiS slots', color: 'rose' },
          { weeks: '11+', phase: 'Complete', items: 'Alt jobs, optimization', color: 'rose' },
        ].map((phase, i) => (
          <div key={i} className="relative pl-10 pb-6 last:pb-0">
            <div className={`absolute left-2 w-5 h-5 rounded-full bg-${phase.color}-500 border-4 border-slate-900`}></div>
            <div className={`text-${phase.color}-400 text-sm font-mono mb-1`}>Week {phase.weeks}</div>
            <div className="text-white font-medium">{phase.phase}</div>
            <div className="text-slate-400 text-sm">{phase.items}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const MathFormula = ({ formula, description }) => (
    <div className="bg-slate-900/80 rounded-lg p-4 border border-slate-700/50 font-mono">
      <div className="text-amber-400 text-sm mb-2">{formula}</div>
      <div className="text-slate-400 text-xs">{description}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400 bg-clip-text text-transparent">
            FFXIV Savage Gearing System
          </h1>
          <p className="text-slate-400 text-lg">Understanding the Math Behind Loot Distribution</p>
          <div className="mt-4 flex justify-center gap-2">
            {['overview', 'floors', 'books', 'upgrades', 'priority', 'timeline'].map((section) => (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${activeSection === section 
                    ? 'bg-amber-500 text-slate-900' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
              >
                {section.charAt(0).toUpperCase() + section.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Section */}
        {activeSection === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-950/50 rounded-xl p-6 border border-emerald-700/30 text-center">
                <div className="text-4xl mb-2">🎲</div>
                <h3 className="text-xl font-bold text-emerald-400 mb-2">Direct Drops</h3>
                <p className="text-slate-400 text-sm">RNG-based chest loot from clears. 2 chests per floor when all fresh.</p>
              </div>
              <div className="bg-gradient-to-br from-amber-900/30 to-amber-950/50 rounded-xl p-6 border border-amber-700/30 text-center">
                <div className="text-4xl mb-2">📚</div>
                <h3 className="text-xl font-bold text-amber-400 mb-2">Book Exchange</h3>
                <p className="text-slate-400 text-sm">Guaranteed tokens per clear. Trade for specific gear pieces.</p>
              </div>
              <div className="bg-gradient-to-br from-purple-900/30 to-purple-950/50 rounded-xl p-6 border border-purple-700/30 text-center">
                <div className="text-4xl mb-2">⚡</div>
                <h3 className="text-xl font-bold text-purple-400 mb-2">Tome + Upgrades</h3>
                <p className="text-slate-400 text-sm">Weekly capped currency + savage upgrade materials.</p>
              </div>
            </div>
            
            <ChestRulesDiagram />
            
            <div className="grid grid-cols-2 gap-6">
              <MathFormula 
                formula="P(win) = 1/N = 1/8 = 12.5%"
                description="Probability of winning a single roll with 8 players"
              />
              <MathFormula 
                formula="Books/week = 4 (1 per floor)"
                description="Guaranteed weekly book income from full clear"
              />
            </div>
          </div>
        )}

        {/* Floors Section */}
        {activeSection === 'floors' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              {floors.map((floor) => (
                <FloorCard key={floor.id} floor={floor} />
              ))}
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
              <h3 className="text-lg font-semibold text-white mb-4">Total Books per Full Clear</h3>
              <div className="flex items-center justify-center gap-4">
                {floors.map((floor, i) => (
                  <React.Fragment key={floor.id}>
                    <div className="text-center">
                      <div className="text-2xl font-bold" style={{ color: floor.color }}>{floor.books}</div>
                      <div className="text-xs text-slate-500">Ed. {['I', 'II', 'III', 'IV'][i]}</div>
                    </div>
                    {i < floors.length - 1 && <span className="text-slate-600 text-2xl">+</span>}
                  </React.Fragment>
                ))}
                <span className="text-slate-600 text-2xl">=</span>
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">4</div>
                  <div className="text-xs text-slate-500">per week</div>
                </div>
              </div>
              <div className="mt-4 text-center text-sm text-slate-400">
                Ed.IV can convert 1:1 to any lower edition
              </div>
            </div>
          </div>
        )}

        {/* Books Section */}
        {activeSection === 'books' && (
          <div className="space-y-6">
            <BookProgressTracker />
            
            <div className="grid grid-cols-2 gap-6">
              <MathFormula 
                formula="Weapon = 8 Ed.IV books = 8 weeks"
                description="Slowest book acquisition - weapon"
              />
              <MathFormula 
                formula="Accessory = 3 Ed.I books = 3 weeks"
                description="Fastest book acquisition - accessory"
              />
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
              <h3 className="text-lg font-semibold text-white mb-4">Full BiS via Books Only (No Drops)</h3>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-amber-400">8</div>
                  <div className="text-sm text-slate-400">Ed.IV weeks</div>
                  <div className="text-xs text-slate-500">Weapon</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-400">12</div>
                  <div className="text-sm text-slate-400">Ed.III weeks</div>
                  <div className="text-xs text-slate-500">Body + Legs</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-cyan-400">12</div>
                  <div className="text-sm text-slate-400">Ed.II weeks</div>
                  <div className="text-xs text-slate-500">3× minor armor</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-rose-400">12</div>
                  <div className="text-sm text-slate-400">Ed.I weeks</div>
                  <div className="text-xs text-slate-500">4× accessories</div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-700 text-center">
                <span className="text-slate-400">Bottleneck: </span>
                <span className="text-cyan-400 font-bold">Ed.I/II/III at 12 weeks each</span>
                <div className="text-xs text-slate-500 mt-1">(Ed.IV can convert down to help)</div>
              </div>
            </div>
          </div>
        )}

        {/* Upgrades Section */}
        {activeSection === 'upgrades' && (
          <div className="space-y-6">
            <UpgradeMaterialFlow />
            
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
              <h3 className="text-lg font-semibold text-white mb-4">Static Material Requirements (8 Players)</h3>
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center p-4 rounded-lg bg-rose-500/10 border border-rose-500/20">
                  <div className="text-4xl font-bold text-rose-400">40</div>
                  <div className="text-sm text-slate-400">Twines needed</div>
                  <div className="text-xs text-slate-500">5 per player × 8</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                  <div className="text-4xl font-bold text-cyan-400">40</div>
                  <div className="text-sm text-slate-400">Shines needed</div>
                  <div className="text-xs text-slate-500">5 per player × 8</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="text-4xl font-bold text-amber-400">8</div>
                  <div className="text-sm text-slate-400">Solvents needed</div>
                  <div className="text-xs text-slate-500">1 per player × 8</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Priority Section */}
        {activeSection === 'priority' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <PrioritySystemCard 
                title="Loot Council"
                emoji="👑"
                pros="Optimal raid DPS, flexible decisions"
                cons="Potential bias, requires trust"
              />
              <PrioritySystemCard 
                title="Round Robin"
                emoji="🔄"
                pros="Fair, simple, transparent"
                cons="May not optimize raid DPS"
              />
              <PrioritySystemCard 
                title="DKP System"
                emoji="💰"
                pros="Rewards attendance, self-balancing"
                cons="Can lead to hoarding"
              />
              <PrioritySystemCard 
                title="BiS Priority Lists"
                emoji="📋"
                pros="Pre-planned, reduces drama"
                cons="Requires upfront coordination"
              />
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
              <h3 className="text-lg font-semibold text-white mb-4">Priority Scoring Formula</h3>
              <div className="font-mono text-sm bg-slate-900 rounded-lg p-4 text-amber-400">
                Score = 0.3×(ilvl_upgrade) + 0.3×(stat_weight_gain) + 0.2×(weeks_since_loot) + 0.2×(attendance)
              </div>
              <div className="mt-4 grid grid-cols-4 gap-4 text-center text-sm">
                <div className="p-2 rounded bg-emerald-500/10 text-emerald-400">30% ilvl gain</div>
                <div className="p-2 rounded bg-cyan-500/10 text-cyan-400">30% stat weight</div>
                <div className="p-2 rounded bg-amber-500/10 text-amber-400">20% bad luck</div>
                <div className="p-2 rounded bg-purple-500/10 text-purple-400">20% attendance</div>
              </div>
            </div>
          </div>
        )}

        {/* Timeline Section */}
        {activeSection === 'timeline' && (
          <div className="grid grid-cols-2 gap-6">
            <TimelineView />
            
            <div className="space-y-4">
              <div className="bg-emerald-900/20 rounded-xl p-6 border border-emerald-700/30">
                <h4 className="font-semibold text-emerald-400 mb-2">Phase 1: Progression (Weeks 1-4)</h4>
                <ul className="text-sm text-slate-400 space-y-1">
                  <li>• Clear all floors</li>
                  <li>• Tank/Healer defensive priority</li>
                  <li>• Save books until stable</li>
                </ul>
              </div>
              
              <div className="bg-amber-900/20 rounded-xl p-6 border border-amber-700/30">
                <h4 className="font-semibold text-amber-400 mb-2">Phase 2: Optimization (Weeks 5-10)</h4>
                <ul className="text-sm text-slate-400 space-y-1">
                  <li>• Complete DPS weapons</li>
                  <li>• Body/Legs priority</li>
                  <li>• Balance drops + books</li>
                </ul>
              </div>
              
              <div className="bg-rose-900/20 rounded-xl p-6 border border-rose-700/30">
                <h4 className="font-semibold text-rose-400 mb-2">Phase 3: Cleanup (Weeks 11+)</h4>
                <ul className="text-sm text-slate-400 space-y-1">
                  <li>• Fill remaining gaps</li>
                  <li>• Alt job gearing</li>
                  <li>• Substat optimization</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-slate-500 text-sm">
          <p>For use with FFXIV Raid Planner Tool</p>
        </div>
      </div>
    </div>
  );
};

export default FFXIVGearingVisual;
