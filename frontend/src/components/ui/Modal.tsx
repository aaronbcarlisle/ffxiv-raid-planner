import { useEffect, useRef } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="bg-transparent p-0 overflow-visible backdrop:bg-black/70 open:flex open:items-center open:justify-center open:fixed open:inset-0 open:w-full open:h-full open:max-w-none open:max-h-none"
    >
      <div className="bg-surface-card border border-border-default rounded-lg w-full max-w-md mx-4 overflow-visible">
        <div className="flex items-center justify-between p-4 border-b border-border-default">
          <h2 className="font-display text-xl text-accent">{title}</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-2xl leading-none"
          >
            &times;
          </button>
        </div>
        <div className="p-4 overflow-visible">{children}</div>
      </div>
    </dialog>
  );
}
