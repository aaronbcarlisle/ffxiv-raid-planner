/**
 * useFinderQuery — the Static Finder's URL ↔ state ↔ request loop (R-SF-O).
 *
 * Every request sends `fitV2=true`, `viewerTz` (the browser zone) and `sort`.
 * `viewerTz` is never written to the URL. V1 links keep working: `role` is
 * read as `asRole` and `hideConflicts=true` as `hideGoalConflicts=true`, and
 * the URL is rewritten to the new keys (m8) — the sync effect below only
 * ever writes the new key names, so that rewrite falls out for free.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebounce } from '../../hooks/useDebounce';
import { useAuthStore } from '../../stores/authStore';
import { authRequest } from '../../services/api';
import { getBrowserTimezone } from '../../utils/timezone';
import { DATA_CENTERS, getWorldsForDC } from '../../gamedata';
import {
  JOB_OPTIONS, FINDER_RECRUITMENT_OPTIONS, INTENSITY_OPTIONS, DC_OPTIONS, TZ_OPTIONS, LANG_OPTIONS,
} from './discoveryOptions';
import type { FinderItem, FinderResponse, FitCounts, FitViewer } from './types';

const ROLE_VALUES = new Set(['tank', 'healer', 'melee', 'ranged', 'caster']);
const DAY_GROUP_VALUES = new Set(['weeknights', 'weekends']);
const SORT_VALUES = new Set(['best', 'recent', 'members', 'name']);

/** Keys that open "More filters" by default when any is in the URL (m8). */
const MORE_FILTER_KEYS = ['job', 'recruitmentStatus', 'dataCenter', 'server', 'timezone', 'language'] as const;

/** The non-empty values of an option list `FinderFilters` renders (whole-branch review item 2). */
function optionValues(options: { value: string }[]): Set<string> {
  return new Set(options.filter(o => o.value).map(o => o.value));
}

const JOB_VALUES = optionValues(JOB_OPTIONS);
const RECRUITMENT_STATUS_VALUES = optionValues(FINDER_RECRUITMENT_OPTIONS);
const INTENSITY_VALUES = optionValues(INTENSITY_OPTIONS);
const DATA_CENTER_VALUES = optionValues(DC_OPTIONS);
const TIMEZONE_VALUES = optionValues(TZ_OPTIONS);
const LANGUAGE_VALUES = optionValues(LANG_OPTIONS);
const ALL_SERVER_VALUES = new Set(DATA_CENTERS.flatMap(dc => dc.worlds));

function defaultSort(signedIn: boolean): string {
  return signedIn ? 'best' : 'recent';
}

function readRole(searchParams: URLSearchParams): string {
  const asRole = searchParams.get('asRole');
  if (asRole && ROLE_VALUES.has(asRole)) return asRole;
  const legacy = searchParams.get('role'); // V1 link (m8)
  if (legacy && ROLE_VALUES.has(legacy)) return legacy;
  return '';
}

function readHideGoalConflicts(searchParams: URLSearchParams): boolean {
  if (searchParams.get('hideGoalConflicts') === 'true') return true;
  return searchParams.get('hideConflicts') === 'true'; // V1 link (m8)
}

/**
 * Reads a select-backed filter, validated against the same option list
 * `FinderFilters` renders; a value outside it is dropped (m8 pattern) rather
 * than sent to the API and shown as "Any …" while still filtering (whole-
 * branch review item 2).
 */
function readOption(searchParams: URLSearchParams, key: string, validValues: Set<string>, migrate?: (raw: string) => string): string {
  const raw = searchParams.get(key);
  if (!raw) return '';
  const value = migrate ? migrate(raw) : raw;
  return validValues.has(value) ? value : '';
}

/** DiscoveryTab.tsx:148 migrates `limited` -> `selective` on save; a V1 link reads the same way. */
function migrateRecruitmentStatus(raw: string): string {
  return raw === 'limited' ? 'selective' : raw;
}

export interface FinderState {
  q: string;
  sort: string;
  asRole: string;
  dayGroup: string;
  goalCategory: string[];
  scheduleOverlap: boolean;
  hideGoalConflicts: boolean;
  job: string;
  recruitmentStatus: string;
  intensity: string;
  dataCenter: string;
  server: string;
  timezone: string;
  language: string;
}

export interface FinderSetters {
  setQ: (v: string) => void;
  setSort: (v: string) => void;
  setAsRole: (v: string) => void;
  setDayGroup: (v: string) => void;
  setGoalCategory: (v: string[]) => void;
  setScheduleOverlap: (v: boolean) => void;
  setHideGoalConflicts: (v: boolean) => void;
  setJob: (v: string) => void;
  setRecruitmentStatus: (v: string) => void;
  setIntensity: (v: string) => void;
  setDataCenter: (v: string) => void;
  setServer: (v: string) => void;
  setTimezone: (v: string) => void;
  setLanguage: (v: string) => void;
}

