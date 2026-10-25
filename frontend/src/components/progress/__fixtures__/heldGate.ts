/**
 * The held-response gate the fake servers share: `hold()` makes every `wait()` park until the
 * release it returned runs; with no hold open, `wait()` resolves at once.
 */
export function heldGate() {
  let held: Promise<void> | null = null;
  return {
    /** Parks the handler while a hold is open. */
    wait: async (): Promise<void> => {
      if (held) await held;
    },
    /** Opens a hold; the returned function releases it. */
    hold: (): (() => void) => {
      let release = () => {};
      held = new Promise<void>((resolve) => {
        release = () => {
          held = null;
          resolve();
        };
      });
      return () => release();
    },
  };
}
