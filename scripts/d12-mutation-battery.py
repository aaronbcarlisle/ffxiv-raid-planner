"""Re-run every D12 mutation claim against the CURRENT tree, one at a time.

Each entry: (label, file, old, new, test target). Applies the mutation, runs the
target spec, records how many tests failed, then restores the file and PROVES
the restore was byte-identical before moving on.

RUN FROM `frontend/` — the paths below are relative to it, though this file
lives at the repo root:

    cd frontend && python ../scripts/d12-mutation-battery.py

Harness inherited from `d11-mutation-battery.py` byte-for-byte, whose
hard-won rules all still apply and are all still enforced below:

  1. The anchor must be present AND UNIQUE. `replace(old, new, 1)` silently
     takes the first occurrence, so a duplicated anchor mutates the wrong site
     and reports a kill for a defect never introduced (PR #265 round 7).
  2. A mutant that cannot compile fails EVERY test in the spec, which reads as
     a large kill count while proving nothing (PR #265 round 5). Detected
     explicitly as INVALID MUTANT.
  3. A row reporting 0 is first evidence about the MUTATION, not the test.
  4. The restore is verified by hash, not assumed — a crashed subprocess can
     leave a mutation in the working tree, and a `finally` that copies back is
     only as good as the bytes it copies, so each row re-reads the file
     afterwards and compares.

D11's `run_spec` `returncode` check and `--selftest` (PR #268) are carried
over unchanged: vitest can exit non-zero behind a healthy-looking pass-only
summary (an unhandled rejection, a worker crash, a config error), and reading
that as "0 failing" would hide the fallout on both a mutation row (a false
survive) and the clean-tree re-check (a false "Battery OK").

Coverage spans D12's jump family — "the jumps" (R-18's roster destination,
R-28's week split, and the ?slot=/?player= deep-link contract): both
directions of the gear<->ledger mapping and the entry-jump week split
(`rosterLedgerJumps.ts`), the pulse and the tome sub-row's own anchor
(`RosterGearTable.tsx`), slot-forwarding scope and the `?slot=` deep-link's
validation + card-target denylist (`Roster.tsx`), the card's `jumpToEntry`
resolver seam (R-D12-B/C/D, `RosterCard.tsx`), the roster jump's stale-slot
clear and the entry-link denylist (`Loot.tsx`), a hand-rolled ledger ref
(`LogWeekGrid.tsx`), the `?player=`/`?slot=` strip (`GroupViewContent.tsx`),
and the row-then-card scroll fallback (`gearRowScroll.ts`).
"""
import hashlib
import io
import os
import re
import shutil
import subprocess
import sys

NPX = 'npx.cmd' if os.name == 'nt' else 'npx'

LEDGER = 'src/components/roster/rosterLedgerJumps.ts'
SCROLL = 'src/components/roster/gearRowScroll.ts'
GEAR_TABLE = 'src/components/roster/RosterGearTable.tsx'
CARDS = 'src/components/roster/RosterCards.tsx'
ROSTER = 'src/components/roster/Roster.tsx'
CARD = 'src/components/roster/RosterCard.tsx'
LOOT = 'src/components/loot/Loot.tsx'
LOG_WEEK_GRID = 'src/components/loot/LogWeekGrid.tsx'
GVC = 'src/pages/GroupViewContent.tsx'

LEDGER_SPEC = 'src/components/roster/rosterLedgerJumps.test.ts'
SCROLL_SPEC = 'src/components/roster/gearRowScroll.test.ts'
GEAR_TABLE_SPEC = 'src/components/roster/RosterGearTable.test.tsx'
ROSTER_SPEC = 'src/components/roster/Roster.test.tsx'
CARD_SPEC = 'src/components/roster/RosterCard.test.tsx'
LOOT_SPEC = 'src/components/loot/Loot.test.tsx'
LOG_WEEK_GRID_SPEC = 'src/components/loot/LogWeekGrid.test.tsx'
GVC_SPEC = 'src/pages/GroupViewContent.test.tsx'

