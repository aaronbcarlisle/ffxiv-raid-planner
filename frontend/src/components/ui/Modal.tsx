interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  // Prevent all mouse events from passing through to elements behind the modal
  const handleBackdropEvent = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleBackdropEvent}
      onContextMenu={handleContextMenu}
    >
      <div className="bg-surface-card border border-border-default rounded-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-border-default">
          <h2 className="font-display text-xl text-accent">{title}</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-2xl leading-none"
          >
            &times;
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
