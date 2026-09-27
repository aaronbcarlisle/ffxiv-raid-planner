/**
 * FinderFilters — the Static Finder's filter column (R-SF-N).
 */
import { useState } from 'react';
import { Checkbox, Input, Select } from '../ui';
import { Button } from '../primitives';
import { Tag } from '../ui/Tag';
import { LinkText } from '../ui/LinkText';
import type { FinderSetters, FinderState } from './useFinderQuery';
import { ROLE_CHIP_LABELS, ROLE_KEYS, type FitViewer } from './types';
import {
  JOB_OPTIONS,
  INTENSITY_OPTIONS,
  GOAL_CATEGORY_OPTIONS,
  GOAL_CATEGORY_LABELS,
  DC_OPTIONS,
  TZ_OPTIONS,
  LANG_OPTIONS,
  FINDER_RECRUITMENT_OPTIONS,
  buildServerOptions,
} from './discoveryOptions';

const GROUP_LABEL = 'text-text-muted text-xs font-medium uppercase tracking-widest opacity-60 mb-2';

interface FinderFiltersProps {
  state: FinderState;
  setters: FinderSetters;
  viewer: FitViewer | null;
  isGuest: boolean;
  hasFilters: boolean;
  clearFilters: () => void;
  moreFiltersInitiallyOpen: boolean;
}

export function FinderFilters({
  state, setters, viewer, isGuest, hasFilters, clearFilters, moreFiltersInitiallyOpen,
}: FinderFiltersProps) {
  const [moreOpen, setMoreOpen] = useState(moreFiltersInitiallyOpen);
  const noTemplate = !!viewer?.missing.includes('template');
  const effectiveRole = state.asRole || viewer?.mainRole || '';

  const toggleGoalCategory = (value: string) => {
    setters.setGoalCategory(
      state.goalCategory.includes(value)
        ? state.goalCategory.filter(v => v !== value)
        : [...state.goalCategory, value],
    );
  };

  return (
    <div className="flex flex-col gap-5" data-testid="finder-filters">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">Filters</h2>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>Clear all</Button>
        )}
      </div>

      <Input
        id="finder-search"
        value={state.q}
        onChange={setters.setQ}
        placeholder="Search by name or description..."
        aria-label="Search"
      />

      <div>
        <p className={GROUP_LABEL}>Content</p>
        <div className="flex flex-col gap-2">
          {GOAL_CATEGORY_OPTIONS.filter(o => o.value).map(o => (
            <Checkbox
              key={o.value}
              id={`finder-goal-${o.value}`}
              checked={state.goalCategory.includes(o.value)}
              onChange={() => toggleGoalCategory(o.value)}
              label={GOAL_CATEGORY_LABELS[o.value] ?? o.label}
            />
          ))}
          {!isGuest && (
            <Checkbox
              id="finder-hide-goal-conflicts"
              checked={state.hideGoalConflicts}
              onChange={setters.setHideGoalConflicts}
              label="Hide goal conflicts"
            />
          )}
        </div>
      </div>

      {!isGuest && (
        <div>
          <p className={GROUP_LABEL}>My role need</p>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_KEYS.map(role => (
              <Tag
                key={role}
                variant="filter"
                pressed={effectiveRole === role}
                onClick={() => {
                  // The main's chip is pressed via the `viewer.mainRole` fallback, never by
                  // setting `asRole` to it — clicking it always clears back to that fallback.
                  // Clicking an already-pressed explicit chip clears it the same way; clicking
                  // any other chip sets it. With no main role this is a plain toggle (whole-
                  // branch review item 4).
                  if (viewer?.mainRole === role) {
                    setters.setAsRole('');
                  } else {
                    setters.setAsRole(state.asRole === role ? '' : role);
                  }
                }}
              >
                {ROLE_CHIP_LABELS[role]}
              </Tag>
            ))}
          </div>
          {state.asRole ? (
            <p className="mt-1.5">
              <LinkText onClick={() => setters.setAsRole('')}>
                Match as your {viewer?.mainJob ?? 'main'} again
              </LinkText>
            </p>
          ) : viewer?.mainJob ? (
            <p className="text-xs text-text-muted mt-1.5">Matching as your {viewer.mainJob}</p>
          ) : null}
        </div>
      )}

      <div>
        <p className={GROUP_LABEL}>Schedule fit</p>
        {!isGuest && (
          <Checkbox
            id="finder-schedule-overlap"
            checked={noTemplate ? false : state.scheduleOverlap}
            onChange={setters.setScheduleOverlap}
            disabled={noTemplate}
            label="Fits my typical week"
            description={noTemplate ? 'Set your typical week on the Hub to use this.' : undefined}
          />
        )}
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Tag
            variant="filter"
            pressed={state.dayGroup === 'weeknights'}
            onClick={() => setters.setDayGroup(state.dayGroup === 'weeknights' ? '' : 'weeknights')}
          >
            Weeknights
          </Tag>
          <Tag
            variant="filter"
            pressed={state.dayGroup === 'weekends'}
            onClick={() => setters.setDayGroup(state.dayGroup === 'weekends' ? '' : 'weekends')}
          >
            Weekends
          </Tag>
        </div>
      </div>

      <div>
        <p className={GROUP_LABEL}>Vibe</p>
        <div className="flex flex-wrap gap-1.5">
          {INTENSITY_OPTIONS.filter(o => o.value).map(o => (
            <Tag
              key={o.value}
              variant="filter"
              pressed={state.intensity === o.value}
              onClick={() => setters.setIntensity(state.intensity === o.value ? '' : o.value)}
            >
              {o.label}
            </Tag>
          ))}
        </div>
      </div>

      <div>
        <LinkText onClick={() => setMoreOpen(o => !o)} aria-expanded={moreOpen}>
          {moreOpen ? 'Fewer filters' : 'More filters'}
        </LinkText>
        {moreOpen && (
          <div className="flex flex-col gap-3 mt-3">
            <Select id="finder-job" value={state.job} onChange={setters.setJob} options={JOB_OPTIONS} aria-label="Job" />
            <Select
              id="finder-recruitment-status"
              value={state.recruitmentStatus}
              onChange={setters.setRecruitmentStatus}
              options={FINDER_RECRUITMENT_OPTIONS}
              aria-label="Recruitment status"
            />
            <Select id="finder-data-center" value={state.dataCenter} onChange={setters.setDataCenter} options={DC_OPTIONS} aria-label="Data center" />
            <Select
              id="finder-server"
              value={state.server}
              onChange={setters.setServer}
              options={buildServerOptions(state.dataCenter)}
              disabled={!state.dataCenter}
              aria-label="Server"
            />
            <Select id="finder-timezone" value={state.timezone} onChange={setters.setTimezone} options={TZ_OPTIONS} aria-label="Timezone" />
            <Select id="finder-language" value={state.language} onChange={setters.setLanguage} options={LANG_OPTIONS} aria-label="Language" />
          </div>
        )}
      </div>
    </div>
  );
}
