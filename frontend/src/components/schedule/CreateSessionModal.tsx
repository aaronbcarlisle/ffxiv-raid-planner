import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { Checkbox } from '../ui/Checkbox';
import { Button } from '../primitives';
import { Calendar } from 'lucide-react';
import type { EventCategory, InitialRsvpStatus, ScheduleSession, ScheduleSessionCreate } from '../../types';
import { RAID_TIERS, MOUNT_FARM_TRIALS } from '../../gamedata';
import {
  addDurationInTimeZone,
  fromZonedDatetimeLocalValue,
  getBrowserTimezone,
  toZonedDatetimeLocalValue,
} from '../../utils/timezone';

const COMMON_TIMEZONES = [
  { value: 'Asia/Tokyo', label: 'JST (Asia/Tokyo)' },
  { value: 'America/New_York', label: 'EST (America/New_York)' },
  { value: 'America/Chicago', label: 'CST (America/Chicago)' },
  { value: 'America/Denver', label: 'MST (America/Denver)' },
  { value: 'America/Los_Angeles', label: 'PST (America/Los_Angeles)' },
  { value: 'Europe/London', label: 'GMT (Europe/London)' },
  { value: 'Europe/Paris', label: 'CET (Europe/Paris)' },
  { value: 'Europe/Berlin', label: 'CET (Europe/Berlin)' },
  { value: 'Australia/Sydney', label: 'AEST (Australia/Sydney)' },
  { value: 'Pacific/Auckland', label: 'NZST (Pacific/Auckland)' },
  { value: 'Asia/Singapore', label: 'SGT (Asia/Singapore)' },
  { value: 'Asia/Seoul', label: 'KST (Asia/Seoul)' },
];

const DAYS_OF_WEEK = [
  { key: 'MO', label: 'Mon' },
  { key: 'TU', label: 'Tue' },
  { key: 'WE', label: 'Wed' },
  { key: 'TH', label: 'Thu' },
  { key: 'FR', label: 'Fri' },
  { key: 'SA', label: 'Sat' },
  { key: 'SU', label: 'Sun' },
];

const DEFAULT_DURATION_MS = 3 * 60 * 60 * 1000;
const INITIAL_RSVP_OPTIONS = [
  { value: 'no_response', label: 'No response' },
  { value: 'available', label: 'Available' },
  { value: 'tentative', label: 'Tentative' },
  { value: 'unavailable', label: 'Unavailable' },
];

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ScheduleSessionCreate) => Promise<void>;
  editSession?: ScheduleSession | null;
  initialDraft?: ScheduleSessionCreate | null;
}

function parseDaysFromRule(rule: string | null | undefined): Set<string> {
  if (!rule) return new Set(['SA']);
  const match = rule.match(/BYDAY=([A-Z,]+)/);
  if (!match) return new Set(['SA']);
  return new Set(match[1].split(','));
}

function buildRecurrenceRule(days: Set<string>): string {
  const ordered = DAYS_OF_WEEK.filter((d) => days.has(d.key)).map((d) => d.key);
  return `FREQ=WEEKLY;BYDAY=${ordered.join(',')}`;
}

const EVENT_CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: 'raid', label: 'Raid' },
  { value: 'farm', label: 'Mount Farm' },
  { value: 'reclear', label: 'Reclear' },
  { value: 'prog', label: 'Progression' },
  { value: 'social', label: 'Social' },
  { value: 'other', label: 'Other' },
];

function getInitialFormState(editSession?: ScheduleSession | null, initialDraft?: ScheduleSessionCreate | null) {
  const source = editSession ?? initialDraft ?? null;
  const timezone = source?.timezone ?? getBrowserTimezone();
  return {
    title: source?.title ?? '',
    description: source?.description ?? '',
    startTime: source?.startTime ? toZonedDatetimeLocalValue(source.startTime, timezone) : '',
    endTime: source?.endTime ? toZonedDatetimeLocalValue(source.endTime, timezone) : '',
    timezone,
    isRecurring: source?.isRecurring ?? false,
    selectedDays: parseDaysFromRule(source?.recurrenceRule),
    category: (source && 'category' in source ? source.category : null) as EventCategory | null,
    contentName: (source && 'contentName' in source ? source.contentName : null) as string | null,
    contentId: (source && 'contentId' in source ? source.contentId : null) as string | null,
  };
}

