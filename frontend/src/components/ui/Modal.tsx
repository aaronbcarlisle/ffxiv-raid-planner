import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl'; // sm=24rem, md=28rem (default), lg=32rem, xl=36rem, 2xl=42rem, 3xl=48rem, 4xl=56rem, 5xl=64rem
}

const SIZE_CLASSES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
};

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  if (!isOpen) return null;

  // Prevent all mouse events from passing through to elements behind the modal
  const handleBackdropEvent = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const sizeClass = SIZE_CLASSES[size];

  // Use portal to render at document body level, preventing inherited styles (opacity, transforms)
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={handleBackdropEvent}
      onContextMenu={handleBackdropEvent}
    >
      <div className={`bg-surface-card border border-border-default rounded-lg w-full ${sizeClass} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between p-4 border-b border-border-default flex-shrink-0">
          <h2 className="font-display text-xl text-accent">{title}</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-2xl leading-none"
          >
            &times;
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>,
    document.body
  );
}
