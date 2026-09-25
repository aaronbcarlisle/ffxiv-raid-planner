import { describe, it, expect } from 'vitest';

/**
 * loggingModel.enumeration.test.ts — DoD-2 ("one logging model — asserted by
 * enumeration, not by claim", `phase-d-loot-plan.md:216-219`), tagged per
 * R-D14-K.
 *
 * DoD-2's literal text claims, within v2's Loot subtree: `logLootAndUpdateGear`
 * has exactly two call sites (`RecipientPicker`, `LogWeekWizard`),
 * `logMaterialAndUpdateGear` exactly two (`QuickLogMaterialModal`,
 * `LogWeekWizard`), and books mutate only through `adjustBookBalance` /
 * `MarkFloorClearedModal`. That undercounts the real, current set — this test
 * PINS the set as it actually is on the branch (R-D14-K: call sites are never
 * edited to fit the doc; the write-back amends DoD-2's literal list instead).
 *
 * Scope: every `.ts`/`.tsx` file under `components/loot/**` AND every
 * `.ts`/`.tsx` file under `components/history/**` — not just loot/. The loot
 * tree itself mounts modals that live outside it: `BookLedgerCard.tsx:22-24`
 * imports `EditBookBalanceModal`, `PlayerLedgerModal` and
 * `MarkFloorClearedModal` from `../history/`, and `Loot.tsx:172,189` imports
 * `LootFairnessLegend` and `DeleteLootConfirmModal` from `../history/` too.
 * `PlayerLedgerModal.tsx:59` calls `deletePlayerLedger` (editor-gated at
 * `:183`), so the history/ subtree is in scope whether or not every file in
 * it is itself v2-reachable. Test files are excluded from the scan in both
 * subtrees: a mock/assertion mentioning a function name is not a production
 * call site.
 *
 * Known v2 extras beyond DoD-2's literal list, each with its origin slice
 * (`git log -S`, oldest match — R-D14-K):
 *   - `logLootAndUpdateGear` @ `QuickLogWeaponModal.tsx:79`, reached via
 *     `WeaponPriorityBridge.tsx:15,80` → `Loot.tsx:1451` → `NewShell.tsx:13`.
 *     Origin: 86655c59 "Loot Tracking System Redesign (Phases 2-5) (#4)" —
 *     predates the Phase-D slices entirely.
 *   - `markFloorCleared` @ `LogWeekWizard/index.tsx:603` — a DIRECT store call,
 *     not routed through `MarkFloorClearedModal` (unlike `BookLedgerCard.tsx:464`,
 *     which is that modal's own `onSubmit`). Origin: b1b2da94 "fix: address
 *     remaining PR #66 review feedback (#67)".
 *   - The six ledger-clearing calls at `Loot.tsx:1098-1105`
 *     (`deletePlayerLedger`, `clearPlayerWeekPageLedger`,
 *     `clearAllFloorPageLedger`, `clearFloorPageLedger`, `clearWeekPageLedger`,
 *     `clearAllPageLedger`) — none of which DoD-2's text names at all. Origin:
 *     087c97c2 "feat(v2): D7a Log resets — toolbar reset menu on the displayed
 *     week + floor-kebab resets (#257)".
 * `createPageEntry` (the ninth book-changing store action, `lootTrackingStore.ts:81`)
 * has ZERO call sites anywhere in `frontend/src` — dead in both shells — so it
 * contributes no pinned pair.
 *
 * knip.json excludes this file from the vitest entries: its ?raw glob would
 * otherwise mark every loot (and history) file as referenced and hide dead
 * code in those subtrees (D14b).
 */

