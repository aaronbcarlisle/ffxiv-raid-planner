import { useEffect, useState } from 'react';

/**
 * Whether the Alt key is currently held. Drives the jump icons' cursor (user
 * ruling, PR #191): the hand cursor must appear ONLY while the modifier is
 * down — a persistent pointer would advertise a plain click the Alt-gated
 * jump won't honor. Global listeners (not pointermove): pressing a modifier
 * over a stationary cursor fires no pointer event. Blur resets so Alt+Tab
 * can't strand the held state.
 */
export function useAltHeld(): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setHeld(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setHeld(false);
    };
    const reset = () => setHeld(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', reset);
    };
  }, []);
  return held;
}
