# Implementer dispatch (slice-loop)

Agent: `xivrp-implementer` (default) · `xivrp-implementer-deep` (the plan's riskiest task, or a fix that survived two same-agent rounds) · `xivrp-implementer` + `model: haiku` on the call (the brief contains the complete code). The agent definition already carries the standing rules — V1 frozen, shared layers, design system, gates, no subagents, no attribution, the ~40-line report cap. Do not restate them.

```
description: "Task N: <name>"
prompt: |
  Task N of the <slice> slice: <one line on where it fits>.

  Read your brief first — it is your requirements, with the exact values to use verbatim:
  <BRIEF_PATH>

  Interfaces from earlier tasks the brief cannot know:
  - <symbol / file / contract>

  Rulings that bind this task:
  - <ruling>

  Work on the current branch. Commit when green: `feat(v2): <slice> Task N — <what>`.

  Write your report to <REPORT_PATH> (≤ ~40 lines: files changed; each gate command with its
  result line; concerns). Reply with ONLY: Status DONE | DONE_WITH_CONCERNS | BLOCKED |
  NEEDS_CONTEXT · commits (sha + subject) · one-line test summary · concerns · the report path.
  If BLOCKED or NEEDS_CONTEXT, put the specifics in the reply itself.
```

**Fix message** (same agent, after the whole-branch review or a riskiest-task review):

```
Findings from the review, verbatim and complete:
- <finding with file:line>

Fix each. Re-run the covering tests (name them), append a "Fix" section to <REPORT_PATH>
with the command and its output, commit, and reply with the same short contract.
```

**Batch dispatch** (several small same-shape tasks): one prompt listing every file and its change; the review sees the batch as one diff.
