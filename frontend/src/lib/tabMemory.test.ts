import { describe, it, expect, beforeEach } from 'vitest';
import { recallTab, rememberTab, tabKey } from './tabMemory';
import { useAuthStore } from '../stores/authStore';

const VALID = ['a', 'b', 'c'] as const;

function setMode(mode: 'remember' | 'reset') {
  // @ts-expect-error partial user for test
  useAuthStore.setState({ user: { id: 'u', tabPersistence: mode } });
}

describe('tabMemory', () => {
  beforeEach(() => { localStorage.clear(); });

  it('tabKey scopes per static', () => {
    expect(tabKey('group-view-tab')).toBe('group-view-tab');
    expect(tabKey('group-view-tab', 'abc')).toBe('group-view-tab:abc');
  });

  it('remember mode restores a stored value', () => {
    setMode('remember');
    rememberTab('k', 'b');
    expect(recallTab('k', VALID, 'a')).toBe('b');
  });

  it('reset mode ignores stored value and does not write', () => {
    setMode('remember');
    rememberTab('k', 'c');
    setMode('reset');
    expect(recallTab('k', VALID, 'a')).toBe('a');
    rememberTab('k', 'b'); // no-op in reset mode
    setMode('remember');
    expect(recallTab('k', VALID, 'a')).toBe('c'); // unchanged from earlier write
  });

  it('falls back when stored value is invalid', () => {
    setMode('remember');
    localStorage.setItem('k', 'zzz');
    expect(recallTab('k', VALID, 'a')).toBe('a');
  });
});
