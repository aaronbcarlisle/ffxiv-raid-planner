/**
 * Unit tests for the useModal hooks
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModal, useModalWithData } from './useModal';

describe('useModal', () => {
  describe('initial state', () => {
    it('defaults to closed', () => {
      const { result } = renderHook(() => useModal());
      expect(result.current.isOpen).toBe(false);
    });

    it('respects initial state parameter', () => {
      const { result } = renderHook(() => useModal(true));
      expect(result.current.isOpen).toBe(true);
    });
  });

  describe('open', () => {
    it('opens the modal', () => {
      const { result } = renderHook(() => useModal());

      act(() => {
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('is idempotent when already open', () => {
      const { result } = renderHook(() => useModal(true));

      act(() => {
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);
    });
  });

  describe('close', () => {
    it('closes the modal', () => {
      const { result } = renderHook(() => useModal(true));

      act(() => {
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('is idempotent when already closed', () => {
      const { result } = renderHook(() => useModal());

      act(() => {
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('toggle', () => {
    it('opens when closed', () => {
      const { result } = renderHook(() => useModal());

      act(() => {
        result.current.toggle();
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('closes when open', () => {
      const { result } = renderHook(() => useModal(true));

      act(() => {
        result.current.toggle();
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('works correctly on multiple toggles', () => {
      const { result } = renderHook(() => useModal());

      act(() => {
        result.current.toggle();
      });
      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.toggle();
      });
      expect(result.current.isOpen).toBe(false);

      act(() => {
        result.current.toggle();
      });
      expect(result.current.isOpen).toBe(true);
    });
  });

  describe('reference stability', () => {
    it('maintains stable function references', () => {
      const { result, rerender } = renderHook(() => useModal());

      const { open: open1, close: close1, toggle: toggle1 } = result.current;

      rerender();

      const { open: open2, close: close2, toggle: toggle2 } = result.current;

      expect(open1).toBe(open2);
      expect(close1).toBe(close2);
      expect(toggle1).toBe(toggle2);
    });
  });
});

describe('useModalWithData', () => {
  interface TestData {
    id: string;
    name: string;
  }

  describe('initial state', () => {
    it('defaults to closed with null data', () => {
      const { result } = renderHook(() => useModalWithData<TestData>());

      expect(result.current.isOpen).toBe(false);
      expect(result.current.data).toBeNull();
    });

    it('respects initial state parameter', () => {
      const { result } = renderHook(() => useModalWithData<TestData>(true));

      expect(result.current.isOpen).toBe(true);
      expect(result.current.data).toBeNull();
    });
  });

  describe('open', () => {
    it('opens without data', () => {
      const { result } = renderHook(() => useModalWithData<TestData>());

      act(() => {
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.data).toBeNull();
    });

    it('opens with data', () => {
      const { result } = renderHook(() => useModalWithData<TestData>());
      const testData: TestData = { id: '123', name: 'Test' };

      act(() => {
        result.current.open(testData);
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.data).toEqual(testData);
    });

    it('replaces existing data when reopened with new data', () => {
      const { result } = renderHook(() => useModalWithData<TestData>());
      const data1: TestData = { id: '1', name: 'First' };
      const data2: TestData = { id: '2', name: 'Second' };

      act(() => {
        result.current.open(data1);
      });
      expect(result.current.data).toEqual(data1);

      act(() => {
        result.current.open(data2);
      });
      expect(result.current.data).toEqual(data2);
    });
  });

  describe('close', () => {
    it('closes and clears data', () => {
      const { result } = renderHook(() => useModalWithData<TestData>());
      const testData: TestData = { id: '123', name: 'Test' };

      act(() => {
        result.current.open(testData);
      });
      expect(result.current.data).toEqual(testData);

      act(() => {
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
      expect(result.current.data).toBeNull();
    });
  });

  describe('setData', () => {
    it('updates data without affecting open state', () => {
      const { result } = renderHook(() => useModalWithData<TestData>());
      const testData: TestData = { id: '123', name: 'Test' };

      // Modal is closed
      act(() => {
        result.current.setData(testData);
      });

      expect(result.current.isOpen).toBe(false);
      expect(result.current.data).toEqual(testData);

      // Open the modal
      act(() => {
        result.current.open();
      });

      // Data should still be there
      expect(result.current.isOpen).toBe(true);
      expect(result.current.data).toEqual(testData);
    });

    it('can clear data by setting null', () => {
      const { result } = renderHook(() => useModalWithData<TestData>());
      const testData: TestData = { id: '123', name: 'Test' };

      act(() => {
        result.current.open(testData);
      });

      act(() => {
        result.current.setData(null);
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.data).toBeNull();
    });
  });

  describe('reference stability', () => {
    it('maintains stable function references', () => {
      const { result, rerender } = renderHook(() => useModalWithData<TestData>());

      const { open: open1, close: close1, setData: setData1 } = result.current;

      rerender();

      const { open: open2, close: close2, setData: setData2 } = result.current;

      expect(open1).toBe(open2);
      expect(close1).toBe(close2);
      expect(setData1).toBe(setData2);
    });
  });
});
