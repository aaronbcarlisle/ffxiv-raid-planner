import { useEffect, useRef, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select } from '../ui/Select';
import { Checkbox } from '../ui/Checkbox';
import { Button } from '../primitives';
import { Calendar, Upload } from 'lucide-react';
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
const MAX_BANNER_UPLOAD_BYTES = 2 * 1024 * 1024;
const INITIAL_RSVP_OPTIONS = [
  { value: 'no_response', label: 'No response' },
  { value: 'available', label: 'Available' },
  { value: 'tentative', label: 'Tentative' },
  { value: 'unavailable', label: 'Unavailable' },
];
const REMINDER_OPTIONS = [
  { minutes: 1440, label: '24 hrs before' },
  { minutes: 720, label: '12 hrs before' },
  { minutes: 360, label: '6 hrs before' },
  { minutes: 60, label: '1 hr before' },
  { minutes: 15, label: '15 min before' },
  { minutes: 0, label: 'At start' },
];

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ScheduleSessionCreate) => Promise<void>;
  editSession?: ScheduleSession | null;
  initialDraft?: ScheduleSessionCreate | null;
  discordDeliverySummary?: {
    serverLabel: string;
    mirrorEnabled: boolean;
    remindersEnabled: boolean;
    reminderLabels: string[];
    pingLabel: string;
  };
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
  { value: 'ultimate', label: 'Ultimate' },
  { value: 'farm', label: 'Mount Farm' },
  { value: 'reclear', label: 'Reclear' },
  { value: 'prog', label: 'Progression' },
  { value: 'social', label: 'Social' },
  { value: 'other', label: 'Other' },
];

const BANNER_PRESETS = RAID_TIERS
  .filter((tier) => Boolean(tier.banner))
  .map((tier) => ({
    value: tier.id,
    label: tier.name,
    url: tier.banner as string,
  }));

