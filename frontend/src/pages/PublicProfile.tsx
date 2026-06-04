import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Badge } from '../components/primitives/Badge';
import { Button } from '../components/primitives/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { JobIcon } from '../components/ui/JobIcon';
import { PriorityBadge } from '../components/profile/PriorityBadge';
import { ReadinessBadge } from '../components/profile/ReadinessBadge';
import type { PublicPlayerProfile } from '../stores/playerProfileStore';
import { usePlayerProfileStore } from '../stores/playerProfileStore';
import { getJobDisplayName } from '../gamedata/jobs';
import { fadeInProps, staggerContainerProps, staggerItemProps } from '../lib/motion';

export default function PublicProfile() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const fetchPublicProfile = usePlayerProfileStore((s) => s.fetchPublicProfile);
  const [profile, setProfile] = useState<PublicPlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (code: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPublicProfile(code);
      setProfile(data);
    } catch {
      setError('Profile not found or not available.');
    } finally {
      setLoading(false);
    }
  }, [fetchPublicProfile]);

  useEffect(() => {
    if (shareCode) {
      loadProfile(shareCode);
    }
  }, [shareCode, loadProfile]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Skeleton className="h-6 w-32 mb-6" />
        <Skeleton className="h-32 mb-4 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-surface-raised rounded-lg border border-border-default p-8">
          <div className="text-3xl mb-3 text-text-tertiary">&#128274;</div>
          <h2 className="text-xl font-display font-bold text-text-primary mb-2">Profile Not Available</h2>
          <p className="text-text-secondary text-sm max-w-md mx-auto">
            This profile is private, the share link has been revoked, or the player has disabled sharing.
          </p>
          <Button variant="secondary" size="sm" onClick={() => window.history.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const characters = profile.characters;
  const jobProfiles = profile.jobProfiles;
  const mainCharacter = characters.find((c) => c.isMain) ?? characters[0];
  const mainJob = jobProfiles.find((j) => j.priority === 'main');
  const altJobs = jobProfiles
    .filter((j) => j.priority !== 'main')
    .sort((a, b) => {
      const order = { preferred_alt: 0, flex: 1, emergency: 2, casual: 3 };
      return (order[a.priority as keyof typeof order] ?? 4) - (order[b.priority as keyof typeof order] ?? 4);
    });

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header badge */}
      <motion.div {...fadeInProps} className="flex items-center gap-2 mb-4">
        <Badge variant="info" size="sm">XIV Raid Planner</Badge>
        <span className="text-xs text-text-tertiary">Shared Player Profile</span>
      </motion.div>

      <motion.div {...staggerContainerProps} className="space-y-4">
        {/* Character hero */}
        <motion.div {...staggerItemProps} className="bg-surface-raised rounded-lg border border-border-default p-6">
          {mainCharacter ? (
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-lg overflow-hidden bg-surface-elevated flex-shrink-0 border border-border-default">
                {mainCharacter.avatarUrl ? (
                  <img src={mainCharacter.avatarUrl} alt={mainCharacter.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl text-text-tertiary">?</div>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold text-text-primary">{mainCharacter.name}</h1>
                <div className="text-text-secondary mt-0.5">
                  {mainCharacter.server}
                  {mainCharacter.dataCenter && <span className="text-text-tertiary"> [{mainCharacter.dataCenter}]</span>}
                </div>
                {mainJob && (
                  <div className="flex items-center gap-2 mt-2">
                    <JobIcon job={mainJob.job} size="md" />
                    <span className="font-display font-semibold text-text-primary">{getJobDisplayName(mainJob.job)}</span>
                    <ReadinessBadge readiness={mainJob.readiness} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-text-tertiary text-center py-4">No character information available.</p>
          )}

          {profile.bio && (
            <p className="mt-4 pt-4 border-t border-border-default text-sm text-text-secondary">{profile.bio}</p>
          )}
        </motion.div>

        {/* Jobs section */}
        {altJobs.length > 0 && (
          <motion.div {...staggerItemProps} className="bg-surface-raised rounded-lg border border-border-default p-5">
            <h2 className="text-xs text-text-tertiary uppercase tracking-wider mb-3">Other Jobs</h2>
            <div className="space-y-2.5">
              {altJobs.map((jp) => (
                <div key={jp.id} className="flex items-center gap-3">
                  <JobIcon job={jp.job} size="md" />
                  <span className="text-text-primary text-sm font-medium min-w-0">{getJobDisplayName(jp.job)}</span>
                  <PriorityBadge priority={jp.priority} />
                  <ReadinessBadge readiness={jp.readiness} />
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* No jobs at all */}
        {jobProfiles.length === 0 && (
          <motion.div {...staggerItemProps} className="bg-surface-raised rounded-lg border border-border-default p-5 text-center">
            <p className="text-text-tertiary text-sm">This player has not configured any job profiles yet.</p>
          </motion.div>
        )}

        {/* Footer */}
        <motion.div {...staggerItemProps} className="text-center pt-2">
          <p className="text-xs text-text-tertiary">
            Profile shared via XIV Raid Planner
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
