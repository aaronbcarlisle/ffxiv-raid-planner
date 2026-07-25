/**
 * DiscoveryTab — Interactive Static Finder Listing Builder
 *
 * Two-column layout:
 *   Left  — Listing Builder (Status · About · Schedule · Recruiting · Comms · Contact)
 *   Right — Sticky live preview + completion checklist
 *
 * On mobile the right panel collapses to a toggle at the top of the form.
 */

import { useState, useCallback, useRef } from 'react';
import {
  Globe, AlertTriangle, Sparkles, Info,
  CheckCircle2, XCircle, Clock, MapPin, Swords, Users, Eye,
  MessageCircle, ChevronDown, ChevronRight, Plus, X, Check,
  Mic, Headphones, MessageSquare,
} from 'lucide-react';
import { Label, Select, Toggle, TextArea, Input } from '../ui';
import { WorldSelect } from '../player/WorldSelect';
import { Button } from '../primitives';
import { useStaticGroupStore } from '../../stores/staticGroupStore';
import { toast } from '../../stores/toastStore';
import { authRequest } from '../../services/api';
import {
  getJobsByRole,
  getRoleForJob,
  getDCForWorld,
  TIMEZONES,
  LANGUAGES,
  RAID_DAYS,
  TIME_SLOTS,
  type Role,
} from '../../gamedata';
import type {
  StaticGroup,
  DiscoverySettings,
  ContactMethod,
  RecruitingRoleEntry,
  CommunicationStyle,
  VoiceRequirement,
} from '../../types';

// ─── Local types ─────────────────────────────────────────────────────────────

type RecruitmentStatus = 'open' | 'selective' | 'paused' | 'closed';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIGS: {
  value: RecruitmentStatus;
  label: string;
  desc: string;
  color: string;
  border: string;
  icon: typeof CheckCircle2;
}[] = [
  {
    value: 'open',
    label: 'Open',
    desc: 'Actively recruiting — anyone can apply',
    color: 'text-status-success',
    border: 'border-status-success/40 bg-status-success/5',
    icon: CheckCircle2,
  },
  {
    value: 'selective',
    label: 'Selective',
    desc: 'Reviewing strong fits only',
    color: 'text-status-warning',
    border: 'border-status-warning/40 bg-status-warning/5',
    icon: AlertTriangle,
  },
  {
    value: 'paused',
    label: 'Paused',
    desc: 'Not currently accepting new applications',
    color: 'text-text-secondary',
    border: 'border-border-default bg-surface-elevated',
    icon: Clock,
  },
  {
    value: 'closed',
    label: 'Closed',
    desc: 'Hidden from Static Finder search results',
    color: 'text-status-error',
    border: 'border-status-error/40 bg-status-error/5',
    icon: XCircle,
  },
];

const PROMPT_CHIPS = [
  { label: 'Midcore savage',      text: 'Midcore savage static. Consistent prog with no drama.' },
  { label: 'Blind prog friendly', text: 'Blind prog friendly — we figure out mechanics together.' },
  { label: 'Reclear focused',     text: 'Reclear-focused static. BiS farming and smooth clears.' },
  { label: 'Ultimate prog',       text: 'Currently progging Ultimate content.' },
  { label: 'Alt job friendly',    text: 'Alt job friendly — bring what works for the team.' },
];

const INTENSITY_OPTIONS = [
  { value: '',          label: 'Not specified' },
  { value: 'casual',    label: 'Casual' },
  { value: 'midcore',   label: 'Midcore' },
  { value: 'hardcore',  label: 'Hardcore' },
];

const ROLE_CONFIGS: { role: Role; label: string; colorClass: string }[] = [
  { role: 'tank',   label: 'Tank',           colorClass: 'text-role-tank' },
  { role: 'healer', label: 'Healer',         colorClass: 'text-role-healer' },
  { role: 'melee',  label: 'Melee',          colorClass: 'text-role-melee' },
  { role: 'ranged', label: 'Physical Ranged', colorClass: 'text-role-ranged' },
  { role: 'caster', label: 'Caster',         colorClass: 'text-role-caster' },
];

const VOICE_OPTIONS: { value: VoiceRequirement; label: string; icon: typeof Mic }[] = [
  { value: 'required',     label: 'Voice required',     icon: Mic },
  { value: 'preferred',    label: 'Voice preferred',    icon: Mic },
  { value: 'listening_ok', label: 'Listening only OK',  icon: Headphones },
  { value: 'text_only',    label: 'Text only OK',       icon: MessageSquare },
];

const CONTACT_METHOD_CONFIGS: {
  value: ContactMethod;
  label: string;
  placeholder: string;
}[] = [
  { value: 'discord',        label: 'Discord username',        placeholder: 'e.g. @username or username#1234' },
  { value: 'discord_server', label: 'Discord server invite',   placeholder: 'e.g. https://discord.gg/abcdef' },
  { value: 'url',            label: 'Link (Lodestone / site)', placeholder: 'e.g. https://na.finalfantasyxiv.com/...' },
  { value: 'text',           label: 'Other / instructions',    placeholder: 'e.g. DM me on Twitter @handle' },
];

