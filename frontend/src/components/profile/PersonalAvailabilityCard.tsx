/**
 * PersonalAvailabilityCard — Compact card for Player Hub Overview
 * showing configured days count and CTA to edit personal availability.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Calendar, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../primitives/Button';
import { Badge } from '../primitives/Badge';
import { Modal } from '../ui/Modal';
import { useModal } from '../../hooks/useModal';
import { usePersonalAvailabilityStore } from '../../stores/personalAvailabilityStore';
import { PersonalAvailabilityEditor } from './PersonalAvailabilityEditor';
import { getBrowserTimezone } from '../../utils/timezone';
import type { StaticGroupListItem } from '../../types';

const DAY_LABELS: Record<string, string> = {
  MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun',
};

interface PersonalAvailabilityCardProps {
  primaryStatic?: StaticGroupListItem | null;
  focusAvailability?: boolean;
}

export function PersonalAvailabilityCard({ primaryStatic, focusAvailability = false }: PersonalAvailabilityCardProps) {
  const { days, isLoading, fetchPersonalAvailability } = usePersonalAvailabilityStore();
  const editModal = useModal();
  const hasFetchedRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const editorDirtyRef = useRef(false);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchPersonalAvailability();
    }
  }, [fetchPersonalAvailability]);

  useEffect(() => {
    if (!focusAvailability) return;
    const frameId = requestAnimationFrame(() => {
      setIsFocused(true);
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    const timeoutId = window.setTimeout(() => setIsFocused(false), 2600);
    return () => {
      cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [focusAvailability]);

  const configuredDays = days.filter((d) => d.slots.length > 0);
  const configuredCount = configuredDays.length;
  const totalSlots = configuredDays.reduce((total, day) => total + day.slots.length, 0);
  const approximateHours = totalSlots / 2;
  const timezone = useMemo(() => configuredDays[0]?.timezone || getBrowserTimezone(), [configuredDays]);
  const handleEditorDirtyChange = (isDirty: boolean) => {
    editorDirtyRef.current = isDirty;
  };

  const scheduleLink = primaryStatic ? `/group/${primaryStatic.shareCode}?tab=schedule` : '/discover';
  const handleEditorClose = () => {
    if (editorDirtyRef.current && !window.confirm('Discard unsaved availability changes?')) {
      return;
    }
    handleEditorDirtyChange(false);
    editModal.close();
  };

  return (
    <>
      <div
        ref={cardRef}
        id="player-hub-availability"
        className={`bg-surface-raised rounded-lg border p-3 sm:p-4 transition-all ${
          isFocused ? 'border-accent/70 shadow-lg shadow-accent/15 ring-2 ring-accent/30' : 'border-border-default'
        }`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display font-semibold text-text-primary text-sm">
              Availability
            </h3>
            <p className="mt-0.5 text-xs text-text-tertiary">
              Your personal weekly default
            </p>
          </div>
          <Badge variant="default" size="sm">
            {timezone}
          </Badge>
        </div>

        {isLoading ? (
          <div className="h-8 bg-surface-elevated rounded animate-pulse" />
        ) : configuredCount > 0 ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border-subtle bg-surface-elevated/70 px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                  <Calendar className="h-3.5 w-3.5 text-accent" />
                  Days
                </div>
                <div className="mt-1 text-lg font-display text-text-primary">
                  {configuredCount}
                </div>
              </div>
              <div className="rounded-lg border border-border-subtle bg-surface-elevated/70 px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                  <Clock3 className="h-3.5 w-3.5 text-accent" />
                  Hours
                </div>
                <div className="mt-1 text-lg font-display text-text-primary">
                  {Number.isInteger(approximateHours) ? approximateHours : approximateHours.toFixed(1)}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {configuredDays.map((d) => (
                <span
                  key={d.dayOfWeek}
                  className="text-[11px] px-2 py-1 rounded-full bg-accent/10 text-accent font-medium"
                >
                  {DAY_LABELS[d.dayOfWeek] ?? d.dayOfWeek}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={editModal.open}>
                Edit availability
              </Button>
              <Link
                to={scheduleLink}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-accent transition-colors hover:bg-accent/10 sm:min-h-0"
              >
                {primaryStatic ? 'Use in schedule' : 'Find a static'}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-text-tertiary text-sm">
              Set your usual availability once, then reuse it across statics.
            </p>
            <div className="rounded-lg border border-border-subtle bg-surface-elevated/60 px-3 py-2 text-xs text-text-secondary">
              Used by schedule quick fill when planning this week.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={editModal.open}>
                Set availability
              </Button>
              <Link
                to={scheduleLink}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-accent transition-colors hover:bg-accent/10 sm:min-h-0"
              >
                {primaryStatic ? 'Open schedule' : 'Find a static'}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={editModal.isOpen}
        title="Personal Typical Availability"
        onClose={handleEditorClose}
        size="3xl"
      >
        <PersonalAvailabilityEditor onDone={handleEditorClose} onDirtyChange={handleEditorDirtyChange} />
      </Modal>
    </>
  );
}
