import type { TeamSummary as TeamSummaryType } from '../../types';
import type { RaidTier } from '../../gamedata/raid-tiers';
import { getCurrentTier } from '../../gamedata';
import { Users, Target, Wrench, Calendar, BookOpen } from 'lucide-react';

// Material colors for visual distinction
const MATERIAL_COLORS = {
  twine: 'text-orange-400',
  glaze: 'text-blue-400',
  solvent: 'text-purple-400',
};

interface TeamSummaryProps {
  summary: TeamSummaryType;
  tierInfo?: RaidTier;
}

export function TeamSummary({ summary, tierInfo }: TeamSummaryProps) {
  // Use provided tier or fall back to current tier
  const tier = tierInfo ?? getCurrentTier();

  const totalMaterials = summary.materialsNeeded.twine + summary.materialsNeeded.glaze + summary.materialsNeeded.solvent;

  return (
    <div className="bg-surface-card border border-border-default rounded-lg p-8">
      <h2 className="font-display text-xl text-accent mb-6">Team Summary</h2>
      <p className="text-text-secondary text-sm mb-6 -mt-4">
        Book and material progress for all players. Values show current balance vs. needed.
      </p>

      {/* Main stats - Cards with icons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Players */}
        <div className="bg-surface-base rounded-lg p-4 border border-border-subtle hover:border-border-default transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-accent/10">
              <Users className="w-5 h-5 text-accent" />
            </div>
            <span className="text-text-secondary text-sm">Players</span>
          </div>
          <div className="text-3xl font-bold text-text-primary">
            {summary.totalPlayers}<span className="text-text-muted text-xl">/8</span>
          </div>
        </div>

        {/* BiS Completion */}
        <div className="bg-surface-base rounded-lg p-4 border border-border-subtle hover:border-border-default transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg ${
              summary.completionPercentage === 100
                ? 'bg-status-success/10'
                : summary.completionPercentage >= 50
                  ? 'bg-accent/10'
                  : 'bg-surface-elevated'
            }`}>
              <Target className={`w-5 h-5 ${
                summary.completionPercentage === 100
                  ? 'text-status-success'
                  : summary.completionPercentage >= 50
                    ? 'text-accent'
                    : 'text-text-secondary'
              }`} />
            </div>
            <span className="text-text-secondary text-sm">BiS Complete</span>
          </div>
          <div className={`text-3xl font-bold ${
            summary.completionPercentage === 100
              ? 'text-status-success'
              : summary.completionPercentage >= 50
                ? 'text-accent'
                : 'text-text-primary'
          }`}>
            {summary.completionPercentage}%
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-surface-elevated rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                summary.completionPercentage === 100
                  ? 'bg-status-success'
                  : summary.completionPercentage >= 50
                    ? 'bg-accent'
                    : 'bg-text-muted'
              }`}
              style={{ width: `${summary.completionPercentage}%` }}
            />
          </div>
        </div>

        {/* Upgrades Needed */}
        <div className="bg-surface-base rounded-lg p-4 border border-border-subtle hover:border-border-default transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-surface-elevated">
              <Wrench className="w-5 h-5 text-text-secondary" />
            </div>
            <span className="text-text-secondary text-sm">Upgrades Needed</span>
          </div>
          <div className="text-3xl font-bold text-text-primary">
            {totalMaterials}
          </div>
        </div>

        {/* Weeks to BiS */}
        <div className="bg-surface-base rounded-lg p-4 border border-border-subtle hover:border-border-default transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-surface-elevated">
              <Calendar className="w-5 h-5 text-text-secondary" />
            </div>
            <span className="text-text-secondary text-sm">Weeks to BiS</span>
          </div>
          <div className="text-3xl font-bold text-text-primary">
            {summary.weeksToComplete > 0 ? summary.weeksToComplete : '--'}
          </div>
        </div>
      </div>

      {/* Detailed breakdown */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Upgrade Materials */}
        <div className="bg-surface-base rounded-lg p-5 border border-border-subtle">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="w-4 h-4 text-text-muted" />
            <h3 className="text-text-primary font-medium">Upgrade Materials Needed</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-border-subtle">
              <span className={`font-medium ${MATERIAL_COLORS.twine}`}>
                {tier.upgradeMaterials.twine}
              </span>
              <span className="text-lg font-bold text-text-primary">{summary.materialsNeeded.twine}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border-subtle">
              <span className={`font-medium ${MATERIAL_COLORS.glaze}`}>
                {tier.upgradeMaterials.glaze}
              </span>
              <span className="text-lg font-bold text-text-primary">{summary.materialsNeeded.glaze}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className={`font-medium ${MATERIAL_COLORS.solvent}`}>
                {tier.upgradeMaterials.solvent}
              </span>
              <span className="text-lg font-bold text-text-primary">{summary.materialsNeeded.solvent}</span>
            </div>
          </div>
        </div>

        {/* Books Needed */}
        <div className="bg-surface-base rounded-lg p-5 border border-border-subtle">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-4 h-4 text-text-muted" />
            <h3 className="text-text-primary font-medium">Books Needed (Worst Case)</h3>
          </div>
          <div className="space-y-3">
            {tier.floors.map((floor, index) => (
              <div key={floor} className={`flex justify-between items-center py-2 ${index < tier.floors.length - 1 ? 'border-b border-border-subtle' : ''}`}>
                <span className="text-text-secondary">{floor} Books</span>
                <span className="text-lg font-bold text-text-primary">
                  {summary.booksNeeded[`floor${index + 1}` as keyof typeof summary.booksNeeded]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
