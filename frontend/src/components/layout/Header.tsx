import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStaticStore } from '../../stores/staticStore';
import { Toast } from '../ui';

export function Header() {
  const { currentStatic } = useStaticStore();
  const [showToast, setShowToast] = useState(false);

  const handleShare = () => {
    if (!currentStatic) return;
    navigator.clipboard.writeText(
      `${window.location.origin}/static/${currentStatic.shareCode}`
    );
    setShowToast(true);
  };

  return (
    <>
      <header className="bg-bg-secondary border-b border-border-default">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="font-display text-xl text-accent hover:text-accent-bright">
              FFXIV Raid Planner
            </Link>
            {currentStatic && (
              <span className="text-text-secondary">
                / {currentStatic.name}
              </span>
            )}
          </div>

          <nav className="flex items-center gap-4">
            {currentStatic ? (
              <button
                className="bg-accent/20 text-accent px-3 py-1 rounded hover:bg-accent/30"
                onClick={handleShare}
              >
                Share
              </button>
            ) : (
              <Link
                to="/create"
                className="bg-accent text-bg-primary px-4 py-2 rounded font-medium hover:bg-accent-bright"
              >
                Create Static
              </Link>
            )}
          </nav>
        </div>
      </header>

      <Toast
        message="Link copied to clipboard!"
        isVisible={showToast}
        onHide={() => setShowToast(false)}
      />
    </>
  );
}
