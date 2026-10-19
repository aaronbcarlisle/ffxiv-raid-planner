/**
 * jsdom keeps focus on a control that becomes `disabled`; a browser moves it to <body> (HTML's
 * focus fixup rule), which is what the G3 live walk saw. This does what the browser does, so a
 * focus assertion fails the way the page would. Returns the stop.
 */
export function emulateFocusFixup(): () => void {
  const observer = new MutationObserver((records) => {
    for (const { target } of records) {
      if (target === document.activeElement && target instanceof HTMLElement && target.hasAttribute('disabled')) target.blur();
    }
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['disabled'], subtree: true });
  return () => observer.disconnect();
}