MUTATIONS = [
    # ── Both directions of the gear<->ledger mapping (rosterLedgerJumps.ts) ──
    (
        "jumpAnchorSlotOf normalizes tome_weapon -> 'weapon' (R-D12-E: the tome sub-row owns it)",
        LEDGER,
        "  const normalized = raw === 'ring' ? 'ring1' : raw;",
        "  const normalized = raw === 'ring' ? 'ring1' : raw === 'tome_weapon' ? 'weapon' : raw;",
        LEDGER_SPEC,
    ),
    (
        "jumpAnchorSlotOf returns 'ring2' for a generic ring loot entry (R-D12-H)",
        LEDGER,
        "  const normalized = raw === 'ring' ? 'ring1' : raw;",
        "  const normalized = raw === 'ring' ? 'ring2' : raw;",
        LEDGER_SPEC,
    ),
    (
        "jumpAnchorSlotOf returns 'weapon' instead of null for a missing slotAugmented (R-D12-F)",
        LEDGER,
        '  if (!raw) return null;',
        "  if (!raw) return 'weapon';",
        LEDGER_SPEC,
    ),
    # ⚠ Row-sourcing caveat #2 (Tasks 5-6): this is R-28's TRUE literal prose —
    # the null-guard folded into the same condition, exactly as legacy's
    # `useViewNavigation.ts:150-165` wrote it — not just the equality flip.
    # Scored against CARD_SPEC (not LEDGER_SPEC): kills exactly four
    # RosterCard tests (NEWER, provisional-clock, and two pre-existing History
    # jumps), because entryJumpView's null cases now silently resolve to 'log'
    # too. The row pins R-D12-A; name the NEWER test as its killer — the
    # harness counts all four.
    (
        "entryJumpView regresses to R-28's literal prose (the null guard folded into one condition)",
        LEDGER,
        "  if (entryWeek == null || displayedWeek == null) return 'history';\n  return entryWeek === displayedWeek ? 'log' : 'history';",
        "  return entryWeek != null && displayedWeek != null && entryWeek < displayedWeek ? 'history' : 'log';",
        CARD_SPEC,
    ),
    # A null-guard half-deletion is an EQUIVALENT MUTANT (proven at Task 1's
    # re-review): once one half narrows its argument to `number`, the other
    # half's `=== null` is unreachable at runtime, so no test can ever kill
    # it. Whole-guard deletion is the mutant that IS observable — it makes
    # entryJumpView(null, null) fall through to the equality check, where
    # null === null is true and the guard's own 'history' answer is lost.
    (
        "entryJumpView drops the WHOLE null guard (a null displayedWeek reaches the equality check)",
        LEDGER,
        "  if (entryWeek == null || displayedWeek == null) return 'history';\n",
        '',
        LEDGER_SPEC,
    ),
    (
        "isJumpAnchorSlot returns true unconditionally (the ?slot= param's validator)",
        LEDGER,
        '  return ANCHOR_SLOTS.has(value);',
        '  return true;',
        LEDGER_SPEC,
    ),
    # ── The pulse and the tome sub-row's own anchor (RosterGearTable.tsx) ──
    (
        'RosterGearTable pulses on slot === highlightedSlot || true (every row pulses)',
        GEAR_TABLE,
        "                highlightedSlot === slot ? ' highlight-pulse' : ''",
        "                highlightedSlot === slot || true ? ' highlight-pulse' : ''",
        GEAR_TABLE_SPEC,
    ),
    (
        "the tome sub-row's anchor becomes gear-row-{playerId}-weapon (R-D12-E: steals the weapon row's id)",
        GEAR_TABLE,
        "id={playerId ? gearRowDomId(playerId, 'tome_weapon') : undefined}",
        "id={playerId ? gearRowDomId(playerId, 'weapon') : undefined}",
        GEAR_TABLE_SPEC,
    ),
    # ── Slot-forwarding scope (RosterCards.tsx) ──
    (
        'RosterCards forwards highlightedSlot to every card, not just the highlighted player',
        CARDS,
        "        highlightedSlot={player.id === highlightedPlayerId ? highlightedSlot ?? null : null}",
        '        highlightedSlot={highlightedSlot ?? null}',
        ROSTER_SPEC,
    ),
    # ── The ?slot= deep link: validation + the card-target denylist (Roster.tsx) ──
    # ⚠ The pulse alone cannot kill this — with highlightedSlot='__proto__' no
    # row pulses either way, cast or validated. The killing test also asserts
    # the row exists and that scrollIntoView was never called: an unvalidated
    # slot still reaches scrollToGearRow and scrolls the card (Task 4's
    # strengthened test, not the plain pulse assertion).
    (
        'Roster casts ?slot= instead of validating through isJumpAnchorSlot',
        ROSTER,
        "    const slot = slotParam && isJumpAnchorSlot(slotParam) ? slotParam : null;",
        '    const slot = slotParam as JumpAnchorSlot | null;',
        ROSTER_SPEC,
    ),
    (
        "Roster's row-scroll effect hardcodes 'ring2' instead of the resolved highlightedSlot",
        ROSTER,
        '    return scrollToGearRow(highlightedPlayerId, highlightedSlot);',
        "    return scrollToGearRow(highlightedPlayerId, 'ring2');",
        ROSTER_SPEC,
    ),
    (
        "Roster.handleCopyUrl drops delete('slot') (R4, the F-18 stale-slot leak)",
        ROSTER,
        "    url.searchParams.set('player', playerId);\n    // D12: a card link is a CARD target. The URL is built from the live\n    // `window.location.href`, so without this a copy taken during the 2500ms\n    // window after a slot jump ships the previous jump's row and pulses it on a\n    // player the sender never pointed at (the F-18 class).\n    url.searchParams.delete('slot');",
        "    url.searchParams.set('player', playerId);",
        ROSTER_SPEC,
    ),
    # ── The card's jumpToEntry resolver seam (RosterCard.tsx, R-D12-B/C/D) ──
    # "Settled" is the clock's CEILING past 1 (Math.max(maxWeek, currentWeek)),
    # not currentWeek alone — the doc comment at the call site names this
    # exactly. Dropping the maxWeek half is the one mutation that isolates a
    # single test: every OTHER test in the describe block sets maxWeek equal
    # to currentWeek, where the two forms agree.
    (
        "RosterCard.jumpToEntry's clockSettled drops the maxWeek half of Math.max (currentWeek alone)",
        CARD,
        '      const clockSettled = Math.max(clockMaxWeek, clockCurrentWeek) > 1;',
        '      const clockSettled = clockCurrentWeek > 1;',
        CARD_SPEC,
    ),
    (
        "RosterCard.jumpToEntry drops the override ?? half (the resolved clock always wins)",
        CARD,
        "      const displayedWeek = override ?? (clockSettled ? clockCurrentWeek : null);",
        '      const displayedWeek = clockSettled ? clockCurrentWeek : null;',
        CARD_SPEC,
    ),
    (
        'RosterCard.jumpToEntry drops the resolver (override forced to null, R-D12-B)',
        CARD,
        "      const override = resolveLogWeekOverride(groupId, tierId, jumpParams.get('week'));",
        '      const override = null;',
        CARD_SPEC,
    ),
    (
        "RosterCard.jumpToEntry also writes params.set('week', ...) (R-D12-D's load-bearing absence)",
        CARD,
        "        params.set('entryType', kind);",
        "        params.set('entryType', kind);\n        params.set('week', String(entryWeek));",
        CARD_SPEC,
    ),
    # ── Roster jump's stale-slot clear + the entry-link denylist (Loot.tsx) ──
    (
        "Loot.jumpToRecipient drops the else params.delete('slot') (a stale slot keeps pulsing)",
        LOOT,
        "      if (slot) params.set('slot', slot);\n      else params.delete('slot');",
        "      if (slot) params.set('slot', slot);",
        LOOT_SPEC,
    ),
    (
        "buildEntryLink drops delete('slot') (R5, the denylist contract)",
        LOOT,
        "  url.searchParams.delete('player');\n  url.searchParams.delete('book');\n  // D12: `slot` rides with `player` and is the third competing deep-link\n  // param. Inert today (Roster early-returns without `?player=`), but the\n  // denylist's whole point is that a param it doesn't name survives.\n  url.searchParams.delete('slot');",
        "  url.searchParams.delete('player');\n  url.searchParams.delete('book');",
        LOOT_SPEC,
    ),
    # ── A hand-rolled ledger ref (LogWeekGrid.tsx) ──
    # ⚠ Must cite the material-cell 'legs' test, not the universal-tomestone
    # null test: the tomestone case survives this mutant BY COINCIDENCE (an
    # undefined itemSlot also yields null from jumpAnchorSlotOf), so it would
    # read as a false negative if named as the killer.
    (
        "the material GridCell's buildRef hand-rolls { kind: 'loot' } instead of 'material'",
        LOG_WEEK_GRID,
        "                      buildRef={(entry) => ({ kind: 'material', entry })}",
        "                      buildRef={(entry) => ({ kind: 'loot', entry })}",
        LOG_WEEK_GRID_SPEC,
    ),
    # ── The ?player=/?slot= strip (GroupViewContent.tsx, R-D12-I) ──
    (
        "GroupViewContent's 2500ms strip drops params.delete('slot')",
        GVC,
        "        params.delete('player');\n        // D12 (R-D12-I): ?slot= rides with ?player= and is stripped by the same\n        // timer — the v2 Roster must not write the URL (its own header comment),\n        // and two writers on one boundary race. V1 never writes slot, so this\n        // delete is a no-op on every legacy path.\n        params.delete('slot');",
        "        params.delete('player');",
        GVC_SPEC,
    ),
    # ── The row-then-card scroll fallback (gearRowScroll.ts, R-D12-F) ──
    (
        'scrollToGearRow drops the player-card fallback (a row that never mounts is never found)',
        SCROLL,
        "    const el =\n      document.getElementById(gearRowDomId(playerId, slot)) ??\n      document.getElementById(`player-card-${playerId}`);",
        '    const el =\n      document.getElementById(gearRowDomId(playerId, slot));',
        SCROLL_SPEC,
    ),
]


