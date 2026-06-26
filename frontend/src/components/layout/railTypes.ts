import type React from 'react';

export interface RailNavItem {
  id: string;
  label: string;
  description: string;
  shortcut?: string;
  icon: React.FC<{ size?: number; className?: string }>;
  isActive: boolean;
  onSelect: () => void;
}
