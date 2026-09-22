"""Re-run every D9b mutation claim against the CURRENT tree, one at a time.

Each entry: (label, file, old, new, test target). Applies the mutation, runs the
target spec, records how many tests failed, then restores the file verbatim.
"""
import io
import re
import shutil
import subprocess
import sys

LHT = 'src/components/loot/LootHistoryTable.tsx'
LOOT = 'src/components/loot/Loot.tsx'
LHT_SPEC = 'src/components/loot/LootHistoryTable.test.tsx'
LOOT_SPEC = 'src/components/loot/Loot.test.tsx'

MUTATIONS = [
    (
        '`?entry=` resolved against the filtered set instead of the raw logs',
        LHT,
        """      ? materialLog.some((e) => e.id === parsedEntryId)
      : lootLog.some((e) => e.id === parsedEntryId));""",
        """      ? filterHistoryItems(buildHistoryItems([], materialLog), filters).some((i) => i.entry.id === parsedEntryId)
      : filterHistoryItems(buildHistoryItems(lootLog, []), filters).some((i) => i.entry.id === parsedEntryId));""",
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
        'both per-log retraction effects removed',
        LOOT,
        """  useEffect(() => {
    setLootLogFailed(false);
  }, [lootLog]);

  useEffect(() => {
    setMaterialLogFailed(false);
  }, [materialLog]);""",
        '',
        LOOT_SPEC,
    ),
    (
        'the two per-log retraction effects recombined into one',
        LOOT,
        """  useEffect(() => {
    setLootLogFailed(false);
  }, [lootLog]);

  useEffect(() => {
    setMaterialLogFailed(false);
  }, [materialLog]);""",
        """  useEffect(() => {
    setLootLogFailed(false);
    setMaterialLogFailed(false);
  }, [lootLog, materialLog]);""",
        LOOT_SPEC,
    ),
]


def run_spec(spec):
    out = subprocess.run(
        ['npx', 'vitest', 'run', spec],
        capture_output=True, text=True, shell=True,
        encoding='utf-8', errors='replace',
    )
    blob = out.stdout + out.stderr
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
        io.open(path, 'w', encoding='utf-8', newline='').write(src.replace(old, new, 1))
        killed = run_spec(spec)
    finally:
        shutil.copyfile(path + '.bak', path)
        import os
        os.remove(path + '.bak')
    rows.append((label, killed))
    print(f'{killed:>3} killed  <-  {label}', flush=True)

print('\n--- clean tree re-check ---', flush=True)
for spec in (LHT_SPEC, LOOT_SPEC):
    print(f'{spec}: {run_spec(spec)} failing', flush=True)

print('\n--- markdown ---')
for label, killed in rows:
    print(f'| {label} | **{killed}** |')
