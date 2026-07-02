/**
 * PersonalAvailabilityCard — Compact card for Player Hub Overview
 * showing configured days count and CTA to edit personal availability.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Calendar, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../primitives/Button';
import { Badge } from '../primitives/Badge';
import { Modal } from '../ui/Modal';
import { useModal } from '../../hooks/useModal';
import { usePersonalAvailabilityStore } from '../../stores/personalAvailabilityStore';
import { PersonalAvailabilityEditor } from './PersonalAvailabilityEditor';
import { formatDayOfWeekLabel } from '../schedule/availabilityUtils';
import { getBrowserTimezone } from '../../utils/timezone';
import type { StaticGroupListItem } from '../../types';

interface PersonalAvailabilityCardProps {
  primaryStatic?: StaticGroupListItem | null;
  focusAvailability?: boolean;
}

export function PersonalAvailabilityCard({
  primaryStatic,
  focusAvailability = false,
}: PersonalAvailabilityCardProps) {
  const { t, i18n } = useTranslation();
  const { days, isLoading, fetchPersonalAvailability } = usePersonalAvailabilityStore();
  const editModal = useModal();
  const hasFetchedRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const editorDirtyRef = useRef(false);
  const [isFocused, setIsFocused] = useState(false);
  const uiLocale = i18n.resolvedLanguage === 'ja' ? 'ja-JP' : 'en-US';

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
  const timezone = useMemo(
    () => configuredDays[0]?.timezone || getBrowserTimezone(),
    [configuredDays]
  );
  const handleEditorDirtyChange = (isDirty: boolean) => {
    editorDirtyRef.current = isDirty;
  };

  const scheduleLink = primaryStatic
    ? `/group/${primaryStatic.shareCode}?tab=schedule`
    : '/discover';
  const handleEditorClose = () => {
    if (
      editorDirtyRef.current &&
      !window.confirm(t('profile.availability.discardUnsavedChanges'))
    ) {
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
        className={`bg-surface-raised rounded-lg border p-3 transition-all sm:p-4 ${
          isFocused
            ? 'border-accent/70 shadow-accent/15 ring-accent/30 shadow-lg ring-2'
            : 'border-border-default'
        }`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-text-primary text-sm font-semibold">
              {t('profile.availability.title')}
            </h3>
            <p className="text-text-tertiary mt-0.5 text-xs">
              {t('profile.availability.cardSubtitle')}
            </p>
          </div>
          <Badge variant="default" size="sm">
            {timezone}
          </Badge>
        </div>

        {isLoading ? (
          <div className="bg-surface-elevated h-8 animate-pulse rounded" />
        ) : configuredCount > 0 ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="border-border-subtle bg-surface-elevated/70 rounded-lg border px-3 py-2">
                <div className="text-text-tertiary flex items-center gap-1.5 text-xs">
                  <Calendar className="text-accent h-3.5 w-3.5" />
                  {t('profile.availability.daysLabel')}
                </div>
                <div className="font-display text-text-primary mt-1 text-lg">{configuredCount}</div>
              </div>
              <div className="border-border-subtle bg-surface-elevated/70 rounded-lg border px-3 py-2">
                <div className="text-text-tertiary flex items-center gap-1.5 text-xs">
                  <Clock3 className="text-accent h-3.5 w-3.5" />
                  {t('profile.availability.hoursLabel')}
                </div>
                <div className="font-display text-text-primary mt-1 text-lg">
                  {Number.isInteger(approximateHours)
                    ? approximateHours
                    : approximateHours.toFixed(1)}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {configuredDays.map((d) => (
                <span
                  key={d.dayOfWeek}
                  className="bg-accent/10 text-accent rounded-full px-2 py-1 text-[11px] font-medium"
                >
                  {formatDayOfWeekLabel(d.dayOfWeek as never, uiLocale)}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={editModal.open}>
                {t('profile.availability.editAvailability')}
              </Button>
              <Link
                to={scheduleLink}
                className="text-accent hover:bg-accent/10 inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors sm:min-h-0"
              >
                {primaryStatic ? t('profile.availability.useInSchedule') : t('nav.findAStatic')}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-text-tertiary text-sm">{t('profile.availability.setOnceReuse')}</p>
            <div className="border-border-subtle bg-surface-elevated/60 text-text-secondary rounded-lg border px-3 py-2 text-xs">
              {t('profile.availability.quickFillPlanning')}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={editModal.open}>
                {t('profile.availability.setAvailability')}
              </Button>
              <Link
                to={scheduleLink}
                className="text-accent hover:bg-accent/10 inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors sm:min-h-0"
              >
                {primaryStatic ? t('profile.availability.openSchedule') : t('nav.findAStatic')}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={editModal.isOpen}
        title={t('profile.availability.typicalAvailability')}
        onClose={handleEditorClose}
        size="3xl"
      >
        <PersonalAvailabilityEditor
          onDone={handleEditorClose}
          onDirtyChange={handleEditorDirtyChange}
        />
      </Modal>
    </>
  );
}
