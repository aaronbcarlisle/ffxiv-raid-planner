# FFXIV Raid Planner Updates

## **v1.0.4 → v1.0.6 Release Notes**

Hey everyone! Here's a roundup of all the recent updates to the raid planner:

---

## [**v1.0.6 - Security Hardening**](https://www.xivraidplanner.app/docs/release-notes#v1.0.6) (Latest)

### What's New
Your login is now more secure! Authentication tokens are stored in **httpOnly cookies** instead of localStorage, protecting against XSS attacks.

### Security Improvements
- **httpOnly Cookies** - Tokens stored server-side, invisible to browser scripts
- **SameSite=Lax** - Prevents cross-site request forgery (CSRF) attacks
- **Secure Flag** - Cookies only sent over HTTPS in production
- **Protected Logout** - Requires auth to prevent forced logout attacks

### Bug Fixes
- Logout now works even with expired access tokens (auto-refreshes first)
- Fixed stale auth state when cookies expire

---

## [**v1.0.5 - Shortcuts & Polish**](https://www.xivraidplanner.app/docs/release-notes#v1.0.5)

### What's New
Keyboard shortcuts got a complete overhaul! They now work reliably across all browsers.

### Improvements
- **Redesigned keyboard shortcuts** - No more conflicts with browser defaults
  - Management: `Alt+Shift+P` (Add Player), `Alt+Shift+N` (New Tier), etc.
  - Week nav: `Alt+Arrow` instead of `Ctrl+Arrow`
- **Shortcut hints in menus** - Gear dropdown now shows keyboard shortcuts
- **Readable notation** - Shows `Ctrl+S` instead of `⌃S` symbols
- **Tips carousel** - Rotating helpful hints in the header bar

### Bug Fixes
- `V` key now works on Weapon Priorities tab
- Week navigation shortcuts fixed on Log tab

---

## [**v1.0.4 - Design System & UX**](https://www.xivraidplanner.app/docs/release-notes#v1.0.4)

### What's New
Major UX improvements for power users and better cross-week navigation!

### New Features
- **Cross-week loot navigation** - Jump to loot entries in any week from player cards
- **Enhanced keyboard shortcuts**
  - `Alt+L` - Log Loot
  - `Alt+M` - Log Material
  - `Alt+B` - Mark Floor Cleared
  - `Shift+S` - Go to My Statics
  - `Shift+?` - Keyboard shortcuts help
- **Shift+Click to copy links** - Quick link copying from player cards and loot entries
- **Keyboard Shortcuts in user menu** - Quick access from dropdown

### Improvements
- Hotkey hints shown in tooltips and action buttons
- GearTable UI cleanup - better small-screen support
- BiS Import modal shows job icons and gear slot icons

### Bug Fixes
- Week switching visual bug fixed - entries appear immediately
- Job change now shows confirmation dialog

---

## **What You Need to Do**

**Nothing!** All updates are automatic. For the security update, just log out and back in to use the new secure authentication.

---

## [**Quick Reference - Keyboard Shortcuts**](https://www.xivraidplanner.app/docs/member-guide#keyboard-shortcuts)

Press `Shift+?` in-app to open the shortcuts modal!

| Key | Action |
|-----|--------|
| `1-4` | Switch tabs (Players/Loot/Log/Summary) |
| `V` | Expand/collapse all |
| `G` | Toggle G1/G2 or Grid/List view |
| `S` | Toggle substitutes |
| `Shift+?` | Show all shortcuts |
| `Alt+L` | Log Loot |
| `Alt+M` | Log Material |
| `Alt+B` | Mark Floor Cleared |
| `Shift+Click` | Copy link to clipboard |

---

## **Links**

- [Full Release Notes](https://www.xivraidplanner.app/docs/release-notes)
- [Member Guide](https://www.xivraidplanner.app/docs/member-guide)
- [PR #18 (Security)](https://github.com/aaronbcarlisle/ffxiv-raid-planner-dev/pull/18)

---

*Questions or feedback? Let me know!*
