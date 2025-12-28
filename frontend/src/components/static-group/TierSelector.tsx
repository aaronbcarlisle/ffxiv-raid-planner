/**
 * Tier Selector
 *
 * Dropdown for switching between tier snapshots.
 * Shows current tier name, dropdown only lists other available tiers.
 */

import { useState, useRef, useEffect } from 'react';
import { getTierById } from '../../gamedata';
import type { TierSnapshot } from '../../types';

interface TierSelectorProps {
  tiers: TierSnapshot[];
  currentTierId?: string;
  onTierChange: (tierId: string) => void;
}

export function TierSelector({
  tiers,
  currentTierId,
  onTierChange,
}: TierSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get current tier info
  const currentTier = tiers.find((t) => t.tierId === currentTierId);
  const currentTierInfo = currentTier ? getTierById(currentTier.tierId) : null;

  // Get other tiers (exclude current)
  const otherTiers = tiers.filter((t) => t.tierId !== currentTierId);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (tiers.length === 0) return null;

  const handleTierSelect = (tierId: string) => {
    onTierChange(tierId);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Current tier button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-bg-card border border-border-default rounded hover:border-accent/30 transition-colors"
      >
        <span className="text-text-primary text-sm">
          {currentTierInfo?.name || currentTierId || 'Select Tier'}
        </span>
        {otherTiers.length > 0 && (
          <svg
            className={`w-4 h-4 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Dropdown menu */}
      {isOpen && otherTiers.length > 0 && (
        <div className="absolute top-full left-0 mt-1 min-w-full bg-bg-elevated border border-border-default rounded-lg shadow-xl z-50 py-1">
          {otherTiers.map((tier) => {
            const info = getTierById(tier.tierId);
            return (
              <button
                key={tier.tierId}
                onClick={() => handleTierSelect(tier.tierId)}
                className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors whitespace-nowrap"
              >
                {info?.name || tier.tierId}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