const EMPTY_DISCOVERY: DiscoverySettings = { enabled: false, recruitmentStatus: 'closed' };

const SECTION_IDS = ['status', 'about', 'schedule', 'recruiting', 'comms', 'contact'] as const;
type SectionId = typeof SECTION_IDS[number];
const SECTION_LABELS: Record<SectionId, string> = {
  status:     'Status',
  about:      'About',
  schedule:   'Schedule',
  recruiting: 'Recruiting',
  comms:      'Comms',
  contact:    'Contact',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeStatus(s: string | undefined): RecruitmentStatus {
  if (s === 'limited') return 'selective'; // legacy migration
  if (['open', 'selective', 'paused', 'closed'].includes(s ?? '')) return s as RecruitmentStatus;
  return 'closed';
}

function getDiscovery(group: StaticGroup): DiscoverySettings {
  return group.settings?.discovery ?? EMPTY_DISCOVERY;
}

function initRecruitingRoles(existing: DiscoverySettings): RecruitingRoleEntry[] {
  if (existing.recruitingRoles && existing.recruitingRoles.length > 0) {
    return existing.recruitingRoles;
  }
  const neededRoles = existing.neededRoles ?? [];
  const neededJobs  = existing.neededJobs  ?? [];
  if (neededRoles.length === 0 && neededJobs.length === 0) return [];

  const entries: RecruitingRoleEntry[] = neededRoles.map(role => ({
    role,
    priority: 'needed',
    jobs: neededJobs.filter(j => getRoleForJob(j) === role),
  }));

  // Jobs whose role wasn't listed in neededRoles
  neededJobs.forEach(job => {
    const role = getRoleForJob(job);
    if (!role || neededRoles.includes(role)) return;
    const entry = entries.find(e => e.role === role);
    if (entry) {
      if (!entry.jobs.includes(job)) entry.jobs.push(job);
    } else {
      entries.push({ role, priority: 'needed', jobs: [job] });
    }
  });

  return entries;
}

function getLangLabel(code: string): string {
  return LANGUAGES.find(l => l.code === code)?.label ?? code;
}

function getStatusColors(status: RecruitmentStatus) {
  const map: Record<RecruitmentStatus, string> = {
    open:      'bg-status-success/20 text-status-success border-status-success/30',
    selective: 'bg-status-warning/20 text-status-warning border-status-warning/30',
    paused:    'bg-surface-elevated text-text-secondary border-border-default',
    closed:    'bg-status-error/20 text-status-error border-status-error/30',
  };
  return map[status] ?? map.closed;
}

// ─── Shared small components ──────────────────────────────────────────────────

function SectionBlock({
  id,
  title,
  innerRef,
  children,
}: {
  id: SectionId;
  title: string;
  innerRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  return (
    <div ref={innerRef} id={id} className="space-y-3 scroll-mt-2">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider border-b border-border-subtle pb-1.5">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    /* design-system-ignore: toggle chip for multi-select */
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
        active
          ? 'bg-accent/20 text-accent border-accent/40'
          : 'bg-surface-elevated text-text-secondary border-border-default hover:border-border-subtle hover:text-text-primary'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {label}
    </button>
  );
}

// ─── Status section ───────────────────────────────────────────────────────────

function StatusCards({
  value,
  onChange,
  disabled,
}: {
  value: RecruitmentStatus;
  onChange: (v: RecruitmentStatus) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {STATUS_CONFIGS.map(cfg => {
        const active = value === cfg.value;
        const Icon = cfg.icon;
        return (
          /* design-system-ignore: status selection card */
          <button
            key={cfg.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(cfg.value)}
            className={`rounded-xl border p-3 text-left transition-all ${
              active ? `${cfg.border} ring-2 ring-offset-1 ring-offset-surface-base` : 'border-border-default bg-surface-elevated hover:border-border-subtle'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            style={active ? { '--tw-ring-color': 'var(--color-accent)' } as React.CSSProperties : undefined}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${active ? cfg.color : 'text-text-muted'}`} />
              <span className={`text-xs font-semibold ${active ? cfg.color : 'text-text-primary'}`}>
                {cfg.label}
              </span>
              {active && <Check className="w-3 h-3 ml-auto text-accent" />}
            </div>
            <p className="text-[10px] text-text-muted leading-snug">{cfg.desc}</p>
          </button>
        );
      })}
    </div>
  );
}

// ─── Role card ────────────────────────────────────────────────────────────────

function RoleCard({
  config,
  entry,
  onToggleRole,
  onPriority,
  onJobToggle,
  canEdit,
}: {
  config: typeof ROLE_CONFIGS[number];
  entry: RecruitingRoleEntry | undefined;
  onToggleRole: () => void;
  onPriority: (p: 'needed' | 'nice_to_have') => void;
  onJobToggle: (job: string) => void;
  canEdit: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const jobs = getJobsByRole(config.role);
  const selected = entry !== undefined;
  const selectedJobs = entry?.jobs ?? [];
  const allSelected = selectedJobs.length === 0; // empty jobs = whole role
  const jobCount = selectedJobs.length;

  return (
    <div
      className={`rounded-xl border transition-colors ${
        selected ? 'border-accent/30 bg-accent/5' : 'border-border-default bg-surface-elevated'
      }`}
    >
      {/* Role header row */}
      <div className="flex items-center gap-2 p-3">
        {/* toggle */}
        {/* design-system-ignore */}
        <button
          type="button"
          disabled={!canEdit}
          onClick={onToggleRole}
          className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
            selected
              ? 'bg-accent border-accent'
              : 'border-border-default bg-surface-base'
          } ${!canEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {selected && <Check className="w-2.5 h-2.5 text-accent-contrast" />}
        </button>

        <span className={`text-sm font-semibold flex-1 ${config.colorClass}`}>{config.label}</span>

        {selected && (
          <>
            {/* Priority badge */}
            {/* design-system-ignore */}
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => onPriority(entry?.priority === 'nice_to_have' ? 'needed' : 'nice_to_have')}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                entry?.priority === 'needed'
                  ? 'bg-accent/15 text-accent border-accent/30'
                  : 'bg-surface-base text-text-muted border-border-default'
              } ${!canEdit ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {entry?.priority === 'needed' ? 'Needed' : 'Nice to have'}
            </button>

            <span className="text-[10px] text-text-muted">
              {allSelected ? `All ${jobs.length}` : `${jobCount}/${jobs.length}`}
            </span>
          </>
        )}

        {/* expand/collapse jobs */}
        {/* design-system-ignore */}
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="text-text-muted hover:text-text-primary transition-colors"
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Job chips */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-border-subtle pt-2 space-y-2">
          <p className="text-[10px] text-text-muted">
            Select specific jobs, or leave blank to accept any {config.label}.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {jobs.map(j => (
              <Chip
                key={j.abbreviation}
                label={j.abbreviation}
                active={selectedJobs.includes(j.abbreviation)}
                onClick={() => onJobToggle(j.abbreviation)}
                disabled={!canEdit || !selected}
              />
            ))}
          </div>
          {selected && canEdit && (
            <div className="flex gap-2 pt-1">
              {/* design-system-ignore */}
              <button
                type="button"
                className="text-[10px] text-accent hover:underline"
                onClick={() => jobs.forEach(j => {
                  if (!selectedJobs.includes(j.abbreviation)) onJobToggle(j.abbreviation);
                })}
              >
                Select all
              </button>
              {selectedJobs.length > 0 && (
                /* design-system-ignore */
                <button
                  type="button"
                  className="text-[10px] text-text-muted hover:underline"
                  onClick={() => selectedJobs.forEach(j => onJobToggle(j))}
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Language selector ────────────────────────────────────────────────────────

function LanguageSelector({
  selected,
  onChange,
  canEdit,
}: {
  selected: string[];
  onChange: (langs: string[]) => void;
  canEdit: boolean;
}) {
  const [customInput, setCustomInput] = useState('');

  const toggle = (code: string) => {
    onChange(selected.includes(code) ? selected.filter(c => c !== code) : [...selected, code]);
  };

  const addCustom = () => {
    const val = customInput.trim();
    if (!val || selected.includes(val)) return;
    onChange([...selected, val]);
    setCustomInput('');
  };

  // Custom languages = those not in the preset list
  const customLangs = selected.filter(c => !LANGUAGES.some(l => l.code === c));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {LANGUAGES.map(l => (
          <Chip
            key={l.code}
            label={l.label}
            active={selected.includes(l.code)}
            onClick={() => toggle(l.code)}
            disabled={!canEdit}
          />
        ))}
      </div>

      {/* Custom language entries */}
      {customLangs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {customLangs.map(code => (
            <span
              key={code}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border bg-accent/20 text-accent border-accent/40"
            >
              {code}
              {canEdit && (
                /* design-system-ignore */
                <button
                  type="button"
                  onClick={() => onChange(selected.filter(c => c !== code))}
                  className="hover:text-status-error transition-colors"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Custom input */}
      {canEdit && (
        <div className="flex gap-2">
          {/* design-system-ignore: custom language input needs onKeyDown for Enter-to-add; Input primitive does not expose it */}
          <input
            type="text"
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
            placeholder="Add language…"
            maxLength={40}
            className="flex-1 min-w-0 px-2.5 py-1 rounded-lg border border-border-default bg-surface-elevated text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={addCustom}
            disabled={!customInput.trim()}
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Completion checklist ────────────────────────────────────────────────────

interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  required?: boolean;
}

function CompletionChecklist({ items, enabled }: { items: ChecklistItem[]; enabled: boolean }) {
  const done   = items.filter(i => i.done).length;
  const total  = items.length;
  const pct    = Math.round((done / total) * 100);
  const qualityLabel =
    pct === 100 ? 'Complete' : pct >= 70 ? 'Good' : pct >= 40 ? 'Fair' : 'Incomplete';
  const qualityColor =
    pct === 100 ? 'text-status-success' : pct >= 70 ? 'text-accent' : pct >= 40 ? 'text-status-warning' : 'text-text-muted';

  return (
    <div className="rounded-xl border border-border-default bg-surface-elevated p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-text-primary">Listing Quality</p>
        <span className={`text-xs font-semibold ${qualityColor}`}>{qualityLabel}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-surface-base overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            pct === 100 ? 'bg-status-success' : pct >= 70 ? 'bg-accent' : pct >= 40 ? 'bg-status-warning' : 'bg-status-error'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="space-y-1">
        {items.map(item => (
          <li key={item.key} className="flex items-center gap-2 text-xs">
            {item.done ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-status-success flex-shrink-0" />
            ) : (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-border-default flex-shrink-0" />
            )}
            <span className={item.done ? 'text-text-secondary' : 'text-text-muted'}>{item.label}</span>
          </li>
        ))}
      </ul>

      {!enabled && (
        <p className="text-[10px] text-status-warning border-t border-border-subtle pt-2">
          Enable listing to appear in Static Finder.
        </p>
      )}
    </div>
  );
}

// ─── Listing preview ──────────────────────────────────────────────────────────

function ListingPreview({
  name, recruitmentStatus, description, intensity,
  dataCenter, server, timezone,
  recruitingRoles, selectedLangs, communicationStyle,
  scheduleDays, scheduleStartTime, scheduleEndTime,
  memberCount, contactMethod, contactValue,
}: {
  name: string;
  recruitmentStatus: RecruitmentStatus;
  description: string;
  intensity: string;
  dataCenter: string;
  server: string;
  timezone: string;
  recruitingRoles: RecruitingRoleEntry[];
  selectedLangs: string[];
  communicationStyle: CommunicationStyle;
  scheduleDays: string[];
  scheduleStartTime: string;
  scheduleEndTime: string;
  memberCount: number;
  contactMethod: string;
  contactValue: string;
}) {
  const statusClass = getStatusColors(recruitmentStatus);
  const tzDisplay = TIMEZONES.find(t => t.value === timezone)?.label ?? timezone;
  const shortDay = (d: string) => d.slice(0, 3);

  // Flatten roles/jobs for display
  const neededRoleLabels = recruitingRoles
    .filter(r => r.priority === 'needed')
    .map(r => r.jobs.length === 0
      ? ROLE_CONFIGS.find(c => c.role === r.role)?.label ?? r.role
      : r.jobs.join('/')
    );
  const niceRoleLabels = recruitingRoles
    .filter(r => r.priority === 'nice_to_have')
    .map(r => r.jobs.length === 0
      ? (ROLE_CONFIGS.find(c => c.role === r.role)?.label ?? r.role) + '?'
      : r.jobs.join('/') + '?'
    );
  const allRoleLabels = [...neededRoleLabels, ...niceRoleLabels];

  const voiceLabel = VOICE_OPTIONS.find(v => v.value === communicationStyle.voiceRequirement)?.label;

  return (
    <div className="rounded-xl border border-border-default bg-surface-base overflow-hidden">
      <div className="px-3 py-2 bg-surface-elevated border-b border-border-default flex items-center gap-1.5 text-text-muted text-xs">
        <Eye className="w-3.5 h-3.5" />
        <span className="font-medium">Live Preview</span>
        <span className="text-[10px] ml-auto opacity-60">What players see</span>
      </div>
      <div className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <span className="font-display font-semibold text-sm text-text-primary break-words min-w-0">{name || 'Static name'}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border flex-shrink-0 capitalize ${statusClass}`}>
            {recruitmentStatus}
          </span>
        </div>

        {/* Location + intensity */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-secondary">
          {(dataCenter || server) && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {[dataCenter, server].filter(Boolean).join(' / ')}
            </span>
          )}
          {timezone && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {tzDisplay}
            </span>
          )}
          {intensity && (
            <span className="px-1.5 py-0.5 bg-accent/10 text-accent border border-accent/20 rounded text-[10px] capitalize">
              {intensity}
            </span>
          )}
        </div>

        {/* Schedule */}
        {scheduleDays.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-text-secondary">
            <Swords className="w-3 h-3 text-text-muted" />
            <span>
              {scheduleDays.map(shortDay).join(' / ')}
              {scheduleStartTime && ` · ${scheduleStartTime}`}
              {scheduleEndTime && `–${scheduleEndTime}`}
            </span>
          </div>
        )}

        {/* Recruiting */}
        {allRoleLabels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {allRoleLabels.map((label, i) => (
              <span
                key={i}
                className={`px-1.5 py-0.5 rounded text-[10px] border ${
                  label.endsWith('?')
                    ? 'bg-surface-elevated text-text-secondary border-border-default'
                    : 'bg-accent/10 text-accent border-accent/20'
                }`}
              >
                {label}
              </span>
            ))}
          </div>
        )}

        {/* Languages + comms */}
        {(selectedLangs.length > 0 || voiceLabel) && (
          <div className="flex flex-wrap gap-1">
            {selectedLangs.map(l => (
              <span key={l} className="px-1.5 py-0.5 bg-surface-elevated text-text-secondary border border-border-default rounded text-[10px]">
                {getLangLabel(l)}
              </span>
            ))}
            {voiceLabel && (
              <span className="px-1.5 py-0.5 bg-surface-elevated text-text-muted border border-border-default rounded text-[10px] flex items-center gap-1">
                <Mic className="w-2.5 h-2.5" />
                {voiceLabel}
              </span>
            )}
          </div>
        )}

        {/* Description */}
        {description ? (
          <p className="text-text-secondary text-xs line-clamp-2 break-words">{description}</p>
        ) : (
          <p className="text-text-muted text-xs italic">No description yet</p>
        )}

        {/* Contact */}
        {contactMethod && contactValue && (
          <div className="flex items-center gap-1 text-xs text-accent min-w-0">
            <MessageCircle className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{contactValue}</span>
          </div>
        )}

        {/* Member count */}
        {memberCount > 0 && (
          <div className="flex items-center gap-1 text-text-muted text-[10px] pt-1 border-t border-border-default">
            <Users className="w-3 h-3" />
            <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface DiscoveryTabProps {
  group: StaticGroup;
  onClose: () => void;
}

export function DiscoveryTab({ group, onClose }: DiscoveryTabProps) {
  const { updateGroup } = useStaticGroupStore();
  const existing = getDiscovery(group);

  // ── State ────────────────────────────────────────────────────────────────────
  const [enabled,            setEnabled]            = useState(existing.enabled);
  const [recruitmentStatus,  setRecruitmentStatus]  = useState<RecruitmentStatus>(normalizeStatus(existing.recruitmentStatus));
  const [description,        setDescription]        = useState(existing.description ?? '');
  const [intensity,          setIntensity]          = useState(existing.intensity ?? '');
  const [contactMethod,      setContactMethod]      = useState<ContactMethod | ''>(existing.contactMethod ?? '');
  const [contactValue,       setContactValue]       = useState(existing.contactValue ?? '');
  const [dataCenter,         setDataCenter]         = useState(existing.dataCenter ?? '');
  const [server,             setServer]             = useState(existing.server ?? '');
  const [timezone,           setTimezone]           = useState(existing.timezone ?? '');
  const [selectedLangs,      setSelectedLangs]      = useState<string[]>(existing.languages ?? []);
  const [scheduleDays,       setScheduleDays]       = useState<string[]>(existing.scheduleDays ?? []);
  const [scheduleStartTime,  setScheduleStartTime]  = useState(existing.scheduleStartTime ?? '');
  const [scheduleEndTime,    setScheduleEndTime]    = useState(existing.scheduleEndTime ?? '');
  const [showMemberCount,    setShowMemberCount]    = useState(existing.showMemberCount ?? false);
  const [recruitingRoles,    setRecruitingRoles]    = useState<RecruitingRoleEntry[]>(() => initRecruitingRoles(existing));
  const [communicationStyle, setCommunicationStyle] = useState<CommunicationStyle>(existing.communicationStyle ?? {});
  const [showMobilePreview,  setShowMobilePreview]  = useState(false);
  const [isSaving,           setIsSaving]           = useState(false);
  const [isSuggesting,       setIsSuggesting]       = useState(false);
  const [error,              setError]              = useState<string | null>(null);

  const canEdit = group.userRole === 'owner' || group.userRole === 'lead';

  // ── Section refs ─────────────────────────────────────────────────────────────
  const refs = {
    status:     useRef<HTMLDivElement>(null),
    about:      useRef<HTMLDivElement>(null),
    schedule:   useRef<HTMLDivElement>(null),
    recruiting: useRef<HTMLDivElement>(null),
    comms:      useRef<HTMLDivElement>(null),
    contact:    useRef<HTMLDivElement>(null),
  } as const;

  const scrollTo = (id: SectionId) => {
    refs[id].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── Options ──────────────────────────────────────────────────────────────────
  // DC/World options now live inside the shared WorldSelect component.
  const tzOptions = [
    { value: '', label: 'Not specified' },
    ...TIMEZONES.map(tz => ({ value: tz.value, label: tz.label })),
  ];
  const timeOptions = [
    { value: '', label: 'Not set' },
    ...TIME_SLOTS.map(t => ({ value: t, label: t })),
  ];

  // ── Recruiting role helpers ──────────────────────────────────────────────────
  const toggleRole = useCallback((role: string) => {
    setRecruitingRoles(prev => {
      const exists = prev.find(r => r.role === role);
      return exists ? prev.filter(r => r.role !== role) : [...prev, { role, priority: 'needed', jobs: [] }];
    });
  }, []);

  const setRolePriority = useCallback((role: string, priority: 'needed' | 'nice_to_have') => {
    setRecruitingRoles(prev => prev.map(r => r.role === role ? { ...r, priority } : r));
  }, []);

  const toggleJobInRole = useCallback((role: string, job: string) => {
    setRecruitingRoles(prev => prev.map(r => {
      if (r.role !== role) return r;
      const jobs = r.jobs.includes(job) ? r.jobs.filter(j => j !== job) : [...r.jobs, job];
      return { ...r, jobs };
    }));
  }, []);

  // ── Suggest from static ──────────────────────────────────────────────────────
  const handleSuggest = async () => {
    setIsSuggesting(true);
    try {
      const suggestions = await authRequest<Record<string, unknown>>(
        `/api/static-groups/${group.id}/discovery/suggestions`
      );
      let filled = 0;
      if (!timezone && suggestions.timezone)       { setTimezone(suggestions.timezone as string); filled++; }
      if (!server   && suggestions.server) {
        const s = suggestions.server as string;
        setServer(s); filled++;
        if (!dataCenter) {
          const dc = getDCForWorld(s);
          if (dc) { setDataCenter(dc); filled++; }
        }
      }
      if (scheduleDays.length === 0 && Array.isArray(suggestions.scheduleDays))  { setScheduleDays(suggestions.scheduleDays as string[]); filled++; }
      if (!scheduleStartTime && suggestions.scheduleStartTime) { setScheduleStartTime(suggestions.scheduleStartTime as string); filled++; }
      if (!scheduleEndTime   && suggestions.scheduleEndTime)   { setScheduleEndTime(suggestions.scheduleEndTime as string); filled++; }
      if (recruitingRoles.length === 0 && Array.isArray(suggestions.neededRoles)) {
        setRecruitingRoles((suggestions.neededRoles as string[]).map(role => ({ role, priority: 'needed', jobs: [] })));
        filled++;
      }
      if (filled > 0) toast.success(`Filled ${filled} field${filled > 1 ? 's' : ''} from your static`);
      else            toast.info('All fields already have values, or no suggestions available');
    } catch {
      toast.error('Could not load suggestions');
    } finally {
      setIsSuggesting(false);
    }
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    // Derive legacy fields for backward compat
    const neededRoles = [...new Set(recruitingRoles.map(r => r.role))];
    const neededJobs  = [...new Set(recruitingRoles.flatMap(r => r.jobs))];

    const discovery: DiscoverySettings = {
      enabled,
      recruitmentStatus,
      description: description || undefined,
      contactMethod: (contactMethod || undefined) as ContactMethod | undefined,
      contactValue: contactMethod && contactValue ? contactValue.trim().slice(0, 200) : undefined,
      intensity: (intensity || undefined) as DiscoverySettings['intensity'],
      dataCenter: dataCenter || undefined,
      server: server || undefined,
      timezone: timezone || undefined,
      languages: selectedLangs.length > 0 ? selectedLangs : undefined,
      neededRoles: neededRoles.length > 0 ? neededRoles : undefined,
      neededJobs:  neededJobs.length  > 0 ? neededJobs  : undefined,
      scheduleDays: scheduleDays.length > 0 ? scheduleDays : undefined,
      scheduleStartTime: scheduleStartTime || undefined,
      scheduleEndTime:   scheduleEndTime   || undefined,
      showMemberCount,
      recruitingRoles: recruitingRoles.length > 0 ? recruitingRoles : undefined,
      communicationStyle: Object.keys(communicationStyle).length > 0 ? communicationStyle : undefined,
    };

    try {
      await updateGroup(group.id, { settings: { ...group.settings, discovery } });
      if (enabled && group.isPublic)  toast.success('Saved! Your listing is live in Static Finder.');
      else if (enabled)               toast.success('Saved! It will go live once Public Static is enabled.');
      else                            toast.success('Listing settings saved.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };


  // ── Checklist ────────────────────────────────────────────────────────────────
  const checklist: ChecklistItem[] = [
    { key: 'public',    label: 'Static is public',        done: group.isPublic },
    { key: 'enabled',   label: 'Listed in Static Finder', done: enabled },
    { key: 'status',    label: 'Recruitment status set',  done: recruitmentStatus !== 'closed' },
    { key: 'desc',      label: 'Description added',       done: description.length > 0 },
    { key: 'roles',     label: 'Roles / jobs recruiting', done: recruitingRoles.length > 0 },
    { key: 'schedule',  label: 'Schedule set',            done: scheduleDays.length > 0 && !!scheduleStartTime },
    { key: 'contact',   label: 'Contact method',          done: !!(contactMethod && contactValue) },
    { key: 'comms',     label: 'Languages / comms',       done: selectedLangs.length > 0 || !!communicationStyle.voiceRequirement },
  ];

  // ── Preview props ────────────────────────────────────────────────────────────
  const previewProps = {
    name: group.name,
    recruitmentStatus,
    description,
    intensity,
    dataCenter,
    server,
    timezone,
    recruitingRoles,
    selectedLangs,
    communicationStyle,
    scheduleDays,
    scheduleStartTime,
    scheduleEndTime,
    memberCount: showMemberCount ? (group.memberCount ?? 0) : 0,
    contactMethod,
    contactValue,
  };

  const scheduleLabel = [
    scheduleDays.length > 0 ? scheduleDays.map(d => d.slice(0, 3)).join(' / ') : null,
    scheduleStartTime && scheduleEndTime ? `${scheduleStartTime}–${scheduleEndTime}` : scheduleStartTime || null,
    timezone ? (TIMEZONES.find(t => t.value === timezone)?.label ?? timezone) : null,
  ].filter(Boolean).join(' · ');

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* Body — two columns */}
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_288px] gap-x-6 min-h-full pb-4">

          {/* ─── Left: Builder ─── */}
          <div className="space-y-7 py-1 pr-0.5 min-w-0">

            {/* Section nav */}
            <div className="flex gap-1 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1" role="navigation">
              {SECTION_IDS.map(id => (
                /* design-system-ignore */
                <button
                  key={id}
                  type="button"
                  onClick={() => scrollTo(id)}
                  className="flex-shrink-0 px-3 py-1 rounded-lg text-xs font-medium text-text-secondary border border-border-default bg-surface-elevated hover:text-text-primary hover:border-border-subtle transition-colors"
                >
                  {SECTION_LABELS[id]}
                </button>
              ))}
            </div>

            {/* Mobile preview toggle */}
            <div className="xl:hidden">
              {/* design-system-ignore */}
              <button
                type="button"
                onClick={() => setShowMobilePreview(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border-default bg-surface-elevated text-xs text-text-secondary hover:text-text-primary transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  {showMobilePreview ? 'Hide Preview & Checklist' : 'View Preview & Checklist'}
                </span>
                {showMobilePreview ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
              {showMobilePreview && (
                <div className="mt-3 space-y-3">
                  <ListingPreview {...previewProps} />
                  <CompletionChecklist items={checklist} enabled={enabled} />
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-status-error/10 border border-status-error/30 rounded-lg text-status-error text-sm">
                {error}
              </div>
            )}

            {/* ─── Status section ─── */}
            <SectionBlock id="status" title="Status" innerRef={refs.status}>
              {!group.isPublic && (
                <div className="p-3 bg-status-warning/10 border border-status-warning/30 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-status-warning flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-text-secondary">
                    Static is <strong className="text-text-primary">private</strong> — enable Public Static in the General tab for this listing to go live.
                  </p>
                </div>
              )}

              <Toggle
                checked={enabled}
                onChange={setEnabled}
                disabled={!canEdit}
                label="List in Static Finder"
                hint="Players can discover your static when browsing for groups"
              />

              {enabled && (
                <>
                  <Label>Recruitment Status</Label>
                  <StatusCards value={recruitmentStatus} onChange={setRecruitmentStatus} disabled={!canEdit} />
                  <Toggle
                    checked={showMemberCount}
                    onChange={setShowMemberCount}
                    disabled={!canEdit}
                    label="Show member count"
                    hint="Optional — lets applicants see how full your group is"
                  />
                </>
              )}
            </SectionBlock>

            {/* ─── About section ─── */}
            <SectionBlock id="about" title="About" innerRef={refs.about}>
              <div className="p-2.5 bg-surface-elevated border border-border-default rounded-lg flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" />
                <p className="text-xs text-text-secondary">
                  Description and contact info are <strong className="text-text-primary">public</strong>. Do not include anything private.
                </p>
              </div>

              <div>
                <Label htmlFor="discoveryDesc">Description</Label>
                <TextArea
                  id="discoveryDesc"
                  value={description}
                  onChange={setDescription}
                  placeholder="Tell recruits about your static — goals, vibe, loot rules, raid history."
                  rows={3}
                  maxLength={500}
                  disabled={!canEdit}
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-text-muted text-[10px]">{description.length}/500</p>
                </div>
                {/* Prompt chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {PROMPT_CHIPS.map(chip => (
                    /* design-system-ignore */
                    <button
                      key={chip.label}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => {
                        setDescription(prev => {
                          const sep = prev.trim() ? ' ' : '';
                          return (prev + sep + chip.text).slice(0, 500);
                        });
                      }}
                      className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      + {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="intensity">Vibe</Label>
                <Select id="intensity" value={intensity} onChange={setIntensity} options={INTENSITY_OPTIONS} disabled={!canEdit} />
              </div>

              <WorldSelect
                showDataCenter
                dataCenter={dataCenter}
                onDataCenterChange={setDataCenter}
                world={server}
                onWorldChange={setServer}
                disabled={!canEdit}
              />
            </SectionBlock>

            {/* ─── Schedule section ─── */}
            <SectionBlock id="schedule" title="Schedule" innerRef={refs.schedule}>
              {canEdit && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="secondary" size="sm" onClick={handleSuggest} loading={isSuggesting}>
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Fill from current schedule
                  </Button>
                  <span className="text-[10px] text-text-muted">Only fills empty fields</span>
                </div>
              )}

              <div>
                <Label>Raid Days</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {RAID_DAYS.map(d => (
                    <Chip
                      key={d}
                      label={d.slice(0, 3)}
                      active={scheduleDays.includes(d)}
                      onClick={() => setScheduleDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
                      disabled={!canEdit}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="startTime">Start Time</Label>
                  <Select id="startTime" value={scheduleStartTime} onChange={setScheduleStartTime} options={timeOptions} disabled={!canEdit} />
                </div>
                <div>
                  <Label htmlFor="endTime">End Time</Label>
                  <Select id="endTime" value={scheduleEndTime} onChange={setScheduleEndTime} options={timeOptions} disabled={!canEdit} />
                </div>
              </div>

              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Select id="timezone" value={timezone} onChange={setTimezone} options={tzOptions} disabled={!canEdit} />
              </div>

              {scheduleLabel && (
                <p className="text-xs text-text-secondary bg-surface-elevated border border-border-default rounded-lg px-3 py-2">
                  <Swords className="w-3 h-3 inline mr-1.5 text-text-muted" />
                  {scheduleLabel}
                </p>
              )}
            </SectionBlock>

            {/* ─── Recruiting section ─── */}
            <SectionBlock id="recruiting" title="Recruiting" innerRef={refs.recruiting}>
              <p className="text-xs text-text-muted">
                Select role groups to recruit. Expand a role to choose specific jobs or adjust priority.
              </p>
              <div className="space-y-2">
                {ROLE_CONFIGS.map(cfg => (
                  <RoleCard
                    key={cfg.role}
                    config={cfg}
                    entry={recruitingRoles.find(r => r.role === cfg.role)}
                    onToggleRole={() => toggleRole(cfg.role)}
                    onPriority={p => setRolePriority(cfg.role, p)}
                    onJobToggle={job => toggleJobInRole(cfg.role, job)}
                    canEdit={canEdit}
                  />
                ))}
              </div>
            </SectionBlock>

            {/* ─── Comms section ─── */}
            <SectionBlock id="comms" title="Communication" innerRef={refs.comms}>
              <div>
                <Label>Languages</Label>
                <LanguageSelector
                  selected={selectedLangs}
                  onChange={setSelectedLangs}
                  canEdit={canEdit}
                />
              </div>

              <div>
                <Label>Voice / Comms</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {VOICE_OPTIONS.map(opt => {
                    const active = communicationStyle.voiceRequirement === opt.value;
                    const Icon = opt.icon;
                    return (
                      /* design-system-ignore */
                      <button
                        key={opt.value}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => setCommunicationStyle(prev => ({
                          ...prev,
                          voiceRequirement: active ? undefined : opt.value,
                        }))}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs text-left transition-colors ${
                          active
                            ? 'border-accent/40 bg-accent/10 text-accent'
                            : 'border-border-default bg-surface-elevated text-text-secondary hover:border-border-subtle hover:text-text-primary'
                        } ${!canEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Toggle
                checked={communicationStyle.discordRequired ?? false}
                onChange={v => setCommunicationStyle(prev => ({ ...prev, discordRequired: v || undefined }))}
                disabled={!canEdit}
                label="Discord required"
                hint="Members must be in a Discord server"
              />
            </SectionBlock>

            {/* ─── Contact section ─── */}
            <SectionBlock id="contact" title="Contact" innerRef={refs.contact}>
              <div className="p-2.5 bg-surface-elevated border border-border-default rounded-lg flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-text-muted flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-text-muted leading-relaxed">
                  Contact info is <strong className="text-text-secondary">public</strong> on Static Finder. Do not post anything you want to keep private.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {CONTACT_METHOD_CONFIGS.map(cfg => {
                  const active = contactMethod === cfg.value;
                  return (
                    /* design-system-ignore */
                    <button
                      key={cfg.value}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => {
                        setContactMethod(active ? '' : cfg.value);
                        if (active) setContactValue('');
                      }}
                      className={`px-3 py-2 rounded-lg border text-xs text-left transition-colors ${
                        active
                          ? 'border-accent/40 bg-accent/10 text-accent'
                          : 'border-border-default bg-surface-elevated text-text-secondary hover:border-border-subtle hover:text-text-primary'
                      } ${!canEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>

              {contactMethod && (
                <div>
                  <Input
                    value={contactValue}
                    onChange={setContactValue}
                    placeholder={CONTACT_METHOD_CONFIGS.find(c => c.value === contactMethod)?.placeholder ?? ''}
                    maxLength={200}
                    disabled={!canEdit}
                  />
                  <p className="text-[10px] text-text-muted mt-1">{contactValue.length}/200</p>
                </div>
              )}
            </SectionBlock>

          </div>{/* end left column */}

          {/* ─── Right: Sticky preview + checklist ─── */}
          <div className="hidden xl:block">
            <div className="sticky top-4 space-y-4">
              <ListingPreview {...previewProps} />
              <CompletionChecklist items={checklist} enabled={enabled} />
            </div>
          </div>

        </div>
      </div>

      {/* ─── Sticky footer ─── */}
      <div className="flex-shrink-0 flex justify-end gap-3 pt-3 pb-4 pr-4 border-t border-border-default">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={!canEdit} loading={isSaving}>
          <Globe className="w-4 h-4 mr-1.5" />
          Save Listing
        </Button>
      </div>
    </div>
  );
}
