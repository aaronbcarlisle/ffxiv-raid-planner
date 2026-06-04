import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../components/primitives/Button';
import { Badge } from '../components/primitives/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { CharacterCard } from '../components/profile/CharacterCard';
import { CharacterLinkModal } from '../components/profile/CharacterLinkModal';
import { GearSnapshotView } from '../components/profile/GearSnapshotView';
import { JobProfileCard } from '../components/profile/JobProfileCard';
import { JobProfileModal } from '../components/profile/JobProfileModal';
import { OverviewTab } from '../components/profile/OverviewTab';
import { CollectionsTab } from '../components/profile/CollectionsTab';
import { GoalsTab } from '../components/profile/GoalsTab';
import { PreviewShareTab } from '../components/profile/PreviewShareTab';
import { usePlayerProfileStore } from '../stores/playerProfileStore';
import type { PlayerJobProfile } from '../stores/playerProfileStore';
import { useAuthStore } from '../stores/authStore';
import { useModal } from '../hooks/useModal';
import { fadeInProps, staggerContainerProps, staggerItemProps } from '../lib/motion';

type ProfileTab = 'overview' | 'characters' | 'gear' | 'jobs' | 'collections' | 'goals' | 'preview';

export default function Profile() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { profile, goals, gearSnapshots, loading, fetchProfile, fetchGoals } = usePlayerProfileStore();
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const linkModal = useModal();
  const addJobModal = useModal();
  const [editingJob, setEditingJob] = useState<PlayerJobProfile | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchProfile();
    fetchGoals();
  }, [user, navigate, fetchProfile, fetchGoals]);

  if (!user) return null;

  if (loading && !profile) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Skeleton className="h-12 w-64 mb-6" />
        <Skeleton className="h-48 mb-4" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  const characters = profile?.characters ?? [];
  const jobProfiles = profile?.jobProfiles ?? [];
  const mainCharacter = characters.find((c) => c.isMain) ?? characters[0];
  const mainJob = jobProfiles.find((j) => j.priority === 'main');
  const hasGear = Object.values(gearSnapshots).some((s) => s.length > 0);

  const hasReadyJob = jobProfiles.some((j) => j.readiness !== 'unknown');
  const shareReady = profile?.shareEnabled && profile?.visibility !== 'private';

  const nextStep = !characters.length
    ? { label: 'Link Character', action: () => linkModal.open() }
    : !mainJob
      ? { label: 'Set Main Job', action: () => addJobModal.open() }
      : !hasGear
        ? { label: 'Sync Gear', action: () => setActiveTab('characters') }
        : !hasReadyJob
          ? { label: 'Set Readiness', action: () => setActiveTab('jobs') }
          : !shareReady
            ? { label: 'Preview / Share', action: () => setActiveTab('preview') }
            : null;

  const tabs: { id: ProfileTab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'characters', label: 'Characters', count: characters.length },
    { id: 'gear', label: 'Gear' },
    { id: 'jobs', label: 'Jobs', count: jobProfiles.length },
    { id: 'collections', label: 'Collections' },
    { id: 'goals', label: 'Goals' },
    { id: 'preview', label: 'Preview / Share' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div {...fadeInProps} className="mb-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {/* User avatar */}
            <div className="w-16 h-16 rounded-full overflow-hidden bg-surface-elevated flex-shrink-0 border-2 border-accent/30">
              {mainCharacter?.avatarUrl ? (
                <img src={mainCharacter.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl text-text-tertiary">
                  &#9876;
                </div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-text-primary">
                My Profile
              </h1>
              {mainCharacter && (
                <div className="text-text-secondary mt-0.5">
                  {mainCharacter.name} &middot; {mainCharacter.server}
                </div>
              )}
              <div className="flex items-center gap-2 mt-1">
                {mainJob && (
                  <Badge variant={mainJob.role as 'tank' | 'healer' | 'melee' | 'ranged' | 'caster'} size="sm">
                    {mainJob.job} Main
                  </Badge>
                )}
                <Badge
                  variant={profile?.visibility === 'private' ? 'default' : profile?.visibility === 'shareable' ? 'info' : 'success'}
                  size="sm"
                >
                  {profile?.visibility === 'private' ? 'Private' : profile?.visibility === 'shareable' ? 'Shareable' : 'Discoverable'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Visibility badge — full controls in Preview / Share tab */}
          <Badge
            variant={profile?.shareEnabled ? 'success' : 'default'}
            size="sm"
          >
            {profile?.shareEnabled ? 'Sharing On' : 'Sharing Off'}
          </Badge>
        </div>
      </motion.div>

      {/* Tab navigation — scrollable on mobile */}
      <div className="flex gap-1 bg-surface-raised rounded-lg p-1 mb-6 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-1">
        {tabs.map((tab) => (
          /* design-system-ignore: Tab button requires specific toggle styling */
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors border whitespace-nowrap flex-shrink-0
              ${
                activeTab === tab.id
                  ? 'bg-accent/20 text-accent border-accent/30'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated border-transparent'
              }
            `}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className="text-xs bg-surface-base px-1.5 py-0.5 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && profile && (
        <OverviewTab
          profile={profile}
          goals={goals}
          gearSnapshots={gearSnapshots}
          onNavigate={(tab) => setActiveTab(tab as ProfileTab)}
          onOpenLinkModal={linkModal.open}
          onOpenJobModal={addJobModal.open}
        />
      )}

      {activeTab === 'characters' && (
        <motion.div {...staggerContainerProps} className="space-y-4">
          {characters.length === 0 ? (
            <motion.div {...staggerItemProps} className="text-center py-12 bg-surface-raised rounded-lg border border-border-default">
              <div className="text-4xl mb-3">&#9876;</div>
              <h3 className="text-lg font-display font-semibold text-text-primary mb-1">
                No characters linked
              </h3>
              <p className="text-text-secondary mb-4">
                Link your FFXIV character to start tracking gear and syncing from Lodestone.
              </p>
              <Button onClick={linkModal.open}>Link Character</Button>
            </motion.div>
          ) : (
            <>
              {characters.map((char) => (
                <motion.div key={char.id} {...staggerItemProps}>
                  <CharacterCard character={char} />
                </motion.div>
              ))}
              <Button variant="secondary" onClick={linkModal.open}>
                Link Another Character
              </Button>
            </>
          )}
        </motion.div>
      )}

      {activeTab === 'gear' && (
        <div>
          {characters.length === 0 ? (
            <div className="text-center py-12 bg-surface-raised rounded-lg border border-border-default">
              <div className="text-4xl mb-3">&#128230;</div>
              <h3 className="text-lg font-display font-semibold text-text-primary mb-1">
                Link a character first
              </h3>
              <p className="text-text-secondary mb-4">
                You need to link at least one character before you can view or sync gear.
              </p>
              <Button onClick={() => { setActiveTab('characters'); linkModal.open(); }}>
                Link Character
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {characters.map((char) => (
                <div key={char.id}>
                  <h3 className="text-lg font-display font-semibold text-text-primary mb-3 flex items-center gap-2">
                    {char.name}
                    <span className="text-text-tertiary text-sm font-normal">&middot; {char.server}</span>
                    {char.isMain && <Badge variant="raid" size="sm">Main</Badge>}
                  </h3>
                  <GearSnapshotView characterId={char.id} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'jobs' && (
        <motion.div {...staggerContainerProps} className="space-y-4">
          {jobProfiles.length === 0 ? (
            <motion.div {...staggerItemProps} className="text-center py-12 bg-surface-raised rounded-lg border border-border-default">
              <div className="text-4xl mb-3">&#127919;</div>
              <h3 className="text-lg font-display font-semibold text-text-primary mb-1">
                No jobs configured
              </h3>
              <p className="text-text-secondary mb-4">
                Add your main job and any alt/flex jobs to track readiness and gear status.
              </p>
              <Button onClick={addJobModal.open}>Add Main Job</Button>
            </motion.div>
          ) : (() => {
            const sorted = [...jobProfiles].sort((a, b) => {
              const order = { main: 0, preferred_alt: 1, flex: 2, emergency: 3, casual: 4 };
              return (order[a.priority as keyof typeof order] ?? 5) - (order[b.priority as keyof typeof order] ?? 5);
            });
            const mainJobs = sorted.filter((j) => j.priority === 'main');
            const preferredAlts = sorted.filter((j) => j.priority === 'preferred_alt');
            const others = sorted.filter((j) => !['main', 'preferred_alt'].includes(j.priority));

            const renderGroup = (label: string, jobs: typeof sorted) => jobs.length > 0 && (
              <motion.div {...staggerItemProps} className="space-y-2">
                <h3 className="text-xs text-text-tertiary uppercase tracking-wider font-medium">{label}</h3>
                {jobs.map((jp) => (
                  <JobProfileCard key={jp.id} jobProfile={jp} onEdit={setEditingJob} />
                ))}
              </motion.div>
            );

            return (
              <>
                {renderGroup('Main', mainJobs)}
                {renderGroup('Preferred Alts', preferredAlts)}
                {renderGroup('Flex / Emergency / Casual', others)}
                {!mainJobs.length && (
                  <motion.div {...staggerItemProps} className="text-sm text-status-warning bg-status-warning/10 rounded-lg px-4 py-3 border border-status-warning/20">
                    No main job selected. Add one or promote an existing job to Main.
                  </motion.div>
                )}
                <Button variant="secondary" onClick={addJobModal.open}>
                  Add Job
                </Button>
              </>
            );
          })()}
        </motion.div>
      )}

      {activeTab === 'collections' && (
        <CollectionsTab goals={goals} />
      )}

      {activeTab === 'goals' && (
        <GoalsTab goals={goals} />
      )}

      {activeTab === 'preview' && profile && (
        <PreviewShareTab profile={profile} gearSnapshots={gearSnapshots} />
      )}

      {/* Modals */}
      {linkModal.isOpen && <CharacterLinkModal onClose={linkModal.close} />}
      {addJobModal.isOpen && <JobProfileModal onClose={addJobModal.close} />}
      {editingJob && (
        <JobProfileModal
          existing={editingJob}
          onClose={() => setEditingJob(null)}
        />
      )}

      {/* Sticky mobile CTA for next setup step */}
      {nextStep && (
        <div className="fixed bottom-0 left-0 right-0 sm:hidden bg-surface-raised border-t border-border-default px-4 py-3 z-30">
          <Button className="w-full" onClick={nextStep.action}>
            {nextStep.label}
          </Button>
        </div>
      )}
    </div>
  );
}
