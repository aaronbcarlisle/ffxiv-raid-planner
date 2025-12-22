import { Link } from 'react-router-dom';

export function Home() {
  return (
    <div className="text-center py-16">
      <h1 className="font-display text-4xl text-accent mb-4">
        FFXIV Savage Raid Planner
      </h1>
      <p className="text-text-secondary text-lg mb-8 max-w-2xl mx-auto">
        Track gear, manage loot distribution, and coordinate your static.
        Free, no account required.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          to="/create"
          className="bg-accent text-bg-primary px-6 py-3 rounded-lg font-medium hover:bg-accent-bright transition-colors"
        >
          Create New Static
        </Link>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Enter share code..."
            className="bg-bg-secondary border border-border-default rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          <button className="bg-bg-secondary border border-border-default px-4 py-3 rounded-lg text-text-primary hover:border-accent">
            Join
          </button>
        </div>
      </div>

      <div className="mt-16 grid md:grid-cols-3 gap-6 text-left max-w-4xl mx-auto">
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
    </div>
  );
}
