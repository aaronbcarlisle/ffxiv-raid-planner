import { describe, expect, it } from 'vitest';
import { buildScheduleDraftFromContent } from './sessionDrafts';

describe('buildScheduleDraftFromContent', () => {
  it('creates an Ultimate draft for Futures Rewritten without Mount Farm copy', () => {
    const draft = buildScheduleDraftFromContent({
      trialId: 'ult-fru',
      trialName: 'Futures Rewritten (Ultimate)',
    }, 'Asia/Tokyo');

    expect(draft.category).toBe('ultimate');
    expect(draft.contentId).toBe('ult-fru');
    expect(draft.contentName).toBe('Futures Rewritten (Ultimate)');
    expect(draft.title).toBe('Futures Rewritten (Ultimate)');
    expect(draft.description).toBe('Session for Futures Rewritten (Ultimate).');
    expect(draft.title).not.toContain('Mount Farm');
    expect(draft.description).not.toContain('Mount farm');
  });

  it('keeps regular farm requests as Mount Farm drafts with clean spacing', () => {
    const draft = buildScheduleDraftFromContent({
      trialId: 'dt-valigarmanda',
      trialName: 'Worqor Lar Dor (Extreme)',
      missing: 2,
      canBuy: 1,
      wanting: 3,
    }, 'Asia/Tokyo');

    expect(draft.category).toBe('farm');
    expect(draft.contentId).toBe('dt-valigarmanda');
    expect(draft.contentName).toBe('Worqor Lar Dor (Extreme)');
    expect(draft.title).toBe('Mount Farm: Worqor Lar Dor (Extreme)');
    expect(draft.description).toContain('Mount farm for Worqor Lar Dor (Extreme). 2 members still need this mount.');
    expect(draft.description).toContain('1 can buy with Skyruin Totems.');
    expect(draft.description).not.toContain('(Extreme).2');
  });

  it('respects explicit non-farm category context', () => {
    const draft = buildScheduleDraftFromContent({
      trialName: 'AAC Light-heavyweight M4 (Savage)',
      contentType: 'raid',
      category: 'raid',
    }, 'Asia/Tokyo');

    expect(draft.category).toBe('raid');
    expect(draft.title).toBe('AAC Light-heavyweight M4 (Savage)');
    expect(draft.description).toBe('Session for AAC Light-heavyweight M4 (Savage).');
    expect(draft.contentName).toBe('AAC Light-heavyweight M4 (Savage)');
  });
});
