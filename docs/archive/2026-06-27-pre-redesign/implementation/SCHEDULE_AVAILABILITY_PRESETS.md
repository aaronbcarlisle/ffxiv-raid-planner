# Schedule Availability Presets

The schedule availability grid has three preset views:

- Prime raid time: 6 PM through 2 AM
- Evening: 4 PM through midnight
- Full day: all 24 hours

These presets are display filters only. They must not create separate saved availability results.

## Cross-midnight columns

Prime raid time crosses midnight. Rows after midnight are displayed under the raid-night column with an "After Midnight (+1 day)" divider, but they are stored against the actual next day or date.

Examples:

- Monday 11:30 PM is stored as `MO|23:30`
- Monday after-midnight 12:00 AM is stored as `TU|00:00`
- `2026-06-18` after-midnight 12:00 AM is stored as `2026-06-19|00:00`

This keeps Prime raid time, Evening, and Full day consistent: switching presets changes which slots are visible, not what availability exists.

## Interaction model

Drag selection uses an optimistic committed selection set while saves are in flight. The visual transition on cells is decorative only and must not block later selections. A second drag should start from the latest local committed selection even before the previous save response returns.
