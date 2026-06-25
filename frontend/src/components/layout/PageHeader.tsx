import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  icon?: ReactNode;
}

export function PageHeader({ title, subtitle, actions, icon }: PageHeaderProps) {
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
          {icon ? (
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: 'rgba(20,184,166,0.12)',
                boxShadow: '0 0 0 1px rgba(20,184,166,0.2), inset 0 0 16px rgba(20,184,166,0.06)',
              }}
            >
              {icon}
            </div>
          ) : (
            <div
              className="w-[3px] h-6 rounded-full flex-shrink-0"
              style={{ background: 'linear-gradient(180deg, rgba(20,184,166,0.3) 0%, rgba(20,184,166,0.85) 50%, rgba(20,184,166,0.3) 100%)' }}
            />
          )}
          <h1 className="text-xl sm:text-2xl font-display font-bold text-text-primary tracking-tight">{title}</h1>
        </div>
        {subtitle && (
          <p className={`mt-1.5 text-sm text-text-secondary ${icon ? 'pl-[38px]' : 'pl-[15px]'}`}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex-shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}
