import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="relative flex items-start justify-between gap-2 mb-4 sm:mb-6 pb-5">
      {/* Teal-leading gradient separator */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, rgba(20,184,166,0.5) 0%, rgba(20,184,166,0.15) 25%, rgba(20,184,166,0.04) 60%, transparent 100%)',
        }}
      />
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <div
            className="w-[3px] h-6 rounded-full flex-shrink-0"
            style={{ background: 'linear-gradient(180deg, rgba(20,184,166,0.3) 0%, rgba(20,184,166,0.85) 50%, rgba(20,184,166,0.3) 100%)' }}
          />
          <h1 className="text-xl sm:text-2xl font-display font-bold text-text-primary tracking-tight">{title}</h1>
        </div>
        {subtitle && <p className="mt-1.5 text-sm text-text-secondary pl-[15px]">{subtitle}</p>}
      </div>
      {actions && <div className="flex-shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}
