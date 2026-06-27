import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsPanel, SETTINGS_PANEL_WIDTH } from './useSettingsPanel';

describe('useSettingsPanel', () => {
  beforeEach(() => { useSettingsPanel.getState().close(); });

  it('opens and closes', () => {
    useSettingsPanel.getState().open('members');
    expect(useSettingsPanel.getState().isOpen).toBe(true);
    expect(useSettingsPanel.getState().initialTab).toBe('members');
    useSettingsPanel.getState().close();
    expect(useSettingsPanel.getState().isOpen).toBe(false);
  });

  it('toggle flips open state', () => {
    expect(useSettingsPanel.getState().isOpen).toBe(false);
    useSettingsPanel.getState().toggle();
    expect(useSettingsPanel.getState().isOpen).toBe(true);
    useSettingsPanel.getState().toggle();
    expect(useSettingsPanel.getState().isOpen).toBe(false);
  });

  it('toggle with a tab opens to that tab', () => {
    useSettingsPanel.getState().toggle('recruitment');
    expect(useSettingsPanel.getState().isOpen).toBe(true);
    expect(useSettingsPanel.getState().initialTab).toBe('recruitment');
  });

  it('exports a panel width', () => {
    expect(typeof SETTINGS_PANEL_WIDTH).toBe('string');
  });
});
