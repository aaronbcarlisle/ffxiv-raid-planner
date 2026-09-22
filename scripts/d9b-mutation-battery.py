"""Re-run every D9b mutation claim against the CURRENT tree, one at a time.

Each entry: (label, file, old, new, test target). Applies the mutation, runs the
target spec, records how many tests failed, then restores the file verbatim.

RUN FROM `frontend/` — the paths below are relative to it, though this file
lives at the repo root:

    cd frontend && python ../scripts/d9b-mutation-battery.py

A row reporting 0 means EITHER the tests miss that defect OR the mutation did
not express it. Check the second before believing the first: the first run of
this battery produced two false zeros, one from a non-unique anchor (a
first-match replace hit `FairnessSummary`, not the table) and one from a
mutation that left half the old behaviour in place.
"""
import io
import os
import re
import shutil
import subprocess

NPX = 'npx.cmd' if os.name == 'nt' else 'npx'

LHT = 'src/components/loot/LootHistoryTable.tsx'
LOOT = 'src/components/loot/Loot.tsx'
LHT_SPEC = 'src/components/loot/LootHistoryTable.test.tsx'
LOOT_SPEC = 'src/components/loot/Loot.test.tsx'

# D10 deleted `filterHistoryItems` and the `filters` prop, so the first
# mutation's old text no longer compiled — and a non-compiling mutant fails
# EVERY test in the spec, which reads as a large kill count while proving
# nothing (claude[bot], PR #265). It is re-expressed below in D10's vocabulary,
# and `INVALID_MUTANT` now catches the whole class rather than this instance.
STUB_CTX_DECL = (
    "const STUB_CTX = { playerNameOf: () => '', playerJobOf: () => '' };\n"
)

MUTATIONS = [
    (
        '`?entry=` resolved against the filtered set instead of the raw logs',
        LHT,
        """      ? materialLog.some((e) => e.id === parsedEntryId)
      : lootLog.some((e) => e.id === parsedEntryId));""",
        """      ? filterHistoryItemsByQuery(buildHistoryItems([], materialLog), query, STUB_CTX).some((i) => i.entry.id === parsedEntryId)
      : filterHistoryItemsByQuery(buildHistoryItems(lootLog, []), query, STUB_CTX).some((i) => i.entry.id === parsedEntryId));""",
        LHT_SPEC,
    ),
    (
        "`timeZone: 'UTC'` dropped from the separator range formatter",
        LHT,
        "  day: 'numeric',\n  timeZone: 'UTC',\n});",
        "  day: 'numeric',\n});",
        LHT_SPEC,
    ),
    (
        '`logsFailed` ungated from `tierIsEmpty` in the empty-message ladder',
        LHT,
        '    : logsFailed && tierIsEmpty\n',
        '    : logsFailed\n',
        LHT_SPEC,
    ),
    (
        '`currentWeek={logWeek.week}` instead of `clock.currentWeek` at the mount',
        LOOT,
        """            currentWeek={clock.currentWeek}
            rangeOfWeek={clock.rangeOfWeek}""",
        """            currentWeek={logWeek.week}
            rangeOfWeek={clock.rangeOfWeek}""",
        LOOT_SPEC,
    ),
    (
        '`setFailed(true)` removed from `markFailed`',
        LOOT,
        '        if (!cancelled) setFailed(true);\n',
        '',
        LOOT_SPEC,
    ),
    (
        'the per-log-promise catches collapsed to a batch-level catch',
        LOOT,
        """      fetchLootLog(groupId, tierId).catch(markFailed(setLootLogFailed)),
      fetchMaterialLog(groupId, tierId).catch(markFailed(setMaterialLogFailed)),
      fetchPageLedger(groupId, tierId),
      fetchCurrentWeek(groupId, tierId),
    ])
      .catch(() => toast.error('Failed to load loot data'))""",
        """      fetchLootLog(groupId, tierId),
      fetchMaterialLog(groupId, tierId),
      fetchPageLedger(groupId, tierId),
      fetchCurrentWeek(groupId, tierId),
    ])
      .catch(() => {
        if (!cancelled) { setLootLogFailed(true); setMaterialLogFailed(true); }
        void markFailed;
        toast.error('Failed to load loot data');
      })""",
        LOOT_SPEC,
    ),
    (
        'an identity-based retraction effect reintroduced (removed in round 7)',
        LOOT,
        '  const refresh = useCallback(() => {',
        '''  useEffect(() => {
    setLootLogFailed(false);
    setMaterialLogFailed(false);
  }, [lootLog, materialLog]);

  const refresh = useCallback(() => {''',
        LOOT_SPEC,
    ),
]


def run_spec(spec):
    # No `shell=True`: with a list argv that is Windows-only semantics. On POSIX
    # it runs `/bin/sh -c npx` with the rest as $0..$2, so bare `npx` executes,
    # the summary regex never matches, and EVERY row reports -1 (D9b review
    # round 6, claude[bot]). Resolve the launcher per platform instead.
    out = subprocess.run(
        [NPX, 'vitest', 'run', spec],
        capture_output=True, text=True,
        encoding='utf-8', errors='replace',
    )
    blob = out.stdout + out.stderr
    # A mutant that cannot compile fails every test in the spec for a reason
    # that has nothing to do with the defect. Scoring it as a kill is the
    # third silent-harness failure this branch produced (after a no-op `sed`
    # and a subprocess decode crash) — so detect it instead of counting it.
    if re.search(
        r'Cannot find name|is not defined|used before its declaration|Transform failed|'
        r'Failed to parse|esbuild',
        blob,
    ):
        return 'INVALID MUTANT (did not compile)'
    m = re.search(r'Tests\s+(\d+) failed \| (\d+) passed', blob)
    if m:
        return int(m.group(1))
    if re.search(r'Tests\s+\d+ passed', blob):
        return 0
    return -1


rows = []
for label, path, old, new, spec in MUTATIONS:
    src = io.open(path, encoding='utf-8', newline='').read()
    if old not in src:
        rows.append((label, 'ANCHOR MISSING'))
        print(f'!! anchor missing: {label}', flush=True)
        continue
    shutil.copyfile(path, path + '.bak')
    try:
        mutated = src.replace(old, new, 1)
        if 'STUB_CTX' in new:
            mutated = mutated.replace('export function LootHistoryTable(', STUB_CTX_DECL + 'export function LootHistoryTable(', 1)
        io.open(path, 'w', encoding='utf-8', newline='').write(mutated)
        killed = run_spec(spec)
    finally:
        shutil.copyfile(path + '.bak', path)
        os.remove(path + '.bak')
    rows.append((label, killed))
    print(f'{str(killed):>3} killed  <-  {label}', flush=True)

print('\n--- clean tree re-check ---', flush=True)
for spec in (LHT_SPEC, LOOT_SPEC):
    print(f'{spec}: {run_spec(spec)} failing', flush=True)

print('\n--- markdown ---')
for label, killed in rows:
    print(f'| {label} | **{killed}** |')
