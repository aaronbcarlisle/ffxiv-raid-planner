import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { LoginButton } from '../components/auth';

export function Home() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuthStore();
  const [shareCode, setShareCode] = useState('');

  const handleViewStatic = (e: React.FormEvent) => {
    e.preventDefault();
    if (shareCode.trim()) {
      navigate(`/group/${shareCode.trim()}`);
    }
  };

  return (
    <div className="text-center py-16">
      <h1 className="font-display text-4xl text-accent mb-4">
        FFXIV Savage Raid Planner
      </h1>
      <p className="text-text-secondary text-lg mb-8 max-w-2xl mx-auto">
        Track gear progress, manage loot distribution, and coordinate your static.
      </p>

      {/* Primary CTA */}
      <div className="mb-8">
        {isLoading ? (
          <div className="w-10 h-10 mx-auto border-2 border-accent border-t-transparent rounded-full animate-spin" />
        ) : isAuthenticated ? (
          <Link
            to="/dashboard"
            className="inline-block bg-accent text-bg-primary px-8 py-4 rounded-lg font-medium text-lg hover:bg-accent-bright transition-colors"
          >
            Go to My Statics
          </Link>
        ) : (
          <div className="flex justify-center">
            <LoginButton className="bg-accent text-bg-primary px-8 py-4 rounded-lg font-medium text-lg hover:bg-accent-bright transition-colors" />
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 max-w-md mx-auto mb-8">
        <div className="flex-1 border-t border-white/10" />
        <span className="text-text-muted text-sm">or view a public static</span>
        <div className="flex-1 border-t border-white/10" />
      </div>

      {/* Share code input */}
      <form onSubmit={handleViewStatic} className="flex items-center gap-2 justify-center mb-16">
        <input
          type="text"
          value={shareCode}
          onChange={(e) => setShareCode(e.target.value.toUpperCase())}
          placeholder="Enter share code..."
          maxLength={8}
          className="bg-bg-secondary border border-border-default rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none w-48 text-center font-mono uppercase"
        />
        <button
          type="submit"
          disabled={!shareCode.trim()}
          className="bg-bg-secondary border border-border-default px-6 py-3 rounded-lg text-text-primary hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          View
        </button>
      </form>

      {/* Feature cards */}
      <div className="grid md:grid-cols-3 gap-6 text-left max-w-4xl mx-auto">
        <div className="bg-bg-card p-6 rounded-lg border border-border-default">
          <h3 className="font-display text-lg text-accent mb-2">Gear Tracking</h3>
          <p className="text-text-secondary text-sm">
            Track BiS progress for your entire static. See who needs what at a glance.
          </p>
        </div>
        <div className="bg-bg-card p-6 rounded-lg border border-border-default">
          <h3 className="font-display text-lg text-accent mb-2">Loot Priority</h3>
          <p className="text-text-secondary text-sm">
            Smart loot suggestions based on need, role priority, and past distributions.
          </p>
        </div>
        <div className="bg-bg-card p-6 rounded-lg border border-border-default">
          <h3 className="font-display text-lg text-accent mb-2">Team Summary</h3>
          <p className="text-text-secondary text-sm">
            See total materials needed, books required, and estimated weeks to BiS.
          </p>
        </div>
      </div>

      {/* Multi-tier feature highlight */}
      <div className="mt-12 max-w-2xl mx-auto bg-bg-card p-6 rounded-lg border border-accent/20">
        <h3 className="font-display text-lg text-accent mb-2">Multi-Tier Support</h3>
        <p className="text-text-secondary text-sm">
          Keep your roster across raid tiers. Roll over from M1S-M4S to M5S-M8S without losing your setup.
          Switch between tiers anytime to view historical progress.
        </p>
      </div>
    </div>
  );
}
