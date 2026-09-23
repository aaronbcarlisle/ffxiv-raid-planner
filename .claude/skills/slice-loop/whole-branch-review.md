# Whole-branch review dispatch (slice-loop)

Agent: `redesign-reviewer` (fable · xhigh — never downgraded). One dispatch per slice. The same template scoped to a single task's package is the riskiest-task exception. The agent definition already carries read-only, do-not-trust-the-report, do-not-broaden, the redesign lenses and the severity contract (Minors → `## Batch at slice end`). Do not restate them, and never pre-judge a finding in the prompt.

```
description: "Whole-branch review: <slice>"
prompt: |
  Review the <slice> branch as a mergeable whole.

  Review package — commits, stat, full diff with context. Read it once; do not re-run git:
  <PACKAGE_PATH>
  Plan: <PLAN_PATH> · Spec: <SPEC_PATH>
  Implementer reports: <REPORT_PATHS>

  Global constraints that bind this slice (verbatim from the plan/spec):
  - <constraint>

  Minors already batched during the task loop — triage which must be fixed before merge:
  - <ledger minor lines>

  Judge, with file:line for every finding and every check:
  - spec compliance per task — missing / extra / misunderstood;
  - cross-task consistency and contract drift;
  - V1 safety — no hunk under legacy-only paths, every shared-layer hunk named and justified;
  - illegal states actually uncompilable; enforcement actually failing on new violations;
  - tests asserting real behavior — name any you believe vacuous and the ONE executed
    mutation trace you want for it.
  ⚠ "cannot verify from diff" items go in their own list.

  Output: spec verdict first, then Critical / Important / `## Batch at slice end`, then
  "Ready to merge: Yes | With the fix wave | No" and one sentence why.
```
