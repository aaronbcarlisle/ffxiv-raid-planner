/**
 * useModal Hook
 *
 * Simplifies modal state management with a clean API.
 * Provides isOpen, open, close, and toggle functions.
 *
 * @example Basic usage:
 * ```tsx
 * const modal = useModal();
 *
 * <Button onClick={modal.open}>Open Modal</Button>
 * <Modal isOpen={modal.isOpen} onClose={modal.close}>
 *   Content
 * </Modal>
 * ```
 *
 * @example With data:
 * ```tsx
 * const modal = useModalWithData<{ userId: string }>();
 *
 * <Button onClick={() => modal.open({ userId: '123' })}>Edit User</Button>
 * <Modal isOpen={modal.isOpen} onClose={modal.close}>
 *   Editing user: {modal.data?.userId}
 * </Modal>
 * ```
 */

import { useState, useCallback, useMemo } from 'react';

export interface UseModalReturn {
  /** Whether the modal is currently open */
  isOpen: boolean;
  /** Open the modal */
  open: () => void;
  /** Close the modal */
  close: () => void;
  /** Toggle the modal open/closed */
  toggle: () => void;
}

/**
 * Simple modal state hook for modals without associated data
 */
export function useModal(initialState = false): UseModalReturn {
  const [isOpen, setIsOpen] = useState(initialState);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  return useMemo(() => ({
    isOpen,
    open,
    close,
    toggle,
  }), [isOpen, open, close, toggle]);
}

export interface UseModalWithDataReturn<T> {
  /** Whether the modal is currently open */
  isOpen: boolean;
  /** Data passed to the modal (null when closed) */
  data: T | null;
  /** Open the modal with optional data */
  open: (data?: T) => void;
  /** Close the modal and clear data */
  close: () => void;
  /** Update the data without changing open state */
  setData: (data: T | null) => void;
}

/**
 * Modal state hook for modals that receive data
 *
 * When closed, data is automatically cleared.
 * Use setData to update data without closing/opening.
 */
export function useModalWithData<T>(initialState = false): UseModalWithDataReturn<T> {
  const [isOpen, setIsOpen] = useState(initialState);
  const [data, setData] = useState<T | null>(null);

  const open = useCallback((newData?: T) => {
    if (newData !== undefined) {
      setData(newData);
    }
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setData(null);
  }, []);

  return useMemo(() => ({
    isOpen,
    data,
    open,
    close,
    setData,
  }), [isOpen, data, open, close]);
}
