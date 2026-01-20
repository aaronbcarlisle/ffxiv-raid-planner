/**
 * BiS Source Detection Utilities
 *
 * Functions for detecting miscategorized gear BiS sources based on item names.
 * Uses the same name-based pattern matching as the backend (bis.py).
 */

import type { GearSlotStatus, GearSource } from '../types';

// Name patterns for detecting gear source miscategorization
// These patterns match item names from various expansion tiers
// NOTE: Keep in sync with backend/app/routers/bis.py determine_source() patterns
const CRAFTED_PATTERNS = [
  'claro-',        // 7.4 crafted
  'agonist',       // 7.2 crafted
  'archeo kingdom',// 7.0 crafted
  'diadochos',     // 6.4 crafted
  'rinascita',     // 6.2 crafted
  'classical',     // 6.0 crafted
  'pactmaker',     // 6.x crafted
];

const TOME_PATTERNS = [
  'bygone',        // 7.4 tome
  'quetzalli',     // 7.2 tome
  'neo kingdom',   // 7.0 tome
  'credendum',     // 6.x tome
  'lunar envoy',   // 6.4 tome
  'moonward',      // 6.0 tome
  'radiant',       // Other tome
];

/**
 * Check if a gear slot is miscategorized and return the correct BiS source.
 * Returns null if the slot is correctly categorized or can't be determined.
 *
 * Uses name-based pattern matching (same approach as backend bis.py) rather than
 * item level, which avoids false positives on old-tier gear.
 *
 * Detects:
 * - crafted: item name matches crafted pattern but bisSource !== 'crafted'
 * - base_tome: item name matches tome pattern, no "Aug." prefix, and bisSource !== 'base_tome'
 */
export function getCorrectBisSource(status: GearSlotStatus): GearSource | null {
  // No item name = can't determine
  if (!status.itemName) return null;

  const nameLower = status.itemName.toLowerCase();

  // Check for crafted miscategorization:
  // Name matches crafted pattern but bisSource isn't 'crafted'
  if (status.bisSource !== 'crafted') {
    for (const pattern of CRAFTED_PATTERNS) {
      if (nameLower.includes(pattern)) {
        return 'crafted';
      }
    }
  }

  // Check for base_tome miscategorization:
  // Name matches tome pattern, doesn't have "Aug." prefix, but bisSource isn't 'base_tome'
  // This catches cases where base tome items are incorrectly set to 'tome' (augmented)
  if (status.bisSource !== 'base_tome') {
    const hasAugPrefix = nameLower.startsWith('aug.') || nameLower.startsWith('augmented');
    if (!hasAugPrefix) {
      for (const pattern of TOME_PATTERNS) {
        if (nameLower.includes(pattern)) {
          return 'base_tome';
        }
      }
    }
  }

  return null;
}

/**
 * Get all gear slots that need BiS source fixes.
 * Returns an array of { slot, currentSource, correctSource } objects.
 */
export function getMiscategorizedSlots(gear: GearSlotStatus[]): Array<{
  slot: string;
  currentSource: GearSource | null;
  correctSource: GearSource;
}> {
  const miscategorized: Array<{
    slot: string;
    currentSource: GearSource | null;
    correctSource: GearSource;
  }> = [];

  for (const status of gear) {
    // Skip weapon - it has special handling
    if (status.slot === 'weapon') continue;

    const correctSource = getCorrectBisSource(status);
    if (correctSource) {
      miscategorized.push({
        slot: status.slot,
        currentSource: status.bisSource,
        correctSource,
      });
    }
  }

  return miscategorized;
}