def run_spec(spec):
    # No `shell=True`: with a list argv that is Windows-only semantics (d9b
    # round 6). Resolve the launcher per platform instead.
    out = subprocess.run(
        [NPX, 'vitest', 'run', spec],
        capture_output=True, text=True,
        encoding='utf-8', errors='replace',
    )
    blob = out.stdout + out.stderr
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
        # A pass-only summary must come with a ZERO exit. Vitest also exits
        # non-zero for failures outside the assertions — an unhandled
        # rejection, a worker crash, a config error — while still printing
        # this healthy-looking line, and taking the text at its word records
        # that as `0 failing` (PR #266, Copilot, High). On a mutation row a
        # bogus 0 reads as "killed nothing" and fails loud; on the clean-tree
        # re-check it reads as healthy and prints `Battery OK`. Only the
        # assertion-failure summary above is allowed to exit non-zero.
        if out.returncode != 0:
            return f'RUNNER FAILED (exit {out.returncode} behind a pass-only summary)'
        return 0
    return -1


def sha(path):
    return hashlib.sha1(io.open(path, 'rb').read()).hexdigest()


# --- self-check -------------------------------------------------------------
# `run_spec` is the single point every verdict in this file passes through, so
# a misread there is invisible in the output and fatal to the conclusion. Run
# it with `--selftest` (no repo mutation, no vitest) to pin its verdict table:
#
#     python ../scripts/d12-mutation-battery.py --selftest
#
# The third case is the one PR #266 (Copilot, High) caught: vitest exits
# non-zero for failures OUTSIDE the assertions — an unhandled rejection, a
# worker crash, a config error — while still printing a healthy-looking
# summary. Read as `0 failing`, that is a survived mutant on a mutation row
# (loud) but a HEALTHY TREE on the clean re-check (silent), which is exactly
# the check that exists to catch the others' fallout.
SELFTEST_CASES = [
    (1, 'Tests  3 failed | 79 passed', 3, 'assertion failures: the expected non-zero exit'),
    (0, 'Tests  82 passed', 0, 'a clean run'),
    (1, 'Tests  82 passed\n Unhandled Rejection', 'RUNNER', 'non-zero exit behind a pass-only summary'),
    (1, 'Cannot find name `canJumpTo`', 'INVALID', 'a mutant that did not compile'),
    (1, 'vitest died before printing a summary', -1, 'an unparseable run'),
]


