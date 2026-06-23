/* eslint-disable design-system/no-raw-button */
import { Settings, Users, Link } from 'lucide-react';
import type { MemberRole } from '../../types';

interface MorePageProps {
  onOpenSettings: (tab?: string) => void;
  canManage: boolean;
  userRole: MemberRole | null;
}

export function MorePage({ onOpenSettings, canManage }: MorePageProps) {
  const cards = [
    {
      icon: Settings, title: 'Settings', description: 'Manage static name, schedule, visibility, and Discord integration.',
      action: () => onOpenSettings('general'), always: true,
    },
    {
      icon: Users, title: 'Requests & Invitations', description: 'Review join requests and manage open invitations.',
      action: () => onOpenSettings('recruitment'), manageOnly: true,
    },
    {
      icon: Link, title: 'Integrations', description: 'Plugin API keys, Lodestone sync, and external connections.',
      action: () => onOpenSettings('integrations'), always: true,
    },
  ].filter(c => c.always || (c.manageOnly && canManage));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xs font-semibold text-[#c9a84c] uppercase tracking-widest mb-3">Tools & Settings</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              /* design-system-ignore: card button needs full-card click area */
              <button
                key={card.title}
                onClick={card.action}
                className="text-left bg-surface-card border border-border-default rounded-xl p-4 hover:border-accent/50 hover:bg-surface-raised transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={16} className="text-accent" />
                  <span className="font-medium text-text-primary text-sm">{card.title}</span>
                </div>
                <p className="text-xs text-text-secondary">{card.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
