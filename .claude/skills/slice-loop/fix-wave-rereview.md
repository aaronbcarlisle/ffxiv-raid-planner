# Fix-wave re-review dispatch (slice-loop)

Agent: `redesign-reviewer`. Scope = the findings list and the fix diff, nothing else. Once per wave.

```
description: "Re-review fix wave: <slice>"
prompt: |
  A whole-branch review produced findings; one fix wave attempted them. Verdict each finding
  and inspect the fix diff — nothing else. Do not re-review code the wave did not touch.

  Findings under verification (verbatim):
  - <finding with file:line>

  Fix diff package (FIX_BASE = the head your review saw): <PACKAGE_PATH>
  Fix report, appended to the implementer report: <REPORT_PATH>

  Output, file:line on every line:
  - per finding: ADDRESSED | NOT ADDRESSED — "attempted" is not addressed; the defect must be gone;
  - "New breakage in the fix diff": Critical / Important / Minor, or None;
  - "Out of scope": non-blocking observations, or None;
  - verdict: all addressed | open: <list>.
```