// Raw source of every file in components/loot/**, scanned as text (not parsed/executed).
const lootModules = import.meta.glob<string>('./**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

// Raw source of every file in components/history/**, scanned the same way —
// the loot tree mounts several modals that live there (see header comment).
const historyModules = import.meta.glob<string>('../history/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const TARGET_FNS = [
  'logLootAndUpdateGear',
  'logMaterialAndUpdateGear',
  'createPageEntry',
  'markFloorCleared',
  'adjustBookBalance',
  'deletePlayerLedger',
  'clearAllPageLedger',
  'clearWeekPageLedger',
  'clearFloorPageLedger',
  'clearAllFloorPageLedger',
  'clearPlayerWeekPageLedger',
] as const;

const IS_TEST_FILE = /\.(test|type-test)\.tsx?$/;

/**
 * Strips `//` and `/* *\/` comments so a target function NAMED in prose (a
 * comment, a doc example) doesn't register as a call site. String and
 * template-literal contents are left verbatim, not stripped — which means
 * they ARE still scanned by `findCallSites`' regex afterward: a target
 * function name followed by `(` inside a string literal (e.g. a stray
 * `"deletePlayerLedger("` in a mock or a message) still counts as a "call
 * site" and fails the pinned-set assertion loudly. That's intentional — a
 * silent skip would be more dangerous than an occasional false positive the
 * next run surfaces.
 *
 * Known limit: `//`-detection runs on raw text outside of quotes only, so a
 * literal `//` inside JSX TEXT (not a quoted string — e.g. `<div>a // b</div>`)
 * is still stripped as a line comment, same as `//` inside an actual `{'...'}`
 * string would NOT be (strings are quote-delimited and skipped whole before
 * `//`-detection runs on what follows). None of the pinned call-site lines
 * below contain `//` or `https://` (checked by grep across loot/** and
 * history/** for lines with both a target call and `//`/`https://`; only
 * hits were inside `.test.tsx` files, already excluded) so this limit does
 * not affect the pinned set today.
 */
function stripComments(source: string): string {
  let out = '';
  let i = 0;
  const n = source.length;
  while (i < n) {
    const two = source.slice(i, i + 2);
    if (two === '/*') {
      const end = source.indexOf('*/', i + 2);
      // Keep newlines from the stripped block so line numbers stay accurate.
      const block = source.slice(i, end === -1 ? n : end + 2);
      out += block.replace(/[^\n]/g, ' ');
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (two === '//') {
      const end = source.indexOf('\n', i + 2);
      const line = source.slice(i, end === -1 ? n : end);
      out += line.replace(/[^\n]/g, ' ');
      i = end === -1 ? n : end;
      continue;
    }
    const ch = source[i];
    if (ch === '`' || ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < n && source[j] !== ch) {
        if (source[j] === '\\') j++;
        j++;
      }
      out += source.slice(i, Math.min(j + 1, n));
      i = j + 1;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

interface CallSite {
  file: string;
  fn: string;
  line: number;
}

// (module map, key-normalizer) pairs — loot/ keys stay bare
// (`BookLedgerCard.tsx`), history/ keys get a `history/` prefix
// (`history/PlayerLedgerModal.tsx`) so the two subtrees never collide.
const SOURCE_GROUPS: Array<{ modules: Record<string, string>; normalize: (path: string) => string }> = [
  { modules: lootModules, normalize: (path) => path.replace(/^\.\//, '') },
  { modules: historyModules, normalize: (path) => path.replace(/^\.\.\/history\//, 'history/') },
];

function findCallSites(): CallSite[] {
  const sites: CallSite[] = [];
  for (const { modules, normalize } of SOURCE_GROUPS) {
    for (const [path, raw] of Object.entries(modules)) {
      const file = normalize(path);
      if (IS_TEST_FILE.test(file)) continue;
      if (file === 'loggingModel.enumeration.test.ts') continue;

      const code = stripComments(raw);
      for (const fn of TARGET_FNS) {
        const re = new RegExp(`\\b${fn}\\s*\\(`, 'g');
        let match: RegExpExecArray | null;
        while ((match = re.exec(code)) !== null) {
          const line = code.slice(0, match.index).split('\n').length;
          sites.push({ file, fn, line });
        }
      }
    }
  }
  return sites.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.fn.localeCompare(b.fn));
}

// `line` and `via` are documentation (the cite as of this commit); the assert compares (file, fn) only.
// The pinned set, AS IT IS on the branch (R-D14-K). `tag` is v2-reachable (with
// its import chain, in `via`) or V1-only.
const EXPECTED: Array<{ file: string; fn: string; line: number; tag: 'v2-reachable' | 'V1-only'; via: string }> = [
  {
    file: 'BookLedgerCard.tsx',
    fn: 'adjustBookBalance',
    line: 435,
    tag: 'v2-reachable',
    via: 'Loot.tsx:1438 -> NewShell.tsx:13',
  },
  {
    file: 'BookLedgerCard.tsx',
    fn: 'markFloorCleared',
    line: 475,
    tag: 'v2-reachable',
    // MarkFloorClearedModal's own onSubmit — matches DoD-2's text.
    via: 'Loot.tsx:1438 -> NewShell.tsx:13',
  },
  {
    file: 'Loot.tsx',
    fn: 'deletePlayerLedger',
    line: 1123,
    tag: 'v2-reachable',
    via: 'NewShell.tsx:13',
  },
  {
    file: 'Loot.tsx',
    fn: 'clearPlayerWeekPageLedger',
    line: 1126,
    tag: 'v2-reachable',
    via: 'NewShell.tsx:13',
  },
  {
    file: 'Loot.tsx',
    fn: 'clearAllFloorPageLedger',
    line: 1127,
    tag: 'v2-reachable',
    via: 'NewShell.tsx:13',
  },
  {
    file: 'Loot.tsx',
    fn: 'clearFloorPageLedger',
    line: 1128,
    tag: 'v2-reachable',
    via: 'NewShell.tsx:13',
  },
  {
    file: 'Loot.tsx',
    fn: 'clearWeekPageLedger',
    line: 1129,
    tag: 'v2-reachable',
    via: 'NewShell.tsx:13',
  },
  {
    file: 'Loot.tsx',
    fn: 'clearAllPageLedger',
    line: 1130,
    tag: 'v2-reachable',
    via: 'NewShell.tsx:13',
  },
  {
    file: 'LogWeekWizard/index.tsx',
    fn: 'logLootAndUpdateGear',
    line: 561,
    tag: 'v2-reachable',
    via: 'Loot.tsx:1555 -> NewShell.tsx:13',
  },
  {
    file: 'LogWeekWizard/index.tsx',
    fn: 'logMaterialAndUpdateGear',
    line: 574,
    tag: 'v2-reachable',
    via: 'Loot.tsx:1555 -> NewShell.tsx:13',
  },
  {
    file: 'LogWeekWizard/index.tsx',
    fn: 'markFloorCleared',
    line: 603,
    tag: 'v2-reachable',
    // Extra beyond DoD-2's text: a direct store call, not routed through
    // MarkFloorClearedModal.
    via: 'Loot.tsx:1555 -> NewShell.tsx:13',
  },
  {
    file: 'QuickLogDropModal.tsx',
    fn: 'logLootAndUpdateGear',
    line: 140,
    tag: 'V1-only',
    // Its only importer is LootPriorityPanel.tsx:26, mounted only by the
    // frozen legacy host, GroupViewContent.tsx:38.
    via: 'LootPriorityPanel.tsx:26 -> GroupViewContent.tsx:38',
  },
  {
    file: 'QuickLogMaterialModal.tsx',
    fn: 'logMaterialAndUpdateGear',
    line: 647,
    tag: 'v2-reachable',
    via: 'Loot.tsx:1573,1597,1614 -> NewShell.tsx:13',
  },
  {
    file: 'QuickLogWeaponModal.tsx',
    fn: 'logLootAndUpdateGear',
    line: 79,
    tag: 'v2-reachable',
    // Extra beyond DoD-2's text, which treats this file as tree-wide/non-v2.
    via: 'WeaponPriorityBridge.tsx:15,80 -> Loot.tsx:1476 -> NewShell.tsx:13',
  },
  {
    file: 'RecipientPicker.tsx',
    fn: 'logLootAndUpdateGear',
    line: 530,
    tag: 'v2-reachable',
    via: 'Loot.tsx:1523,1532,1540 -> NewShell.tsx:13',
  },

  // --- history/ modals the loot tree mounts (B2) ---------------------------
  // `BookLedgerCard.tsx:22-24` imports `EditBookBalanceModal`,
  // `PlayerLedgerModal` and `MarkFloorClearedModal` from `../history/`;
  // `Loot.tsx:172,189` imports `LootFairnessLegend` and
  // `DeleteLootConfirmModal` from `../history/` too. Of those five, only
  // `PlayerLedgerModal.tsx` calls a target function (`deletePlayerLedger`,
  // editor-gated at `:183`) — the rest contribute no pairs. The remaining
  // history/ rows below are files the v2 loot tree does NOT import; they are
  // in scope only because the scan is file-based, not import-graph-based, and
  // they live inside `components/history/**`.
  {
    file: 'history/PlayerLedgerModal.tsx',
    fn: 'deletePlayerLedger',
    line: 59,
    tag: 'v2-reachable',
    // v2: BookLedgerCard.tsx imports this file directly. Also live from V1:
    // LootLogModals.tsx:19 -> SectionedLogView.tsx:17 -> HistoryView.tsx:17
    // -> GroupViewContent.tsx:40 — reachable from both shells.
    via: 'BookLedgerCard.tsx:23 -> Loot.tsx:181 -> NewShell.tsx:13',
  },
  {
    file: 'history/LogMaterialModal.tsx',
    fn: 'logMaterialAndUpdateGear',
    line: 417,
    tag: 'V1-only',
    // Only live importer is LootLogModals.tsx (UnifiedWeekOverview.tsx also
    // imports it, but that file is itself dead — see below).
    via: 'LootLogModals.tsx:16 -> SectionedLogView.tsx:17 -> HistoryView.tsx:17 -> GroupViewContent.tsx:40',
  },
  {
    file: 'history/SectionedLogView.tsx',
    fn: 'logLootAndUpdateGear',
    line: 243,
    tag: 'V1-only',
    via: 'HistoryView.tsx:17 -> GroupViewContent.tsx:40',
  },
  {
    file: 'history/SectionedLogView.tsx',
    fn: 'markFloorCleared',
    line: 344,
    tag: 'V1-only',
    via: 'HistoryView.tsx:17 -> GroupViewContent.tsx:40',
  },
  {
    file: 'history/SectionedLogView.tsx',
    fn: 'adjustBookBalance',
    line: 355,
    tag: 'V1-only',
    via: 'HistoryView.tsx:17 -> GroupViewContent.tsx:40',
  },
  {
    file: 'history/SectionedLogView.tsx',
    fn: 'deletePlayerLedger',
    line: 494,
    tag: 'V1-only',
    via: 'HistoryView.tsx:17 -> GroupViewContent.tsx:40',
  },
  {
    file: 'history/SectionedLogView.tsx',
    fn: 'clearPlayerWeekPageLedger',
    line: 497,
    tag: 'V1-only',
    via: 'HistoryView.tsx:17 -> GroupViewContent.tsx:40',
  },
  {
    file: 'history/SectionedLogView.tsx',
    fn: 'clearAllFloorPageLedger',
    line: 500,
    tag: 'V1-only',
    via: 'HistoryView.tsx:17 -> GroupViewContent.tsx:40',
  },
  {
    file: 'history/SectionedLogView.tsx',
    fn: 'clearFloorPageLedger',
    line: 503,
    tag: 'V1-only',
    via: 'HistoryView.tsx:17 -> GroupViewContent.tsx:40',
  },
  {
    file: 'history/SectionedLogView.tsx',
    fn: 'clearWeekPageLedger',
    line: 506,
    tag: 'V1-only',
    via: 'HistoryView.tsx:17 -> GroupViewContent.tsx:40',
  },
  {
    file: 'history/SectionedLogView.tsx',
    fn: 'clearAllPageLedger',
    line: 509,
    tag: 'V1-only',
    via: 'HistoryView.tsx:17 -> GroupViewContent.tsx:40',
  },
  // The next three files (LootLogPanel, PageBalancesPanel,
  // UnifiedWeekOverview) are ORPHANED: `pnpm deadcode` lists all three under
  // "Unused files" — zero importers anywhere in frontend/src (verified by
  // grep; no barrel, no dynamic import()). Neither shell renders them, so
  // "V1-only" is the nearer of the two available tags (not v2-reachable) but
  // is not literally true either; `via` says so explicitly rather than
  // inventing a live chain.
  {
    file: 'history/LootLogPanel.tsx',
    fn: 'logLootAndUpdateGear',
    line: 52,
    tag: 'V1-only',
    via: 'UNREACHABLE — zero importers anywhere (knip: unused file); pre-UnifiedWeekOverview panel, never deleted',
  },
  {
    file: 'history/PageBalancesPanel.tsx',
    fn: 'clearAllPageLedger',
    line: 82,
    tag: 'V1-only',
    via: 'UNREACHABLE — zero importers anywhere (knip: unused file); pre-UnifiedWeekOverview panel, never deleted',
  },
  {
    file: 'history/PageBalancesPanel.tsx',
    fn: 'deletePlayerLedger',
    line: 86,
    tag: 'V1-only',
    via: 'UNREACHABLE — zero importers anywhere (knip: unused file); pre-UnifiedWeekOverview panel, never deleted',
  },
  {
    file: 'history/PageBalancesPanel.tsx',
    fn: 'adjustBookBalance',
    line: 95,
    tag: 'V1-only',
    via: 'UNREACHABLE — zero importers anywhere (knip: unused file); pre-UnifiedWeekOverview panel, never deleted',
  },
  {
    file: 'history/PageBalancesPanel.tsx',
    fn: 'markFloorCleared',
    line: 320,
    tag: 'V1-only',
    via: 'UNREACHABLE — zero importers anywhere (knip: unused file); pre-UnifiedWeekOverview panel, never deleted',
  },
  {
    file: 'history/PageBalancesPanel.tsx',
    fn: 'adjustBookBalance',
    line: 336,
    tag: 'V1-only',
    via: 'UNREACHABLE — zero importers anywhere (knip: unused file); pre-UnifiedWeekOverview panel, never deleted',
  },
  {
    file: 'history/UnifiedWeekOverview.tsx',
    fn: 'logLootAndUpdateGear',
    line: 285,
    tag: 'V1-only',
    via: 'UNREACHABLE — zero importers anywhere (knip: unused file); superseded by SectionedLogView, never deleted',
  },
  {
    file: 'history/UnifiedWeekOverview.tsx',
    fn: 'markFloorCleared',
    line: 376,
    tag: 'V1-only',
    via: 'UNREACHABLE — zero importers anywhere (knip: unused file); superseded by SectionedLogView, never deleted',
  },
  {
    file: 'history/UnifiedWeekOverview.tsx',
    fn: 'adjustBookBalance',
    line: 392,
    tag: 'V1-only',
    via: 'UNREACHABLE — zero importers anywhere (knip: unused file); superseded by SectionedLogView, never deleted',
  },
];

describe('one-logging-model call-site enumeration (DoD-2, R-D14-K)', () => {
  it('finds exactly the pinned (file, function) set under components/loot/**', () => {
    const actual = findCallSites()
      .map(({ file, fn }) => ({ file, fn }))
      .sort((a, b) => a.file.localeCompare(b.file) || a.fn.localeCompare(b.fn));
    const expectedSorted = [...EXPECTED]
      .map(({ file, fn }) => ({ file, fn }))
      .sort((a, b) => a.file.localeCompare(b.file) || a.fn.localeCompare(b.fn));

    expect(actual).toEqual(expectedSorted);
  });

  it('every pinned pair carries a reachability tag and an import chain (tag membership and non-empty via only — not verified against the real import graph)', () => {
    for (const entry of EXPECTED) {
      expect(['v2-reachable', 'V1-only']).toContain(entry.tag);
      expect(entry.via.length).toBeGreaterThan(0);
    }
  });

  it('QuickLogDropModal is imported by exactly one non-test file within loot/ and history/: loot/LootPriorityPanel.tsx (V1-only chain)', () => {
    // Scoped the same way as findCallSites: the importer could in principle
    // live outside loot/** and history/**, which this scan would not see —
    // hence "within loot/ and history/" in the test name, not an absolute claim.
    const IMPORT_RE = /\bimport\s*\{[^}]*\bQuickLogDropModal\b[^}]*\}\s*from/;
    const importers: string[] = [];
    for (const { modules, normalize } of SOURCE_GROUPS) {
      for (const [path, raw] of Object.entries(modules)) {
        const file = normalize(path);
        if (IS_TEST_FILE.test(file)) continue;
        if (file === 'loggingModel.enumeration.test.ts') continue;
        if (file === 'QuickLogDropModal.tsx') continue; // the module's own file
        if (IMPORT_RE.test(raw)) importers.push(file);
      }
    }
    expect(importers).toEqual(['LootPriorityPanel.tsx']);
  });

  it('matches call expressions only, not comments or typeof mentions', () => {
    const sample = stripComments(`
      // markFloorCleared(groupId, tierId, request) — a comment, not a call
      /** logLootAndUpdateGear is referenced here in prose, no call follows */
      const x = typeof adjustBookBalance;
    `);
    for (const fn of TARGET_FNS) {
      expect(new RegExp(`\\b${fn}\\s*\\(`).test(sample)).toBe(false);
    }
  });
});
