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
 * Scope: every `.ts`/`.tsx` file under `components/loot/**` — v2's whole Loot
 * subtree (`Loot.tsx`, mounted by `NewShell.tsx:13`) plus every shared modal
 * it mounts (`LogWeekWizard/`, `RecipientPicker.tsx`, `QuickLogMaterialModal.tsx`,
 * `WeaponPriorityBridge.tsx`, `QuickLogWeaponModal.tsx`, `BookLedgerCard.tsx`)
 * — all of which already resolve under this one glob. Test files are excluded
 * from the scan: a mock/assertion mentioning a function name is not a
 * production call site.
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
 */

// Raw source of every file in this subtree, scanned as text (not parsed/executed).
const modules = import.meta.glob<string>('./**/*.{ts,tsx}', {
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
 * Strips `//` and `/* *\/` comments while leaving string and template-literal
 * contents untouched (so a `//` inside a URL string, or a call expression
 * quoted inside a doc comment, is handled correctly either way — comments are
 * removed outright, strings are preserved verbatim but never matched as call
 * expressions since a matched name must be followed directly by `(`, and
 * nothing inside a string literal is scanned as code).
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

function findCallSites(): CallSite[] {
  const sites: CallSite[] = [];
  for (const [path, raw] of Object.entries(modules)) {
    const file = path.replace(/^\.\//, '');
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
  return sites.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.fn.localeCompare(b.fn));
}

// The pinned set, AS IT IS on the branch (R-D14-K). `tag` is v2-reachable (with
// its import chain, in `via`) or V1-only.
const EXPECTED: Array<{ file: string; fn: string; line: number; tag: 'v2-reachable' | 'V1-only'; via: string }> = [
  {
    file: 'BookLedgerCard.tsx',
    fn: 'adjustBookBalance',
    line: 424,
    tag: 'v2-reachable',
    via: 'Loot.tsx:1413 -> NewShell.tsx:13',
  },
  {
    file: 'BookLedgerCard.tsx',
    fn: 'markFloorCleared',
    line: 464,
    tag: 'v2-reachable',
    // MarkFloorClearedModal's own onSubmit — matches DoD-2's text.
    via: 'Loot.tsx:1413 -> NewShell.tsx:13',
  },
  {
    file: 'Loot.tsx',
    fn: 'deletePlayerLedger',
    line: 1098,
    tag: 'v2-reachable',
    via: 'NewShell.tsx:13',
  },
  {
    file: 'Loot.tsx',
    fn: 'clearPlayerWeekPageLedger',
    line: 1101,
    tag: 'v2-reachable',
    via: 'NewShell.tsx:13',
  },
  {
    file: 'Loot.tsx',
    fn: 'clearAllFloorPageLedger',
    line: 1102,
    tag: 'v2-reachable',
    via: 'NewShell.tsx:13',
  },
  {
    file: 'Loot.tsx',
    fn: 'clearFloorPageLedger',
    line: 1103,
    tag: 'v2-reachable',
    via: 'NewShell.tsx:13',
  },
  {
    file: 'Loot.tsx',
    fn: 'clearWeekPageLedger',
    line: 1104,
    tag: 'v2-reachable',
    via: 'NewShell.tsx:13',
  },
  {
    file: 'Loot.tsx',
    fn: 'clearAllPageLedger',
    line: 1105,
    tag: 'v2-reachable',
    via: 'NewShell.tsx:13',
  },
  {
    file: 'LogWeekWizard/index.tsx',
    fn: 'logLootAndUpdateGear',
    line: 561,
    tag: 'v2-reachable',
    via: 'Loot.tsx:1530 -> NewShell.tsx:13',
  },
  {
    file: 'LogWeekWizard/index.tsx',
    fn: 'logMaterialAndUpdateGear',
    line: 574,
    tag: 'v2-reachable',
    via: 'Loot.tsx:1530 -> NewShell.tsx:13',
  },
  {
    file: 'LogWeekWizard/index.tsx',
    fn: 'markFloorCleared',
    line: 603,
    tag: 'v2-reachable',
    // Extra beyond DoD-2's text: a direct store call, not routed through
    // MarkFloorClearedModal.
    via: 'Loot.tsx:1530 -> NewShell.tsx:13',
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
    via: 'Loot.tsx:1548,1572,1589 -> NewShell.tsx:13',
  },
  {
    file: 'QuickLogWeaponModal.tsx',
    fn: 'logLootAndUpdateGear',
    line: 79,
    tag: 'v2-reachable',
    // Extra beyond DoD-2's text, which treats this file as tree-wide/non-v2.
    via: 'WeaponPriorityBridge.tsx:15,80 -> Loot.tsx:1451 -> NewShell.tsx:13',
  },
  {
    file: 'RecipientPicker.tsx',
    fn: 'logLootAndUpdateGear',
    line: 530,
    tag: 'v2-reachable',
    via: 'Loot.tsx:1498,1507,1515 -> NewShell.tsx:13',
  },
];

describe('one-logging-model call-site enumeration (DoD-2, R-D14-K)', () => {
  it('finds exactly the pinned (file, function, line) set under components/loot/**', () => {
    const actual = findCallSites();
    const expectedSorted = [...EXPECTED]
      .map(({ file, fn, line }) => ({ file, fn, line }))
      .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.fn.localeCompare(b.fn));

    expect(actual).toEqual(expectedSorted);
  });

  it('every pinned pair carries a reachability tag and an import chain', () => {
    for (const entry of EXPECTED) {
      expect(['v2-reachable', 'V1-only']).toContain(entry.tag);
      expect(entry.via.length).toBeGreaterThan(0);
    }
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