function toAbsoluteAssetUrl(path: string): string {
  if (/^https?:\/\//.test(path) || path.startsWith('data:')) return path;
  return `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;
}

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
    trackAvailability: source && 'trackAvailability' in source ? source.trackAvailability ?? true : true,
    category: (source && 'category' in source ? source.category : null) as EventCategory | null,
    contentName: (source && 'contentName' in source ? source.contentName : null) as string | null,
    contentId: (source && 'contentId' in source ? source.contentId : null) as string | null,
    bannerUrl: (source && 'bannerUrl' in source ? source.bannerUrl : null) as string | null,
    bannerKey: (source && 'bannerKey' in source ? source.bannerKey : null) as string | null,
    bannerSourceType: (source && 'bannerSourceType' in source ? source.bannerSourceType : null) as string | null,
    mirrorToDiscord: source && 'mirrorToDiscord' in source ? source.mirrorToDiscord ?? true : true,
    sendDiscordReminders: source && 'sendDiscordReminders' in source ? source.sendDiscordReminders ?? true : true,
    reminderOffsetsMinutes: source && 'reminderOffsetsMinutes' in source ? source.reminderOffsetsMinutes ?? null : null,
    missingRsvpReminderEnabled: source && 'missingRsvpReminderEnabled' in source ? source.missingRsvpReminderEnabled ?? null : null,
  };
}

export function CreateSessionModal({
  isOpen,
  onClose,
  onSubmit,
  editSession,
  initialDraft,
  discordDeliverySummary,
}: CreateSessionModalProps) {
  const initialState = getInitialFormState(editSession, initialDraft);
  const [title, setTitle] = useState(initialState.title);
  const [description, setDescription] = useState(initialState.description);
  const [startTime, setStartTime] = useState(initialState.startTime);
  const [endTime, setEndTime] = useState(initialState.endTime);
  const [timezone, setTimezone] = useState(initialState.timezone);
  const [isRecurring, setIsRecurring] = useState(initialState.isRecurring);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(initialState.selectedDays);
  const [trackAvailability, setTrackAvailability] = useState(initialState.trackAvailability);
  const [initialRsvpStatus, setInitialRsvpStatus] = useState<InitialRsvpStatus>('no_response');
  const [category, setCategory] = useState<EventCategory | null>(initialState.category);
  const [contentName, setContentName] = useState<string | null>(initialState.contentName);
  const [contentId, setContentId] = useState<string | null>(initialState.contentId);
  const [bannerUrl, setBannerUrl] = useState<string>(initialState.bannerUrl ?? '');
  const [bannerKey, setBannerKey] = useState<string | null>(initialState.bannerKey);
  const [bannerSourceType, setBannerSourceType] = useState<string | null>(initialState.bannerSourceType);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [mirrorToDiscord, setMirrorToDiscord] = useState(initialState.mirrorToDiscord);
  const [sendDiscordReminders, setSendDiscordReminders] = useState(initialState.sendDiscordReminders);
  const [useReminderOverrides, setUseReminderOverrides] = useState(
    initialState.reminderOffsetsMinutes !== null || initialState.missingRsvpReminderEnabled !== null
  );
  const [reminderOffsetsMinutes, setReminderOffsetsMinutes] = useState<number[]>(
    initialState.reminderOffsetsMinutes ?? [1440, 60]
  );
  const [missingRsvpReminderEnabled, setMissingRsvpReminderEnabled] = useState(
    initialState.missingRsvpReminderEnabled ?? true
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initializedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      initializedForRef.current = null;
      return;
    }
    const sessionKey = editSession?.id ?? initialDraft?.title ?? '__create__';
    if (initializedForRef.current === sessionKey) return;
    initializedForRef.current = sessionKey;

    const nextState = getInitialFormState(editSession, initialDraft);
    setTitle(nextState.title);
    setDescription(nextState.description);
    setStartTime(nextState.startTime);
    setEndTime(nextState.endTime);
    setTimezone(nextState.timezone);
    setIsRecurring(nextState.isRecurring);
    setSelectedDays(nextState.selectedDays);
    setTrackAvailability(nextState.trackAvailability);
    setInitialRsvpStatus('no_response');
    setCategory(nextState.category);
    setContentName(nextState.contentName);
    setContentId(nextState.contentId);
    setBannerUrl(nextState.bannerUrl ?? '');
    setBannerKey(nextState.bannerKey);
    setBannerSourceType(nextState.bannerSourceType);
    setBannerError(null);
    setMirrorToDiscord(nextState.mirrorToDiscord);
    setSendDiscordReminders(nextState.sendDiscordReminders);
    setUseReminderOverrides(nextState.reminderOffsetsMinutes !== null || nextState.missingRsvpReminderEnabled !== null);
    setReminderOffsetsMinutes(nextState.reminderOffsetsMinutes ?? [1440, 60]);
    setMissingRsvpReminderEnabled(nextState.missingRsvpReminderEnabled ?? true);
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

  const toggleReminderOffset = (minutes: number) => {
    setReminderOffsetsMinutes((prev) =>
      prev.includes(minutes)
        ? prev.filter((value) => value !== minutes)
        : [...prev, minutes].sort((left, right) => right - left)
    );
  };

  const handleBannerPresetChange = (presetId: string) => {
    if (!presetId) {
      setBannerKey(null);
      setBannerSourceType(null);
      setBannerUrl('');
      setBannerError(null);
      return;
    }
    const preset = BANNER_PRESETS.find((item) => item.value === presetId);
    if (!preset) return;
    setBannerKey(preset.value);
    setBannerSourceType('duty_preset');
    setBannerUrl(toAbsoluteAssetUrl(preset.url));
    setBannerError(null);
  };

  const handleBannerUpload = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setBannerError('Choose an image file.');
      return;
    }
    if (file.size > MAX_BANNER_UPLOAD_BYTES) {
      setBannerError('Banner uploads must be 2 MB or smaller.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setBannerUrl(result);
      setBannerKey(file.name);
      setBannerSourceType('uploaded');
      setBannerError(null);
    };
    reader.onerror = () => setBannerError('Could not read that image file.');
    reader.readAsDataURL(file);
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
        description: description.trim() || null,
        startTime: fromZonedDatetimeLocalValue(startTime, timezone),
        endTime: fromZonedDatetimeLocalValue(endTime, timezone),
        timezone,
        isRecurring,
        recurrenceRule: isRecurring ? buildRecurrenceRule(selectedDays) : null,
        trackAvailability,
        ...(!editSession ? { initialRsvpStatus } : {}),
        category,
        contentId,
        contentName,
        bannerUrl: bannerUrl.trim() || null,
        bannerKey: bannerUrl.trim() ? bannerKey : null,
        bannerSourceType: bannerUrl.trim() ? bannerSourceType || 'external_url' : null,
        mirrorToDiscord,
        sendDiscordReminders,
        reminderOffsetsMinutes: useReminderOverrides ? reminderOffsetsMinutes : null,
        missingRsvpReminderEnabled: useReminderOverrides ? missingRsvpReminderEnabled : null,
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
          {editSession ? 'Edit Session' : 'Add Session'}
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

        <div className="space-y-2">
          <Label size="sm">Banner image (optional)</Label>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Select
              value={bannerSourceType === 'duty_preset' ? bannerKey ?? '' : ''}
              onChange={handleBannerPresetChange}
              options={[
                { value: '', label: 'Choose preset banner' },
                ...BANNER_PRESETS.map((preset) => ({ value: preset.value, label: preset.label })),
              ]}
            />
            <Button
              type="button"
              variant="secondary"
              leftIcon={<Upload className="h-4 w-4" />}
              onClick={() => document.getElementById('schedule-banner-upload')?.click()}
            >
              Upload
            </Button>
          </div>
          {/* eslint-disable-next-line design-system/no-raw-input */}
          <input
            id="schedule-banner-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => handleBannerUpload(event.target.files?.[0])}
          />
          <Input
            value={bannerSourceType === 'uploaded' ? '' : bannerUrl}
            onChange={(value) => {
              setBannerUrl(value);
              setBannerKey(null);
              setBannerSourceType(value.trim() ? 'external_url' : null);
              setBannerError(null);
            }}
            placeholder="Or paste a direct image URL"
            disabled={bannerSourceType === 'uploaded'}
          />
          {bannerSourceType === 'uploaded' && (
            <p className="text-xs text-text-muted">
              Uploaded banner selected: {bannerKey}
              <Button
                type="button"
                variant="link"
                className="ml-2 align-baseline text-xs"
                onClick={() => {
                  setBannerUrl('');
                  setBannerKey(null);
                  setBannerSourceType(null);
                  setBannerError(null);
                }}
              >
                remove
              </Button>
            </p>
          )}
          <p className="text-xs text-text-muted">
            Used as the event cover in the planner and Discord Events. Uploads are stored with this event.
          </p>
          {bannerError && <p className="text-xs text-status-error">{bannerError}</p>}
        </div>

        {bannerUrl.trim() && (
          <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-elevated">
            <img
              src={bannerUrl.trim()}
              alt=""
              className="h-28 w-full object-cover"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}

        {discordDeliverySummary && (
          <div className="rounded-lg border border-border-subtle bg-surface-elevated/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <Label size="sm">Discord Delivery</Label>
              <span className="text-[11px] text-text-muted">Per-event controls</span>
            </div>
            <div className="mt-3 space-y-3">
              <Checkbox
                checked={mirrorToDiscord}
                onChange={setMirrorToDiscord}
                label={`Mirror to Discord Events${discordDeliverySummary.mirrorEnabled ? ` on ${discordDeliverySummary.serverLabel}` : ''}`}
                description={discordDeliverySummary.mirrorEnabled ? 'Creates native Discord scheduled events for generated occurrences.' : 'Connect Discord Events in settings before this can publish.'}
              />
              <Checkbox
                checked={sendDiscordReminders}
                onChange={setSendDiscordReminders}
                label={`Send Discord reminders${discordDeliverySummary.pingLabel !== 'No ping' ? ` with ${discordDeliverySummary.pingLabel}` : ''}`}
                description={discordDeliverySummary.remindersEnabled ? 'Webhook reminders use the same occurrence times.' : 'Configure a reminder webhook in settings before reminders can send.'}
              />
              <Checkbox
                checked={useReminderOverrides}
                onChange={setUseReminderOverrides}
                disabled={!sendDiscordReminders}
                label="Override reminder offsets for this event"
                description={useReminderOverrides ? 'Selected offsets below replace the static defaults.' : `Inherits: ${discordDeliverySummary.reminderLabels.join(', ') || 'no reminders'}`}
              />
              {useReminderOverrides && (
                <div className="grid gap-2 rounded border border-border-subtle bg-surface-card p-2 sm:grid-cols-2">
                  {REMINDER_OPTIONS.map((option) => (
                    <Checkbox
                      key={option.minutes}
                      checked={reminderOffsetsMinutes.includes(option.minutes)}
                      onChange={() => toggleReminderOffset(option.minutes)}
                      disabled={!sendDiscordReminders}
                      label={option.label}
                    />
                  ))}
                  <Checkbox
                    checked={missingRsvpReminderEnabled}
                    onChange={setMissingRsvpReminderEnabled}
                    disabled={!sendDiscordReminders}
                    label="Missing RSVP"
                  />
                </div>
              )}
            </div>
            <div className="mt-2 space-y-1.5 text-xs text-text-secondary">
              <p className="text-text-muted">
                {isRecurring
                  ? 'Recurring events mirror the next 4 weeks and reminders run for each generated occurrence.'
                  : 'This event mirrors and reminds from the same saved event time.'}
              </p>
              <p className="text-text-muted">Banner: {bannerUrl.trim() ? 'sent as the Discord Event cover image' : 'no event banner selected'}</p>
            </div>
          </div>
        )}

        <div>
          <Label size="sm">Category (optional)</Label>
          <Select
            value={category ?? ''}
            onChange={(val) => {
              setCategory((val || null) as EventCategory | null);
              setContentId(null);
              setContentName(null);
            }}
            options={[
              { value: '', label: 'No category' },
              ...EVENT_CATEGORIES.map(c => ({ value: c.value, label: c.label })),
            ]}
          />
        </div>

        {(category === 'farm' || category === 'ultimate' || category === 'raid' || category === 'reclear' || category === 'prog') && (
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
                  ? MOUNT_FARM_TRIALS
                      .filter(t => t.contentType !== 'ultimate')
                      .map(t => ({ value: t.id, label: `[${t.expansion}] ${t.dutyName}` }))
                  : category === 'ultimate'
                    ? MOUNT_FARM_TRIALS
                        .filter(t => t.contentType === 'ultimate')
                        .map(t => ({ value: t.id, label: `[${t.expansion}] ${t.dutyName}` }))
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

        <div className="rounded-lg border border-border-subtle bg-surface-muted/30 p-3">
          <Checkbox
            checked={trackAvailability}
            onChange={setTrackAvailability}
            label="Track availability"
          />
          <p className="mt-1.5 text-xs text-text-muted">
            {trackAvailability
              ? 'Members are expected to mark whether they can attend.'
              : 'Use this for fixed sessions where attendance is expected and availability does not need to be collected.'}
          </p>
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
