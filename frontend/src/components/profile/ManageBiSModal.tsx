import { BiSTargetManagerModal } from '../bis/BiSTargetManagerModal';

interface ManageBiSModalProps {
  jobProfileId: string;
  job: string;
  onClose: () => void;
}

export function ManageBiSModal({ jobProfileId, job, onClose }: ManageBiSModalProps) {
  return (
    <BiSTargetManagerModal
      ownerType="player_job_profile"
      ownerId={jobProfileId}
      job={job}
      canEdit={true}
      onClose={onClose}
    />
  );
}
