/* eslint-disable design-system/no-raw-button */
// design-system-ignore: temporary F6a scaffold spine, replaced in Task 6
import { GroupViewContent } from './GroupViewContent';
import { useGroupViewState } from '../hooks/useGroupViewState';

export function NewShell() {
  const gv = useGroupViewState();
  // F6a: chrome actions can wire to NewShell-local modal state mirroring GroupView; Task 8
  // unifies these into a shared store/context so neither chrome duplicates the modal state.
  const actions = { onTierChange: () => {}, onAddPlayer: () => {}, onNewTier: () => {}, onRollover: () => {}, onDeleteTier: () => {} };
  return (
    <div className="flex min-h-0 flex-1" data-testid="new-shell">
      {/* placeholder rail — Task 7 */}
      <aside className="w-[72px] shrink-0 border-r border-border-default" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* placeholder top bar — Tasks 9/10 */}
        <div className="h-14 border-b border-border-default" />
        {/* placeholder spine — Task 6 */}
        <div role="tablist" className="flex gap-1 border-b border-border-default">
          {(['overview', 'roster', 'gear', 'schedule'] as const).map(t => (
            // design-system-ignore: temporary F6a scaffold spine, replaced in Task 6
            <button
              key={t}
              role="tab"
              aria-selected={gv.pageMode === t}
              onClick={() => gv.setPageMode(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div id="main-content" className="min-h-0 flex-1 overflow-y-auto">
          <GroupViewContent actions={actions} />
        </div>
      </div>
    </div>
  );
}
