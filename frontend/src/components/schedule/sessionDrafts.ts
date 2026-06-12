import { getCurrencyLabelPlural, getRewardNoun, getTrialById, MOUNT_FARM_TRIALS, type MountFarmTrial } from '../../gamedata';
import type { EventCategory, ScheduleSessionCreate } from '../../types';
import type { ContentType } from '../../gamedata/mount-farms';

export interface ScheduleContentDraftRequest {
  trialName: string;
  trialId?: string;
  contentType?: ContentType;
  category?: EventCategory;
  missing?: number;
  canBuy?: number;
  wanting?: number;
}

function findTrial(request: ScheduleContentDraftRequest): MountFarmTrial | undefined {
  if (request.trialId) {
    const trial = getTrialById(request.trialId);
    if (trial) return trial;
  }

  return MOUNT_FARM_TRIALS.find((trial) => trial.dutyName === request.trialName);
}

function categoryForContent(
  trial: MountFarmTrial | undefined,
  requestedContentType: ContentType | undefined,
  requestedCategory: EventCategory | undefined,
): EventCategory {
  if (requestedCategory && requestedCategory !== 'farm') return requestedCategory;

  const contentType = requestedContentType ?? trial?.contentType;
  switch (contentType) {
    case 'ultimate':
      return 'ultimate';
    case 'raid':
      return 'raid';
    case 'extreme_trial':
    case 'collaboration':
      return 'farm';
    default:
      return requestedCategory ?? 'other';
  }
}

function buildFarmDescription(
  trialName: string,
  trial: MountFarmTrial | undefined,
  request: ScheduleContentDraftRequest,
): string {
  const rewardNoun = trial ? getRewardNoun(trial) : 'reward';
  const currencyLabel = trial ? getCurrencyLabelPlural(trial) : 'exchange currency';
  const lines = [`Mount farm for ${trialName}.`];

  if (request.missing) {
    lines.push(`${request.missing} member${request.missing > 1 ? 's' : ''} still need${request.missing === 1 ? 's' : ''} this ${rewardNoun}.`);
  }
  if (request.canBuy) {
    lines.push(`${request.canBuy} can buy with ${currencyLabel}.`);
  }
  if (request.wanting && request.wanting !== request.missing) {
    lines.push(`${request.wanting} marked as wanted.`);
  }
  lines.push('Check Availability tab for best time slots.');

  return lines.join(' ');
}

export function buildScheduleDraftFromContent(
  request: ScheduleContentDraftRequest,
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): ScheduleSessionCreate {
  const trial = findTrial(request);
  const trialName = trial?.dutyName ?? request.trialName;
  const category = categoryForContent(trial, request.contentType, request.category);

  if (category === 'farm') {
    return {
      title: `Mount Farm: ${trialName}`,
      description: buildFarmDescription(trialName, trial, request),
      startTime: '',
      endTime: '',
      timezone,
      isRecurring: false,
      recurrenceRule: null,
      trackAvailability: true,
      category,
      contentId: trial?.id ?? null,
      contentName: trialName,
    };
  }

  return {
    title: trialName,
    description: `Session for ${trialName}.`,
    startTime: '',
    endTime: '',
    timezone,
    isRecurring: false,
    recurrenceRule: null,
    trackAvailability: true,
    category,
    contentId: trial?.id ?? null,
    contentName: trialName,
  };
}