def _selftest():
    import types
    global subprocess
    real, failures = subprocess, []
    try:
        for rc, blob, expected, why in SELFTEST_CASES:
            subprocess = types.SimpleNamespace(
                run=lambda *a, _rc=rc, _blob=blob, **k: types.SimpleNamespace(
                    stdout=_blob, stderr='', returncode=_rc,
                ),
            )
            got = run_spec('selftest-spec')
            if isinstance(expected, str):
                ok = isinstance(got, str) and got.startswith(expected)
            else:
                ok = got == expected
            print(f'{"ok  " if ok else "FAIL"}  exit {rc} + {why!r} -> {got!r}', flush=True)
            if not ok:
                failures.append(f'{why}: expected {expected!r}, got {got!r}')
    finally:
        subprocess = real
    if failures:
        print()
        print('!! SELFTEST FAILED')
        for f in failures:
            print(f'   - {f}')
        raise SystemExit(1)
    print()
    print('Selftest OK: run_spec reports every run honestly.')
    raise SystemExit(0)


if '--selftest' in sys.argv:
    _selftest()


rows = []
for label, path, old, new, spec in MUTATIONS:
    before = sha(path)
    src = io.open(path, encoding='utf-8', newline='').read()
    hits = src.count(old)
    if hits != 1:
        verdict = 'ANCHOR MISSING' if hits == 0 else f'ANCHOR NOT UNIQUE ({hits})'
        rows.append((label, verdict))
        print(f'!! {verdict.lower()}: {label}', flush=True)
        continue
    shutil.copyfile(path, path + '.bak')
    try:
        io.open(path, 'w', encoding='utf-8', newline='').write(src.replace(old, new, 1))
        killed = run_spec(spec)
    finally:
        shutil.copyfile(path + '.bak', path)
        os.remove(path + '.bak')
    if sha(path) != before:
        rows.append((label, 'RESTORE FAILED'))
        print(f'!! RESTORE FAILED (tree is dirty): {label}', flush=True)
        break
    rows.append((label, killed))
    # A string verdict is not a kill count: print it as the alarm it is rather
    # than as `RUNNER FAILED (...) killed`.
    if isinstance(killed, int):
        print(f'{killed:>3} killed  <-  {label}', flush=True)
    else:
        print(f'!! {killed}  <-  {label}', flush=True)

