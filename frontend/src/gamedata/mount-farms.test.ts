import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

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
import { TAB_ICONS } from '../types';

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
  'Dancing Mad (Ultimate)',
];

const CURATED_ULTIMATE_EXCHANGES = [
  { id: 'ult-ucob', expansion: 'SB', patch: '4.11', dutyName: 'The Unending Coil of Bahamut (Ultimate)', rewardName: 'Ultimate Dreadwyrm Weapons', tokenName: 'Dreadwyrm Totem', exchangeNpc: 'Eschina', exchangeLocation: "Rhalgr's Reach" },
  { id: 'ult-uwu', expansion: 'SB', patch: '4.31', dutyName: "The Weapon's Refrain (Ultimate)", rewardName: 'Ultima Weapons', tokenName: 'Ultima Totem', exchangeNpc: 'Eschina', exchangeLocation: "Rhalgr's Reach" },
  { id: 'ult-tea', expansion: 'ShB', patch: '5.11', dutyName: 'The Epic of Alexander (Ultimate)', rewardName: 'Ultimate Alexander Weapons', tokenName: 'Colossus Totem', exchangeNpc: 'Bertana', exchangeLocation: 'Idyllshire' },
  { id: 'ult-dsr', expansion: 'EW', patch: '6.11', dutyName: "Dragonsong's Reprise (Ultimate)", rewardName: 'Ultimate Weapons of the Heavens', tokenName: 'Dragonsong Totem', exchangeNpc: 'Nesvaaz', exchangeLocation: 'Radz-at-Han' },
  { id: 'ult-top', expansion: 'EW', patch: '6.31', dutyName: 'The Omega Protocol (Ultimate)', rewardName: 'Ultimate Omega Weapons', tokenName: 'Omega Totem', exchangeNpc: 'Nesvaaz', exchangeLocation: 'Radz-at-Han' },
  { id: 'ult-fru', expansion: 'DT', patch: '7.11', dutyName: 'Futures Rewritten (Ultimate)', rewardName: 'Ultimate Edenmorn Weapons', tokenName: 'Oracle Totem', exchangeNpc: "Uah'shepya", exchangeLocation: 'Solution Nine' },
  { id: 'ult-dmu', expansion: 'DT', patch: '7.51', dutyName: 'Dancing Mad (Ultimate)', rewardName: 'Palazzo Diamond Weapons', tokenName: "Mad Harlequin's Totem", exchangeNpc: "Uah'shepya", exchangeLocation: 'Solution Nine' },
];

describe('Mount Farm catalog', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );
  });

  it('uses the upstream static Mount Farms nav icon asset', () => {
    expect(TAB_ICONS.mountFarms).toBe('/icons/mount-farms-transparent-bg.png');
  });

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

  it('adds curated Ultimate weapon farms with reviewed one-token exchange metadata', () => {
    const ultimateEntries = MOUNT_FARM_TRIALS.filter(trial => trial.contentType === 'ultimate');

    expect(ultimateEntries.map(trial => trial.dutyName)).toEqual(CURATED_ULTIMATE_DUTIES);
    for (const expected of CURATED_ULTIMATE_EXCHANGES) {
      const trial = getTrialById(expected.id);
      expect(trial).toMatchObject({
        expansion: expected.expansion,
        patch: expected.patch,
        dutyName: expected.dutyName,
        rewardType: 'weapon',
        contentType: 'ultimate',
        category: 'ultimate',
        mountName: expected.rewardName,
        totemName: expected.tokenName,
        currencyItemName: expected.tokenName,
        currencyPerClear: 1,
        exchangeCost: 1,
        exchangeNpc: expected.exchangeNpc,
        exchangeLocation: expected.exchangeLocation,
        exchangeStatus: 'available',
      });
      expect(trial?.totemTarget).toBe(1);
      expect(getRewardLabel(trial!)).toBe(expected.rewardName);
      expect(getRewardNoun(trial!)).toBe('weapon');
      expect(hasCurrencyTracking(trial!)).toBe(true);
      expect(getExchangeSummary(trial!)).toBe(
        `1 ${expected.tokenName} for ${expected.rewardName} at ${expected.exchangeNpc} in ${expected.exchangeLocation}`
      );
    }
  });

  it('keeps Ultimate entries out of mount-specific 99-token assumptions', () => {
    const ultimateEntries = MOUNT_FARM_TRIALS.filter(trial => trial.contentType === 'ultimate');

    for (const trial of ultimateEntries) {
      expect(trial.rewardType).toBe('weapon');
      expect(trial.category).toBe('ultimate');
      expect(trial.mountId).toBeNull();
      expect(trial.totemTarget).not.toBe(99);
      expect(trial.exchangeCost).not.toBe(99);
      expect(getRewardNoun(trial)).toBe('weapon');
      expect(getExchangeSummary(trial)).not.toMatch(/99/);
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
    expect(screen.getByText("1 Oracle Totem for Ultimate Edenmorn Weapons at Uah'shepya in Solution Nine")).toBeTruthy();
    expect(screen.getByText('Ultimate')).toBeTruthy();
    expect(screen.queryByText(/99/)).toBeNull();
  });

  it('keeps static member currency cells compact without repeating the full item name', () => {
    const windward = getTrialById('dt-windward-wilds');
    expect(windward).toBeDefined();

    render(createElement(MountFarmSummary, {
      trials: [windward!],
      trialSummaryMap: new Map([[
        'dt-windward-wilds',
        {
          trialId: 'dt-windward-wilds',
          totalMembers: 1,
          membersComplete: 0,
          membersMissing: 1,
          membersWanting: 1,
          membersCanBuy: 0,
          memberProgress: [{
            userId: 'user-1',
            displayName: 'Rin',
            discordUsername: null,
            discordAvatar: null,
            hasMount: false,
            wantsMount: true,
            totemCount: 0,
            notes: null,
            ownershipSource: 'manual' as const,
            totemSource: 'manual' as const,
            updatedAt: '2026-06-08T00:00:00Z',
            lastImportedAt: null,
            lastPluginSyncAt: null,
            lastManualOverrideAt: null,
            trialId: 'dt-windward-wilds',
          }],
        },
      ]]),
      currentUserId: 'user-1',
      groupId: 'group-1',
      canManage: true,
      viewMode: 'group',
      onRefresh: () => {},
    }));

    fireEvent.click(screen.getByText('The Windward Wilds (Extreme)'));

    expect(screen.getByText('Progress')).toBeTruthy();
    expect(screen.getByText('0 / 99')).toBeTruthy();
    expect(screen.getByText('certificates')).toBeTruthy();
    expect(screen.queryByText(/0\s*\/\s*99\s+Guardian Arkveld Certificate/i)).toBeNull();
  });
});
