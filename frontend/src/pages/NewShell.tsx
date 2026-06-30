import { GroupViewContent } from './GroupViewContent';
import { useGroupViewState } from '../hooks/useGroupViewState';
import { Spine } from '../components/layout/Spine';

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
        <Spine activeTab={gv.pageMode} onTabChange={gv.setPageMode} />
        <div id="main-content" className="min-h-0 flex-1 overflow-y-auto">
          <GroupViewContent actions={actions} />
        </div>
      </div>
    </div>
  );
}
