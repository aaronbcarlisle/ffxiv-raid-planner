import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentTier, getTierOptions } from '../gamedata';
import { useStaticStore } from '../stores/staticStore';

export function CreateStatic() {
  const navigate = useNavigate();
  const currentTier = getCurrentTier();
  const tierOptions = getTierOptions();
  const { createNewStatic, error } = useStaticStore();

  const [name, setName] = useState('');
  const [tierId, setTierId] = useState(currentTier.id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const staticData = await createNewStatic(name.trim(), tierId);
      navigate(`/static/${staticData.shareCode}`);
    } catch (err) {
      setSubmitError(error || 'Failed to create static. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto py-8">
      <h1 className="font-display text-3xl text-accent mb-6">Create New Static</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-text-secondary mb-2">
            Static Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Chaos Raiders"
            className="w-full bg-bg-secondary border border-border-default rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            required
          />
        </div>

        <div>
          <label htmlFor="tier" className="block text-text-secondary mb-2">
            Raid Tier
          </label>
          <select
            id="tier"
            value={tierId}
            onChange={(e) => setTierId(e.target.value)}
            className="w-full bg-bg-secondary border border-border-default rounded-lg px-4 py-3 text-text-primary focus:border-accent focus:outline-none"
          >
            {tierOptions.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.name}
              </option>
            ))}
          </select>
        </div>

        {submitError && (
          <div className="text-status-error text-sm">{submitError}</div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          className="w-full bg-accent text-bg-primary px-6 py-3 rounded-lg font-medium hover:bg-accent-bright transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Creating...' : 'Create Static'}
        </button>
      </form>
    </div>
  );
}
