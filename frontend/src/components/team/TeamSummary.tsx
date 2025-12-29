import type { TeamSummary as TeamSummaryType } from '../../types';
import { getCurrentTier } from '../../gamedata';

interface TeamSummaryProps {
  summary: TeamSummaryType;
}

export function TeamSummary({ summary }: TeamSummaryProps) {
  const tier = getCurrentTier();

  return (
    <div className="bg-surface-card border border-border-default rounded-lg p-6">
      <h2 className="font-display text-xl text-accent mb-4">Team Summary</h2>

      {/* Main stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center mb-6">
        <div>
          <div className="text-2xl font-bold text-text-primary">
            {summary.totalPlayers}/8
          </div>
          <div className="text-text-secondary text-sm">Players</div>
        </div>
        <div>
          <div className={`text-2xl font-bold ${
            summary.completionPercentage === 100
              ? 'text-status-success'
              : summary.completionPercentage >= 50
                ? 'text-status-warning'
                : 'text-text-primary'
          }`}>
            {summary.completionPercentage}%
          </div>
          <div className="text-text-secondary text-sm">BiS Complete</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-text-primary">
            {summary.materialsNeeded.twine + summary.materialsNeeded.glaze + summary.materialsNeeded.solvent}
          </div>
          <div className="text-text-secondary text-sm">Upgrades Needed</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-text-primary">
            {summary.weeksToComplete > 0 ? summary.weeksToComplete : '--'}
          </div>
          <div className="text-text-secondary text-sm">Weeks to BiS</div>
        </div>
      </div>

      {/* Detailed breakdown */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Upgrade Materials */}
        <div className="bg-surface-base rounded-lg p-4">
          <h3 className="text-text-secondary text-sm mb-2">Upgrade Materials Needed</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">{tier.upgradeMaterials.twine}</span>
              <span className="font-medium text-text-primary">{summary.materialsNeeded.twine}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">{tier.upgradeMaterials.glaze}</span>
              <span className="font-medium text-text-primary">{summary.materialsNeeded.glaze}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">{tier.upgradeMaterials.solvent}</span>
              <span className="font-medium text-text-primary">{summary.materialsNeeded.solvent}</span>
            </div>
          </div>
        </div>

        {/* Books Needed */}
        <div className="bg-surface-base rounded-lg p-4">
          <h3 className="text-text-secondary text-sm mb-2">Books Needed (Worst Case)</h3>
          <div className="space-y-2">
            {tier.floors.map((floor, index) => (
              <div key={floor} className="flex justify-between items-center">
                <span className="text-text-secondary">{floor} Books</span>
                <span className="font-medium text-text-primary">
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
