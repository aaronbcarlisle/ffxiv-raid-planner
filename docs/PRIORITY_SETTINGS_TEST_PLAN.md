# Priority Settings Test Plan

Testing instructions for the flexible priority settings feature (Phase 1).

> **Note**: This test plan was written for an early iteration. The current system uses
> different mode names: `role-based`, `job-based`, `player-based`, `manual-planning`, and `disabled`.
> The concepts below map as follows:
> - "Automatic" → `role-based` mode (default, uses role-based priority)
> - "Manual" → Mode selector with priority display but no auto-highlighting
> - "Disabled" → `disabled` mode (all players show score of 0)

## Prerequisites

1. Start the dev servers: `./dev.sh`
2. Log in with a user that has owner or lead role on a static

---

## Test 1: Priority Mode Settings

1. **Open Group Settings**
   - Click the gear icon on your static's page
   - Navigate to the **Priority** tab

2. **Test Automatic Mode (default)**
   - Verify the dropdown shows "Automatic (recommended)"
   - Confirm the role priority order drag-drop is visible
   - Save and check the Loot Priority panel - first player should be highlighted in teal

3. **Test Manual Mode**
   - Change mode to "Manual (show priority, I decide)"
   - Save settings
   - Go to Loot Priority panel → Gear Priority tab
   - Verify scores are shown but NO player is highlighted (no teal background)

4. **Test Disabled Mode**
   - Change mode to "Disabled (equal distribution)"
   - Verify the role priority order section is hidden
   - Save settings
   - Go to Loot Priority panel
   - Verify all players show score of **0** and no highlighting

---

## Test 2: Job Priority Modifiers

1. **Add a Job Modifier**
   - Open Group Settings → Priority tab
   - Expand "Advanced Options"
   - In "Job Priority Adjustments", select a job (e.g., PCT)
   - Click the + button to add it
   - Set the value to +30

2. **Verify the Effect**
   - Save settings
   - Go to Loot Priority panel
   - Find a player with that job
   - Hover over their priority score badge
   - Verify the tooltip shows "Job Modifier: +30"

3. **Test Negative Modifier**
   - Add a modifier of -20 to another job
   - Verify that job's players have lower priority scores

4. **Remove a Modifier**
   - Click the X button next to a job modifier
   - Save and verify it no longer affects scores

---

## Test 3: Player Priority Modifier

1. **Open Player Context Menu**
   - Right-click on any player card
   - Click "Adjust Priority"

2. **Set a Modifier**
   - In the modal, set the value to +25
   - Click Save

3. **Verify the Effect**
   - Go to Loot Priority panel
   - Find that player
   - Hover over their priority score
   - Verify tooltip shows "Player Modifier: +25"

4. **Test Reset**
   - Open the modal again
   - Click "Reset to 0"
   - Save and verify the modifier is removed

---

## Test 4: Show Priority Scores Toggle

1. **Disable Score Display**
   - Open Group Settings → Priority → Advanced Options
   - Uncheck "Show priority scores"
   - Save

2. **Verify**
   - Go to Loot Priority panel
   - Verify the colored score badges are hidden
   - Players are still listed but without visible scores

3. **Re-enable**
   - Check the box again and save
   - Verify scores reappear

---

## Test 5: Enhanced Fairness Scoring

1. **Enable Enhanced Scoring**
   - Open Group Settings → Priority → Advanced Options
   - Check "Enable enhanced fairness scoring"
   - Save

2. **Log Some Loot** (if not already done)
   - Go to the Log tab and log a few drops for different players

3. **Verify Enhanced Scoring**
   - Go to Loot Priority panel
   - You should see "Loot history adjustments active" message
   - Hover over scores to see:
     - "No Drops Bonus" for players who haven't received loot recently
     - "Fair Share Adj" penalty for players who've received more than average

4. **Disable and Verify**
   - Uncheck "Enable enhanced fairness scoring"
   - Save and verify the enhanced adjustments disappear

---

## Test 6: Priority Breakdown Tooltip

1. **Hover over any priority score** in the Gear Priority tab
2. **Verify the breakdown shows**:
   - Role Priority (based on role order)
   - Gear Needed (based on incomplete slots)
   - Job Modifier (if set)
   - Player Modifier (if set)
   - Loot Adj (if player has loot adjustment)
   - No Drops Bonus (if enhanced scoring enabled)
   - Fair Share Adj (if enhanced scoring enabled)

---

## Test 7: Backwards Compatibility

1. **Create a new static** with default settings
2. **Verify** priority works exactly as before (automatic mode, DPS-first priority)
3. **Verify** existing statics continue working without issues

---

## Feature Summary

| Setting | Location | Default | Effect |
|---------|----------|---------|--------|
| Priority Mode | Settings → Priority | Automatic | Controls how priority is calculated/displayed |
| Role Priority Order | Settings → Priority | DPS first | Order roles are prioritized |
| Job Modifiers | Settings → Priority → Advanced | None | Per-job score adjustments |
| Player Modifier | Player Card → Context Menu | 0 | Per-player score adjustment |
| Show Priority Scores | Settings → Priority → Advanced | On | Toggle score badge visibility |
| Enhanced Fairness | Settings → Priority → Advanced | Off | Adds drought bonus/balance penalty |