export interface UseFinderQueryResult {
  state: FinderState;
  setters: FinderSetters;
  items: FinderItem[];
  total: number;
  fitCounts: FitCounts | null;
  viewer: FitViewer | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
  clearFilters: () => void;
  hasFilters: boolean;
  /** "More filters" should start expanded (computed once at mount, m8). */
  moreFiltersInitiallyOpen: boolean;
}

export function useFinderQuery(): UseFinderQueryResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const signedIn = !!user;

  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const initialSortRaw = searchParams.get('sort');
  const [sort, setSortState] = useState(() =>
    initialSortRaw && SORT_VALUES.has(initialSortRaw) ? initialSortRaw : defaultSort(signedIn));
  // Whether `sort` was set explicitly (a valid `sort` in the URL at mount, or
  // a later user pick) rather than defaulted. An auth flip after mount (a
  // guest logging in, or the reverse) re-derives an un-set sort below, so a
  // guest's `recent` default doesn't survive as a value the signed-in Select
  // no longer offers (and vice versa).
  const sortExplicitRef = useRef(!!(initialSortRaw && SORT_VALUES.has(initialSortRaw)));
  const setSort = useCallback((value: string) => {
    sortExplicitRef.current = true;
    setSortState(value);
  }, []);
  const [asRole, setAsRole] = useState(() => readRole(searchParams));
  const [dayGroup, setDayGroup] = useState(() => {
    const raw = searchParams.get('dayGroup');
    return raw && DAY_GROUP_VALUES.has(raw) ? raw : '';
  });
  const [goalCategory, setGoalCategory] = useState<string[]>(() => {
    const raw = searchParams.get('goalCategory');
    if (!raw) return [];
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  });
  const [scheduleOverlap, setScheduleOverlap] = useState(() => searchParams.get('scheduleOverlap') === 'true');
  const [hideGoalConflicts, setHideGoalConflicts] = useState(() => readHideGoalConflicts(searchParams));
  const [job, setJob] = useState(() => readOption(searchParams, 'job', JOB_VALUES));
  const [recruitmentStatus, setRecruitmentStatus] = useState(() =>
    readOption(searchParams, 'recruitmentStatus', RECRUITMENT_STATUS_VALUES, migrateRecruitmentStatus));
  const [intensity, setIntensity] = useState(() => readOption(searchParams, 'intensity', INTENSITY_VALUES));
  const [dataCenter, setDataCenterState] = useState(() => readOption(searchParams, 'dataCenter', DATA_CENTER_VALUES));
  const [server, setServer] = useState(() => {
    const validServers = dataCenter ? new Set(getWorldsForDC(dataCenter)) : ALL_SERVER_VALUES;
    return readOption(searchParams, 'server', validServers);
  });
  const [timezone, setTimezone] = useState(() => readOption(searchParams, 'timezone', TIMEZONE_VALUES));
  const [language, setLanguage] = useState(() => readOption(searchParams, 'language', LANGUAGE_VALUES));

  const [moreFiltersInitiallyOpen] = useState(() => MORE_FILTER_KEYS.some(k => searchParams.has(k)));

  const [items, setItems] = useState<FinderItem[]>([]);
  const [total, setTotal] = useState(0);
  const [fitCounts, setFitCounts] = useState<FitCounts | null>(null);
  const [viewer, setViewer] = useState<FitViewer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const debouncedQ = useDebounce(q, 350);
  const viewerTz = useMemo(() => getBrowserTimezone(), []);

  // Latest response's viewer.missing — read (not depended on) at request time,
  // so it affects only the NEXT request, not the one already in flight (m10).
  const missingRef = useRef<string[]>([]);
  const seqRef = useRef(0);

  const setDataCenter = useCallback((value: string) => {
    setDataCenterState(value);
    setServer(''); // reset server when DC changes, as V1 does
  }, []);

  // Re-derive an un-set sort when signedIn flips (item 7, whole-branch review).
  // A guest can never keep `sort=best`: a cookie-session user can render once
  // with `user === null` before the session resolves, so this clamps on
  // every render where signedIn/sort settle, not only at mount — and clears
  // the explicit flag so a later sign-in still restores `best` (item 1,
  // PR-review fix wave).
  useEffect(() => {
    if (!signedIn && sort === 'best') {
      sortExplicitRef.current = false;
      setSortState('recent');
      return;
    }
    if (!sortExplicitRef.current) {
      setSortState(defaultSort(signedIn));
    }
  }, [signedIn, sort]);

  const setters = useMemo<FinderSetters>(() => ({
    setQ, setSort, setAsRole, setDayGroup, setGoalCategory,
    setScheduleOverlap, setHideGoalConflicts, setJob, setRecruitmentStatus,
    setIntensity, setDataCenter, setServer, setTimezone, setLanguage,
  }), [setDataCenter, setSort]);

  const state = useMemo<FinderState>(() => ({
    q, sort, asRole, dayGroup, goalCategory, scheduleOverlap, hideGoalConflicts,
    job, recruitmentStatus, intensity, dataCenter, server, timezone, language,
  }), [q, sort, asRole, dayGroup, goalCategory, scheduleOverlap, hideGoalConflicts,
      job, recruitmentStatus, intensity, dataCenter, server, timezone, language]);

  const hasFilters = useMemo(() =>
    !!(debouncedQ || asRole || dayGroup || goalCategory.length || scheduleOverlap || hideGoalConflicts ||
       job || recruitmentStatus || intensity || dataCenter || server || timezone || language),
    [debouncedQ, asRole, dayGroup, goalCategory, scheduleOverlap, hideGoalConflicts,
     job, recruitmentStatus, intensity, dataCenter, server, timezone, language],
  );

  // Sync state → URL. `sort` is omitted when it equals the signed-in/guest
  // default; every other key is omitted when empty/false. This is also what
  // rewrites a V1 link's `role`/`hideConflicts` to `asRole`/`hideGoalConflicts`,
  // since those legacy keys are never written back (m8).
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set('q', debouncedQ);
    if (sort !== defaultSort(signedIn)) params.set('sort', sort);
    if (asRole) params.set('asRole', asRole);
    if (dayGroup) params.set('dayGroup', dayGroup);
    if (goalCategory.length) params.set('goalCategory', goalCategory.join(','));
    if (scheduleOverlap) params.set('scheduleOverlap', 'true');
    if (hideGoalConflicts) params.set('hideGoalConflicts', 'true');
    if (job) params.set('job', job);
    if (recruitmentStatus) params.set('recruitmentStatus', recruitmentStatus);
    if (intensity) params.set('intensity', intensity);
    if (dataCenter) params.set('dataCenter', dataCenter);
    if (server) params.set('server', server);
    if (timezone) params.set('timezone', timezone);
    if (language) params.set('language', language);
    setSearchParams(params, { replace: true });
    // setSearchParams is left out of deps on purpose: react-router recreates it on every
    // render, and depending on it would re-run this sync effect (and re-replace the URL) on
    // every change IT makes, not just on a real state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see rationale above
  }, [debouncedQ, sort, asRole, dayGroup, goalCategory, scheduleOverlap, hideGoalConflicts,
      job, recruitmentStatus, intensity, dataCenter, server, timezone, language, signedIn]);

  const fetchResults = useCallback(async () => {
    const seq = ++seqRef.current;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set('fitV2', 'true');
    if (viewerTz) params.set('viewerTz', viewerTz);
    params.set('sort', sort);
    if (debouncedQ) params.set('q', debouncedQ);
    if (asRole) params.set('asRole', asRole);
    if (dayGroup) params.set('dayGroup', dayGroup);
    if (goalCategory.length) params.set('goalCategory', goalCategory.join(','));
    if (scheduleOverlap && !missingRef.current.includes('template')) {
      params.set('scheduleOverlap', 'true');
    }
    if (hideGoalConflicts) params.set('hideGoalConflicts', 'true');
    if (job) params.set('job', job);
    if (recruitmentStatus) params.set('recruitmentStatus', recruitmentStatus);
    if (intensity) params.set('intensity', intensity);
    if (dataCenter) params.set('dataCenter', dataCenter);
    if (server) params.set('server', server);
    if (timezone) params.set('timezone', timezone);
    if (language) params.set('language', language);

    try {
      const data = await authRequest<FinderResponse>(`/api/discovery/statics?${params.toString()}`);
      if (seq !== seqRef.current) return; // superseded (R-SF-O)
      setItems(data.items);
      setTotal(data.total);
      setFitCounts(data.fitCounts);
      setViewer(data.viewer);
      missingRef.current = data.viewer?.missing ?? [];
      // `missingRef` only helps starting with the NEXT request — on first load,
      // a viewer with no typical week would otherwise leave the checkbox
      // checked-but-disabled with no way to untick it. Clear it here too, which
      // drops `scheduleOverlap` from the URL and refetches (item 3, PR-review
      // fix wave).
      if (scheduleOverlap && missingRef.current.includes('template')) {
        setScheduleOverlap(false);
      }
      setLoading(false);
    } catch (err) {
      if (seq !== seqRef.current) return;
      setError(err instanceof Error ? err.message : "Couldn't load statics.");
      setLoading(false);
    }
  }, [viewerTz, sort, debouncedQ, asRole, dayGroup, goalCategory, scheduleOverlap,
      hideGoalConflicts, job, recruitmentStatus, intensity, dataCenter, server, timezone, language]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const retry = useCallback(() => { fetchResults(); }, [fetchResults]);

  const clearFilters = useCallback(() => {
    setQ('');
    setAsRole('');
    setDayGroup('');
    setGoalCategory([]);
    setScheduleOverlap(false);
    setHideGoalConflicts(false);
    setJob('');
    setRecruitmentStatus('');
    setIntensity('');
    setDataCenterState('');
    setServer('');
    setTimezone('');
    setLanguage('');
  }, []);

  return {
    state, setters, items, total, fitCounts, viewer, loading, error,
    retry, clearFilters, hasFilters, moreFiltersInitiallyOpen,
  };
}
