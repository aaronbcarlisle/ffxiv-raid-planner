import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  isVisible: boolean;
  onHide: () => void;
  duration?: number;
}

export function Toast({ message, isVisible, onHide, duration = 2000 }: ToastProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isVisible) {
      // Small delay to trigger CSS transition
      requestAnimationFrame(() => setShow(true));

      const timer = setTimeout(() => {
        setShow(false);
        setTimeout(onHide, 300); // Wait for fade out animation
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onHide]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
        show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <div className="bg-surface-raised border border-accent text-text-primary px-4 py-2 rounded-lg shadow-xl">
        {message}
      </div>
    </div>
  );
}
