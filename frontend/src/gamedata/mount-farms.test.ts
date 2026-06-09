import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';

import {
  MOUNT_FARM_TRIALS,
  getExchangeSummary,
  getTrialById,
  getRewardLabel,
  getRewardNoun,
  hasCurrencyTracking,
  getTrialsByExpansion,
} from './mount-farms';
import { MountFarmSummary } from '../components/mount-farms/MountFarmSummary';

const CURATED_DAWNTRAIL_DUTIES = [
  'Worqor Lar Dor (Extreme)',
  'Everkeep (Extreme)',
  "The Minstrel's Ballad: Sphene's Burden",
  'Recollection (Extreme)',
  "The Minstrel's Ballad: Necron's Embrace",
  'The Windward Wilds (Extreme)',
  'Hell on Rails (Extreme)',
  'The Unmaking (Extreme)',
];

const BOGUS_DAWNTRAIL_DUTIES = [
  'Senary Unaspected Aetherial Node (Extreme)',
  'Senary Unexpected Aetherial Node (Extreme)',
  'Blasting Zone (Extreme)',
];

const CURATED_ULTIMATE_DUTIES = [
  'The Unending Coil of Bahamut (Ultimate)',
  "The Weapon's Refrain (Ultimate)",
  'The Epic of Alexander (Ultimate)',
  "Dragonsong's Reprise (Ultimate)",
  'The Omega Protocol (Ultimate)',
  'Futures Rewritten (Ultimate)',
];

describe('Mount Farm catalog', () => {
  it('uses the curated Dawntrail Extreme trial allowlist', () => {
    const dawntrailNames = getTrialsByExpansion('DT')
      .filter(trial => trial.contentType !== 'ultimate')
      .map(trial => trial.dutyName);

    expect(dawntrailNames).toEqual(CURATED_DAWNTRAIL_DUTIES);
  });

  it('does not include bogus generated Dawntrail entries', () => {
    const catalogText = MOUNT_FARM_TRIALS.flatMap(trial => [
      trial.dutyName,
      trial.sourceContent,
      trial.mountName,
    ]);

    for (const bogus of BOGUS_DAWNTRAIL_DUTIES) {
      expect(catalogText).not.toContain(bogus);
    }
  });

  it('requires curated source, reward, and farm metadata for every entry', () => {
    for (const trial of MOUNT_FARM_TRIALS) {
      expect(trial.sourceContent).toBe(trial.dutyName);
      expect(trial.mountName).toBeTruthy();
      expect(trial.rewardName).toBeTruthy();
      expect(trial.rewardType).toMatch(/mount|weapon|currency|title|misc/);
      expect(trial.contentType).toMatch(/extreme_trial|ultimate|collaboration|raid|other/);
      expect(trial.category).toMatch(/normal|collaboration|ultimate|special/);
      if (trial.rewardType === 'mount') {
        expect(trial.totemName).toBeTruthy();
        expect(trial.totemTarget).toBe(99);
        expect(trial.currencyPerClear).toBeGreaterThan(0);
      }
    }
  });

  it('labels Windward Wilds as a collaboration certificate exchange', () => {
    const windward = getTrialsByExpansion('DT').find(
      trial => trial.id === 'dt-windward-wilds'
    );

    expect(windward).toMatchObject({
      category: 'collaboration',
      contentType: 'collaboration',
      totemName: 'Guardian Arkveld Certificate',
      currencyItemName: 'Guardian Arkveld Certificate',
      currencyPerClear: 2,
      exchangeNpc: 'Smithy',
      exchangeLocation: 'Tuliyollal',
    });
    expect(getExchangeSummary(windward!)).toBe(
      '99 Guardian Arkveld Certificates for Felyne Support Team Cart Horn at Smithy in Tuliyollal'
    );
  });

  it('shows pending copy for not-yet-exchangeable mounts', () => {
    const hellOnRails = getTrialsByExpansion('DT').find(
      trial => trial.id === 'dt-hell-on-rails'
    );
    const unmaking = getTrialsByExpansion('DT').find(
      trial => trial.id === 'dt-unmaking'
    );

    expect(getExchangeSummary(hellOnRails!)).toBe('Exchange not available yet');
    expect(getExchangeSummary(unmaking!)).toBe('Exchange not available yet');
  });

  it('adds curated Ultimate weapon farms without mount or 99-token assumptions', () => {
    const ultimateEntries = MOUNT_FARM_TRIALS.filter(trial => trial.contentType === 'ultimate');

    expect(ultimateEntries.map(trial => trial.dutyName)).toEqual(CURATED_ULTIMATE_DUTIES);
    for (const trial of ultimateEntries) {
      expect(trial.rewardType).toBe('weapon');
      expect(trial.category).toBe('ultimate');
      expect(trial.totemName).toBeNull();
      expect(trial.currencyItemName).toBeNull();
      expect(trial.totemTarget).toBe(0);
      expect(trial.exchangeCost).toBeUndefined();
      expect(trial.exchangeStatus).toBe('unknown');
      expect(getRewardLabel(trial)).toBe('Ultimate weapon coffer / weapon exchange');
      expect(getRewardNoun(trial)).toBe('weapon');
      expect(hasCurrencyTracking(trial)).toBe(false);
      expect(getExchangeSummary(trial)).toBe('Weapon/token farm');
    }
  });

  it('renders Ultimate entries with reward farm copy instead of mount-specific currency copy', () => {
    const fru = getTrialById('ult-fru');
    expect(fru).toBeDefined();

    render(createElement(MountFarmSummary, {
      trials: [fru!],
      trialSummaryMap: new Map(),
      currentUserId: null,
      groupId: 'group-1',
      canManage: false,
      viewMode: 'group',
      onRefresh: () => {},
    }));

    expect(screen.getByText('Futures Rewritten (Ultimate)')).toBeTruthy();
    expect(screen.getByText('Weapon/token farm')).toBeTruthy();
    expect(screen.getByText('Ultimate')).toBeTruthy();
    expect(screen.queryByText(/totem/i)).toBeNull();
    expect(screen.queryByText(/99/)).toBeNull();
  });
});
