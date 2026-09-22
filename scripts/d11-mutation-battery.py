"""Re-run every D11 mutation claim against the CURRENT tree, one at a time.

Each entry: (label, file, old, new, test target). Applies the mutation, runs the
target spec, records how many tests failed, then restores the file and PROVES
the restore was byte-identical before moving on.

RUN FROM `frontend/` — the paths below are relative to it, though this file
lives at the repo root:

    cd frontend && python ../scripts/d11-mutation-battery.py

Harness inherited from `d9b-mutation-battery.py`, whose three hard-won rules
all still apply and are all still enforced below:

  1. The anchor must be present AND UNIQUE. `replace(old, new, 1)` silently
     takes the first occurrence, so a duplicated anchor mutates the wrong site
     and reports a kill for a defect never introduced (PR #265 round 7).
  2. A mutant that cannot compile fails EVERY test in the spec, which reads as
     a large kill count while proving nothing (PR #265 round 5). Detected
     explicitly as INVALID MUTANT.
  3. A row reporting 0 is first evidence about the MUTATION, not the test.

D11 adds a fourth: the restore is verified by hash, not assumed. Two of this
branch's ancestors were left with a mutation in the working tree by a crashed
subprocess, and a `finally` that copies back is only as good as the bytes it
copies — so each row re-reads the file afterwards and compares.

Coverage spans all four D11 tasks: the row and menu (LootHistoryTable), the
jump (Loot), the shortcut and its three gates (Loot + the SHARED
useKeyboardShortcuts hook), the `inputRef` seam (HistorySearch), and the
V1-unchanged help assert (Layout).
"""
import hashlib
import io
import os
import re
import shutil
import subprocess

NPX = 'npx.cmd' if os.name == 'nt' else 'npx'

LHT = 'src/components/loot/LootHistoryTable.tsx'
LOOT = 'src/components/loot/Loot.tsx'
SEARCH = 'src/components/loot/HistorySearch.tsx'
LAYOUT = 'src/components/layout/Layout.tsx'
HOOK = 'src/hooks/useKeyboardShortcuts.ts'

LHT_SPEC = 'src/components/loot/LootHistoryTable.test.tsx'
LOOT_SPEC = 'src/components/loot/Loot.test.tsx'
SEARCH_SPEC = 'src/components/loot/HistorySearch.test.tsx'
LAYOUT_SPEC = 'src/components/layout/Layout.chrome.test.tsx'

