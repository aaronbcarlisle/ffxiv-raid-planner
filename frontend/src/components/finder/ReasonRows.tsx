/**
 * ReasonRows — the Static Finder reason-row list (R-RH-K), moved from
 * `FinderCard.tsx:196-209` byte-for-byte, minus the "Your time:" line, which
 * stays in `FinderCard` (on an applicant row the zone is the listing's own,
 * so a "their time" line there would be wrong). `FinderCard` renders this
 * with `subject="you"`, then its existing time line; the Applicants tab
 * (RH1c) renders it with `subject="they"`.
 */
import { Check, CircleDot, X } from 'lucide-react';
import { reasonText, type ReasonSubject } from './reasonCopy';
import type { FitNight, FitReason } from './types';

const REASON_ICON: Record<'match' | 'partial' | 'conflict', { Icon: typeof Check; className: string }> = {
  match: { Icon: Check, className: 'text-status-success' },
  partial: { Icon: CircleDot, className: 'text-status-warning' },
  conflict: { Icon: X, className: 'text-status-error' },
};

export function ReasonRows({
  reasons,
  nights,
  subject = 'you',
}: {
  reasons: FitReason[];
  nights: FitNight[];
  subject?: ReasonSubject;
}) {
  return (
    <>
      {reasons.map((reason, i) => {
        const text = reasonText(reason, nights, subject);
        if (!text) return null;
        const { Icon, className } = REASON_ICON[reason.status];
        return (
          <div key={i} className="flex items-center gap-1.5 text-xs text-text-secondary">
            <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${className}`} aria-label={reason.status} />
            <span>{text}</span>
          </div>
        );
      })}
    </>
  );
}
