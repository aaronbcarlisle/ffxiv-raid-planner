/**
 * SettingsGear (F6a, Task 10) — v2 TopBar settings affordance.
 *
 * Single `IconButton` that toggles the Global Settings panel via
 * `settingsPanelStore`. Replicates the `SettingsPanelController` toggle
 * semantics inline (the `{ toggle: true }` path in SettingsPanelController.tsx):
 * if the panel is open → close; if closed → open.
 *
 * Icon switches between `Settings` (closed) and `PanelRightClose` (open),
 * mirroring the mobile gear in `Header.tsx:334`.
 *
 * No badge — join-count display belongs to `NotificationBell`.
 *
 * Byte-for-byte rule: does NOT modify `Header`, `UserMenu`, or
 * `SettingsDockToggle`. Those stay intact for the legacy route.
 */
import { Settings, PanelRightClose } from 'lucide-react';
import { useSettingsPanelStore } from '../../stores/settingsPanelStore';
import { IconButton, Tooltip } from '../primitives';

export function SettingsGear() {
  const isOpen = useSettingsPanelStore((s) => s.isOpen);
  const open = useSettingsPanelStore((s) => s.open);
  const close = useSettingsPanelStore((s) => s.close);

  // Replicate SettingsPanelController toggle semantics (d.toggle=true path).
  // See SettingsPanelController.tsx:23-30.
  const handleToggle = () => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  };

  return (
    <Tooltip content={isOpen ? 'Close settings' : 'Settings'}>
      <IconButton
        aria-label="Settings"
        aria-expanded={isOpen}
        aria-pressed={isOpen}
        icon={
          isOpen
            ? <PanelRightClose className="w-5 h-5" />
            : <Settings className="w-5 h-5" />
        }
        variant="ghost"
        size="md"
        onClick={handleToggle}
      />
    </Tooltip>
  );
}