MUTATIONS = [
    # ── The row (R-31 / R-D11-E / R-D11-F) ───────────────────────────────
    (
        'kebab click no longer stops propagation (one click both opens the menu AND edits)',
        LHT,
        "        e.stopPropagation();\n        const r = e.currentTarget.getBoundingClientRect();",
        "        const r = e.currentTarget.getBoundingClientRect();",
        LHT_SPEC,
    ),
    (
        'focus ring loses `ring-inset` (outset ring, clipped by the card`s overflow-clip)',
        LHT,
        " focus-visible:ring-accent focus-visible:ring-inset'",
        " focus-visible:ring-accent'",
        LHT_SPEC,
    ),
    (
        'Alt-held pointer drops the jump-target gate (`canEdit || altHeld`)',
        LHT,
        'const pointer = canEdit || (altHeld && canJumpTo(item));',
        'const pointer = canEdit || altHeld;',
        LHT_SPEC,
    ),
    (
        'row is focusable+roled for EVERYONE (V1`s lying row restored)',
        LHT,
        "                    tabIndex={canEdit ? 0 : undefined}\n                    role={canEdit ? 'button' : undefined}",
        "                    tabIndex={0}\n                    role='button'",
        LHT_SPEC,
    ),
    # ── The menu (R-32 / R-D11-H) ────────────────────────────────────────
    (
        'menu Edit ungated from canEdit (a viewer gets an Edit item)',
        LHT,
        "  if (ctx.canEdit) {\n    items.push({\n      label: 'Edit',",
        "  if (true) {\n    items.push({\n      label: 'Edit',",
        LHT_SPEC,
    ),
    # Added after the whole-branch review found this gate had ZERO coverage:
    # deleting it passed every D11 test, and a ghost row would then offer
    # "Jump to Departed Player" into `?player=ghost` — the row's own defect
    # (R-D11-E) reappearing one control over. T-13b is the test; this is the
    # proof T-13b can fail.
    (
        'menu Jump ungated from the roster lookup (a ghost row offers a dead jump)',
        LHT,
        '  if (ctx.playersById.has(recipientId)) {',
        '  if (true) {',
        LHT_SPEC,
    ),
    # ── The jump (R-D11-A / R-D11-B) ─────────────────────────────────────
    (
        'jump handler also writes `?week=` (the inert param R-D11-B rejects)',
        LOOT,
        "      params.set('entryType', item.kind);\n      params.delete('book');",
        "      params.set('entryType', item.kind);\n      params.set('week', String(item.entry.weekNumber));\n      params.delete('book');",
        LOOT_SPEC,
    ),
    # ── The shortcut and its three gates (R-35) ──────────────────────────
    # EXPECTED 0, and the 0 is the finding — see rule 3 in the docstring.
    # Off History `HistorySearch` is unmounted, so React has already nulled
    # `historySearchRef`; the optional chain is the load-bearing gate and this
    # `lview` check is defence in depth against a future keep-mounted refactor.
    # Kept deliberately (comment at the call site says why). A row reporting 0
    # here is CORRECT; a row reporting >0 would mean the ref survives unmount,
    # which is worth knowing immediately.
    # Anchor re-derived after the round-3 modal fix reshaped this action from a
    # one-liner into a block. The previous anchor silently stopped matching —
    # and the new exit-code check above caught it on its first run, which is
    # precisely what it was added for (PR #266, Copilot, High).
    (
        'gate 3 removed: `lview` check dropped from the action (defence in depth — expected 0)',
        LOOT,
        "        if (lview !== 'history') return;\n",
        '',
        LOOT_SPEC,
    ),
    (
        'gate 2 removed: the modal guard (`disabled`) is switched off',
        LOOT,
        '    disabled: anyModalOpen,\n    shortcuts: [{',
        '    disabled: false,\n    shortcuts: [{',
        LOOT_SPEC,
    ),
    # Both added after PR #266 round 3: Copilot found the modal guard covered
    # only Loot-owned state, so an open chrome dialog or the global Shift+?
    # help left `Ctrl+Shift+F` focusing the box BEHIND it.
    (
        'gate 2(a) narrowed back to Loot-owned modals (a chrome action dialog no longer blocks)',
        LOOT,
        '    adjustmentsOpen || deleteTarget !== null || resetConfig !== null ||\n    isActionModalOpen;',
        '    adjustmentsOpen || deleteTarget !== null || resetConfig !== null;',
        LOOT_SPEC,
    ),
    (
        'gate 2(b) removed: focus inside an unreachable overlay no longer blocks',
        LOOT,
        "        if (document.activeElement?.closest('[role=\"dialog\"],[aria-modal=\"true\"]')) return;\n",
        '',
        LOOT_SPEC,
    ),
    (
        'gate 1 removed in the SHARED hook: typing in an input no longer suppresses shortcuts',
        HOOK,
        'if (!areShortcutsEnabled() || isInputElement(event.target)) return;',
        'if (!areShortcutsEnabled()) return;',
        LOOT_SPEC,
    ),
    # ── The `inputRef` seam (M2, the defect a reviewer caught pre-ship) ──
    (
        'clearSearch reverts to the internal ref (N5 focus-restore dies for a caller-supplied ref)',
        SEARCH,
        "  const clearSearch = () => {\n    onQueryChange('');\n    ref.current?.focus();",
        "  const clearSearch = () => {\n    onQueryChange('');\n    internalRef.current?.focus();",
        SEARCH_SPEC,
    ),
    # ── V1 safety (M5): the assert `git diff` structurally cannot make ───
    (
        'legacy help mount ALSO receives extraGroups (V1`s Shift+? help changes)',
        LAYOUT,
        '      {/* Global keyboard shortcuts modal */}\n      <KeyboardShortcutsHelp\n        isOpen={showKeyboardHelp}',
        '      {/* Global keyboard shortcuts modal */}\n      <KeyboardShortcutsHelp\n        extraGroups={V2_SHORTCUT_GROUPS}\n        isOpen={showKeyboardHelp}',
        LAYOUT_SPEC,
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
        return 0
    return -1


def sha(path):
    return hashlib.sha1(io.open(path, 'rb').read()).hexdigest()


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
    print(f'{str(killed):>3} killed  <-  {label}', flush=True)

# The clean re-check is the proof the tree SURVIVED the mutating — every file
# restored, nothing left half-applied. It used to be printed and never scored,
# so a failing or unparseable clean run still ended in `Battery OK` and exit 0
# (PR #266, Copilot, High — the same defect as the mutation rows, one step
# further out, in the check that exists to catch the others' fallout).
print('\n--- clean tree re-check ---', flush=True)
clean = []
for spec in (LHT_SPEC, LOOT_SPEC, SEARCH_SPEC, LAYOUT_SPEC):
    failing = run_spec(spec)
    clean.append((spec, failing))
    print(f'{spec}: {failing} failing', flush=True)

print('\n--- markdown ---')
for label, killed in rows:
    print(f'| {label} | **{killed}** |')

# Exit non-zero on anything that means "this run did not prove what it claims"
# (PR #266, Copilot, High). Previously the script always exited 0, so a run
# that never applied a mutation — a drifted anchor, a crashed restore, an
# unparseable vitest summary — read as a clean pass at a glance. `EXPECT_ZERO`
# is the ONE row documented to kill nothing (the `lview` check is defence in
# depth behind an already-null ref); a NON-zero there is also a failure,
# because it would mean the ref outlives unmount.
EXPECT_ZERO = 'gate 3 removed'
problems = []
for label, killed in rows:
    expected_zero = label.startswith(EXPECT_ZERO)
    if not isinstance(killed, int):
        problems.append(f'{label}: {killed}')
    elif killed == -1:
        problems.append(f'{label}: could not parse the vitest summary')
    elif expected_zero and killed != 0:
        problems.append(f'{label}: expected 0, got {killed} — the ref now survives unmount')
    elif not expected_zero and killed == 0:
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