export function CreateSessionModal({
  isOpen,
  onClose,
  onSubmit,
  editSession,
  initialDraft,
}: CreateSessionModalProps) {
  const initialState = getInitialFormState(editSession, initialDraft);
  const [title, setTitle] = useState(initialState.title);
  const [description, setDescription] = useState(initialState.description);
  const [startTime, setStartTime] = useState(initialState.startTime);
  const [endTime, setEndTime] = useState(initialState.endTime);
  const [timezone, setTimezone] = useState(initialState.timezone);
  const [isRecurring, setIsRecurring] = useState(initialState.isRecurring);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(initialState.selectedDays);
  const [initialRsvpStatus, setInitialRsvpStatus] = useState<InitialRsvpStatus>('no_response');
  const [category, setCategory] = useState<EventCategory | null>(initialState.category);
  const [contentName, setContentName] = useState<string | null>(initialState.contentName);
  const [contentId, setContentId] = useState<string | null>(initialState.contentId);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const nextState = getInitialFormState(editSession, initialDraft);
    setTitle(nextState.title);
    setDescription(nextState.description);
    setStartTime(nextState.startTime);
    setEndTime(nextState.endTime);
    setTimezone(nextState.timezone);
    setIsRecurring(nextState.isRecurring);
    setSelectedDays(nextState.selectedDays);
    setInitialRsvpStatus('no_response');
    setCategory(nextState.category);
    setContentName(nextState.contentName);
    setContentId(nextState.contentId);
  }, [editSession, initialDraft, isOpen]);

  const toggleDay = (day: string) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) {
        if (next.size > 1) next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
  };

  const handleStartChange = (value: string) => {
    setStartTime(value);
    if (value && !endTime) {
      setEndTime(addDurationInTimeZone(value, DEFAULT_DURATION_MS, timezone));
    } else if (
      value
      && endTime
      && new Date(fromZonedDatetimeLocalValue(value, timezone))
        >= new Date(fromZonedDatetimeLocalValue(endTime, timezone))
    ) {
      setEndTime(addDurationInTimeZone(value, DEFAULT_DURATION_MS, timezone));
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !startTime || !endTime) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        startTime: fromZonedDatetimeLocalValue(startTime, timezone),
        endTime: fromZonedDatetimeLocalValue(endTime, timezone),
        timezone,
        isRecurring,
        recurrenceRule: isRecurring ? buildRecurrenceRule(selectedDays) : undefined,
        ...(!editSession ? { initialRsvpStatus } : {}),
        ...(category ? { category } : {}),
        ...(contentId ? { contentId } : {}),
        ...(contentName ? { contentName } : {}),
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const endBeforeStart = Boolean(
    startTime
    && endTime
    && new Date(fromZonedDatetimeLocalValue(endTime, timezone))
      <= new Date(fromZonedDatetimeLocalValue(startTime, timezone))
  );
  const isValid = title.trim() && startTime && endTime && !endBeforeStart;

  const selectedDaysSummary = DAYS_OF_WEEK
    .filter((d) => selectedDays.has(d.key))
    .map((d) => d.label)
    .join(', ');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-accent" />
          {editSession ? 'Edit Session' : 'Add Raid Session'}
        </span>
      }
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!isValid || isSubmitting} data-testid="session-submit-btn">
            {isSubmitting ? 'Saving...' : editSession ? 'Save Changes' : 'Create Session'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <Label size="sm">Title</Label>
          <Input
            value={title}
            onChange={setTitle}
            placeholder="e.g. Weekly Savage Prog"
            data-testid="session-title-input"
          />
        </div>

        <div>
          <Label size="sm">Description (optional)</Label>
          <Input
            value={description}
            onChange={setDescription}
            placeholder="e.g. M4S prog from adds phase"
          />
        </div>

        <div>
          <Label size="sm">Category (optional)</Label>
          <Select
            value={category ?? ''}
            onChange={(val) => setCategory((val || null) as EventCategory | null)}
            options={[
              { value: '', label: 'No category' },
              ...EVENT_CATEGORIES.map(c => ({ value: c.value, label: c.label })),
            ]}
          />
        </div>

        {(category === 'farm' || category === 'raid' || category === 'reclear' || category === 'prog') && (
          <div>
            <Label size="sm">Content / Duty (optional)</Label>
            <Select
              value={contentId ?? ''}
              onChange={(val) => {
                if (!val) {
                  setContentId(null);
                  setContentName(null);
                  return;
                }
                setContentId(val);
                // Look up the display name
                const trial = MOUNT_FARM_TRIALS.find(t => t.id === val);
                if (trial) { setContentName(trial.dutyName); return; }
                const tier = RAID_TIERS.find(t => t.id === val);
                if (tier) { setContentName(tier.name); return; }
                setContentName(val);
              }}
              options={[
                { value: '', label: 'No specific duty' },
                ...(category === 'farm'
                  ? MOUNT_FARM_TRIALS.map(t => ({ value: t.id, label: `[${t.expansion}] ${t.dutyName}` }))
                  : RAID_TIERS.map(t => ({ value: t.id, label: `${t.name} (${t.shortName})` }))
                ),
              ]}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label size="sm">Start</Label>
            {/* design-system-ignore: datetime-local input has no design system equivalent */}
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => handleStartChange(e.target.value)}
              data-testid="session-start-input"
              className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border-default text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>
          <div>
            <Label size="sm">End</Label>
            {/* design-system-ignore: datetime-local input has no design system equivalent */}
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              data-testid="session-end-input"
              className={`w-full px-3 py-2 rounded-lg bg-surface-elevated border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 ${
                endBeforeStart ? 'border-red-500' : 'border-border-default'
              }`}
            />
            {endBeforeStart && (
              <p className="text-xs text-red-400 mt-1">End must be after start</p>
            )}
          </div>
        </div>

        <div>
          <Label size="sm">Timezone</Label>
          <Select
            value={timezone}
            onChange={setTimezone}
            options={COMMON_TIMEZONES}
          />
        </div>

        <div className="flex items-center gap-3">
          <Checkbox
            checked={isRecurring}
            onChange={setIsRecurring}
            label="Recurring weekly"
          />
        </div>

        {isRecurring && (
          <div>
            <Label size="sm">Repeat on</Label>
            <div className="flex gap-1.5 flex-wrap">
              {DAYS_OF_WEEK.map(({ key, label }) => (
                <Button
                  key={key}
                  variant={selectedDays.has(key) ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => toggleDay(key)}
                  className="min-w-[3rem]"
                >
                  {label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-text-muted mt-1.5">
              Every {selectedDaysSummary}
            </p>
          </div>
        )}

        {!editSession && (
          <div data-testid="initial-rsvp-field">
            <Label size="sm">Initial RSVP for members</Label>
            <Select
              value={initialRsvpStatus}
              onChange={(value) => setInitialRsvpStatus(value as InitialRsvpStatus)}
              options={INITIAL_RSVP_OPTIONS}
            />
            <p className="mt-1.5 text-xs text-text-muted">
              Applies to current members only. Members can change their RSVP later.
            </p>
          </div>
        )}

      </div>
    </Modal>
  );
}