# The clean re-check is the proof the tree SURVIVED the mutating — every file
# restored, nothing left half-applied. It used to be printed and never scored,
# so a failing or unparseable clean run still ended in `Battery OK` and exit 0
# (PR #266, Copilot, High — the same defect as the mutation rows, one step
# further out, in the check that exists to catch the others' fallout).
print('\n--- clean tree re-check ---', flush=True)
clean = []
for spec in (LEDGER_SPEC, SCROLL_SPEC, GEAR_TABLE_SPEC, ROSTER_SPEC, CARD_SPEC,
             LOOT_SPEC, LOG_WEEK_GRID_SPEC, GVC_SPEC):
    failing = run_spec(spec)
    clean.append((spec, failing))
    print(f'{spec}: {failing} failing' if isinstance(failing, int)
          else f'{spec}: !! {failing}', flush=True)

print('\n--- markdown ---')
for label, killed in rows:
    print(f'| {label} | **{killed}** |')

# Exit non-zero on anything that means "this run did not prove what it claims"
# (PR #266, Copilot, High). Previously the script always exited 0, so a run
# that never applied a mutation — a drifted anchor, a crashed restore, an
# unparseable vitest summary — read as a clean pass at a glance. Unlike D11,
# no D12 row is documented to kill nothing (the D11 `lview` gate's
# defence-in-depth shape has no D12 counterpart) — every row here must be
# non-zero, per the task brief's global constraint.
problems = []
for label, killed in rows:
    if not isinstance(killed, int):
        problems.append(f'{label}: {killed}')
    elif killed == -1:
        problems.append(f'{label}: could not parse the vitest summary')
    elif killed == 0:
        problems.append(f'{label}: killed nothing — check the MUTATION before the tests')
if len(rows) != len(MUTATIONS):
    problems.append(f'only {len(rows)} of {len(MUTATIONS)} mutations ran')
for spec, failing in clean:
    if failing != 0:
        problems.append(
            f'clean-tree re-check {spec}: {failing} — the tree did not come back healthy, '
            'so every kill count above is suspect'
        )

if problems:
    print('\n!! BATTERY FAILED')
    for p in problems:
        print(f'   - {p}')
    raise SystemExit(1)
print('\nBattery OK: every mutation applied, restored, and scored as expected.')
