/**
 * toast.withUndo (S2a-2·F5 Task TF7, R-S2-11): a success toast carrying an "Undo" action,
 * offered for 8 s unless told otherwise. A new file, so `toastStore` has no pin to edit.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast, useToastStore } from './toastStore';

afterEach(() => useToastStore.getState().clearAll());

describe('toast.withUndo', () => {
  it('adds a success toast whose action is "Undo", and the action runs the callback', () => {
    const onUndo = vi.fn();
    const id = toast.withUndo('Need saved', onUndo);

    const [added] = useToastStore.getState().toasts;
    expect(added).toMatchObject({ id, type: 'success', message: 'Need saved', duration: 8000 });
    expect(added.action?.label).toBe('Undo');
    added.action?.onClick();
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('takes a duration of its own', () => {
    toast.withUndo('Have saved', () => {}, 1234);
    expect(useToastStore.getState().toasts[0].duration).toBe(1234);
  });
});
