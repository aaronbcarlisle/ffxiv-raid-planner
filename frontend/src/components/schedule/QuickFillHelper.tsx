/**
 * QuickFillHelper — Appears in the AvailabilityGrid when in "This Week" mode.
 * Provides "Apply my Player Hub availability" and "Apply static Typical Week"
 * actions that fill empty days only.
 */

import { useState } from 'react';
import { Calendar, RefreshCw, ArrowRight, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../primitives/Button';
import { Badge } from '../primitives/Badge';
import { usePersonalAvailabilityStore } from '../../stores/personalAvailabilityStore';
import { useAvailabilityStore } from '../../stores/availabilityStore';
import { toast } from '../../stores/toastStore';
import {
  buildPersonalSourceByDay,
  buildQuickFillPlan,
  buildStaticTemplateSourceByDay,
  getExistingDates,
} from './quickFillUtils';

interface QuickFillHelperProps {
  groupId: string;
  userId: string;
  dates: string[];
}

export function QuickFillHelper({ groupId, userId, dates }: QuickFillHelperProps) {
  const { days: personalDays } = usePersonalAvailabilityStore();
  const fetchPersonalAvailability = usePersonalAvailabilityStore((s) => s.fetchPersonalAvailability);
  const { data, templateData, submitAvailability, fetchAvailability } = useAvailabilityStore();
  const [applying, setApplying] = useState<'personal' | 'static' | null>(null);
  const [hasFetchedPersonal, setHasFetchedPersonal] = useState(false);

  // Lazy-fetch personal availability on first interaction
  const ensurePersonalFetched = async () => {
    if (!hasFetchedPersonal) {
      await fetchPersonalAvailability();
      setHasFetchedPersonal(true);
    }
  };

  const handleApplyPersonal = async () => {
    await ensurePersonalFetched();

    const currentPersonalDays = usePersonalAvailabilityStore.getState().days;
    if (currentPersonalDays.length === 0 || currentPersonalDays.every((d) => d.slots.length === 0)) {
      toast.info('Set up Player Hub availability first');
      return;
    }

    setApplying('personal');
    try {
      const plan = buildQuickFillPlan(
        dates,
        getExistingDates(data, userId),
        buildPersonalSourceByDay(currentPersonalDays)
      );

      for (const item of plan.filledDates) {
        await submitAvailability(groupId, item.date, item.slots);
      }

      // Refresh grid data
      const sortedDates = [...dates].sort();
      await fetchAvailability(groupId, sortedDates[0], sortedDates[sortedDates.length - 1]);

      if (plan.filledDates.length > 0) {
        const msg = plan.skippedDates.length > 0
          ? `Filled ${plan.filledDates.length} day${plan.filledDates.length !== 1 ? 's' : ''} from Player Hub. Skipped ${plan.skippedDates.length} custom day${plan.skippedDates.length !== 1 ? 's' : ''}.`
          : `Filled ${plan.filledDates.length} day${plan.filledDates.length !== 1 ? 's' : ''} from Player Hub availability.`;
        toast.success(msg);
      } else if (plan.skippedDates.length > 0) {
        toast.info('No empty days to fill - your custom week was preserved.');
      } else {
        toast.info('No matching days found in your Player Hub availability.');
      }
    } catch {
      toast.error('Failed to apply Player Hub availability');
    } finally {
      setApplying(null);
    }
  };

  const handleApplyStaticTemplate = async () => {
    setApplying('static');
    try {
      const templateByDay = buildStaticTemplateSourceByDay(templateData, userId);

      if (templateByDay.size === 0) {
        toast.info('No static Typical Week configured for your account. Fill in Typical Week first.');
        return;
      }

      const plan = buildQuickFillPlan(dates, getExistingDates(data, userId), templateByDay);

      for (const item of plan.filledDates) {
        await submitAvailability(groupId, item.date, item.slots);
      }

      const sortedDates = [...dates].sort();
      await fetchAvailability(groupId, sortedDates[0], sortedDates[sortedDates.length - 1]);

      if (plan.filledDates.length > 0) {
        const msg = plan.skippedDates.length > 0
          ? `Filled ${plan.filledDates.length} day${plan.filledDates.length !== 1 ? 's' : ''} from Typical Week. Skipped ${plan.skippedDates.length} custom day${plan.skippedDates.length !== 1 ? 's' : ''}.`
          : `Filled ${plan.filledDates.length} day${plan.filledDates.length !== 1 ? 's' : ''} from this static's Typical Week.`;
        toast.success(msg);
      } else if (plan.skippedDates.length > 0) {
        toast.info('No empty days to fill - your custom week was preserved.');
      } else {
        toast.info('No matching days in your Typical Week template.');
      }
    } catch {
      toast.error('Failed to apply Typical Week');
    } finally {
      setApplying(null);
    }
  };

  const hasPersonalData = hasFetchedPersonal && personalDays.some((d) => d.slots.length > 0);
  const hasStaticTemplateData = templateData.some((day) => day.responses.some((response) => response.userId === userId && response.slots.length > 0));

  return (
    <div className="rounded-xl border border-border-default bg-surface-elevated/60 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Info className="w-4 h-4 text-accent flex-shrink-0" />
        <span className="text-sm font-medium text-text-primary">Quick fill this week</span>
        <Badge variant="default" size="sm">Fill empty days only</Badge>
      </div>
      <p className="text-xs text-text-tertiary mb-3">
        Start from your saved Player Hub availability or this static&apos;s Typical Week. Existing custom days are preserved.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Calendar className="w-3.5 h-3.5" />}
          onClick={handleApplyPersonal}
          disabled={!!applying}
        >
          {applying === 'personal' ? 'Applying...' : 'Apply Player Hub availability'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          onClick={handleApplyStaticTemplate}
          disabled={!!applying}
        >
          {applying === 'static' ? 'Applying...' : 'Apply static Typical Week'}
        </Button>
      </div>
      {hasFetchedPersonal && !hasPersonalData && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-card px-3 py-2 text-xs text-text-tertiary">
          <span>No Player Hub availability set yet.</span>
          <Link to="/profile?tab=availability&focus=availability" className="text-accent hover:underline inline-flex items-center gap-0.5">
            Set up in Player Hub <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}
      {!hasStaticTemplateData && (
        <div className="mt-2 text-xs text-text-muted">
          No static Typical Week set yet. Switch to Typical week to set one.
        </div>
      )}
    </div>
  );
}
