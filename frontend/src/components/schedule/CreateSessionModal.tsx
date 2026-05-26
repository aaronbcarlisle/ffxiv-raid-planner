import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { Checkbox } from '../ui/Checkbox';
import { Button } from '../primitives';
import { Calendar } from 'lucide-react';
import type { ScheduleSession, ScheduleSessionCreate } from '../../types';

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

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ScheduleSessionCreate) => Promise<void>;
  editSession?: ScheduleSession | null;
}

function getLocalTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function toLocalDatetimeString(isoString: string): string {
  const d = new Date(isoString);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function addMs(datetimeLocal: string, ms: number): string {
  const d = new Date(datetimeLocal);
  if (isNaN(d.getTime())) return '';
  const result = new Date(d.getTime() + ms);
  const offset = result.getTimezoneOffset();
  return new Date(result.getTime() - offset * 60000).toISOString().slice(0, 16);
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

export function CreateSessionModal({ isOpen, onClose, onSubmit, editSession }: CreateSessionModalProps) {
  const [title, setTitle] = useState(editSession?.title ?? '');
  const [description, setDescription] = useState(editSession?.description ?? '');
  const [startTime, setStartTime] = useState(
    editSession ? toLocalDatetimeString(editSession.startTime) : ''
  );
  const [endTime, setEndTime] = useState(
    editSession ? toLocalDatetimeString(editSession.endTime) : ''
  );
  const [timezone, setTimezone] = useState(editSession?.timezone ?? getLocalTimezone());
  const [isRecurring, setIsRecurring] = useState(editSession?.isRecurring ?? false);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(
    parseDaysFromRule(editSession?.recurrenceRule)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setEndTime(addMs(value, DEFAULT_DURATION_MS));
    } else if (value && endTime && new Date(value) >= new Date(endTime)) {
      setEndTime(addMs(value, DEFAULT_DURATION_MS));
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !startTime || !endTime) return;

    setIsSubmitting(true);
    try {
      const startDate = new Date(startTime);
      const endDate = new Date(endTime);

      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        timezone,
        isRecurring,
        recurrenceRule: isRecurring ? buildRecurrenceRule(selectedDays) : undefined,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const endBeforeStart = startTime && endTime && new Date(endTime) <= new Date(startTime);
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
    >
      <div className="space-y-4">
        <div>
          <Label size="sm">Title</Label>
          <Input
            value={title}
            onChange={setTitle}
            placeholder="e.g. Weekly Savage Prog"
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label size="sm">Start</Label>
            {/* design-system-ignore: datetime-local input has no design system equivalent */}
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => handleStartChange(e.target.value)}
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

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!isValid || isSubmitting}>
            {isSubmitting ? 'Saving...' : editSession ? 'Save Changes' : 'Create Session'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
