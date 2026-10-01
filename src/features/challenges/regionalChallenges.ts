import { getRegionExperience, type RegionExperienceConfig } from '@/features/explore/regions/regionExperiences';

import { getQuestion, QUESTIONS_WITH_CLAIMS_UNDER_REVIEW, type ChallengeQuestion } from './questionBank';

/**
 * Regional Challenges - one knowledge challenge per Region Hub, run by the
 * existing challenge engine. A pack is only what the region config lists,
 * and each question must (1) exist, (2) be sourced from content linked to
 * THAT region, and (3) not rest on a claim still under review. A region
 * with fewer than MIN valid questions simply has no challenge.
 */
export const MIN_REGIONAL_QUESTIONS = 3;

const PREFIX = 'region-';

export function regionalChallengeId(regionId: string): string {
  return `${PREFIX}${regionId}`;
}

/** Results key in useChallengeStore / user_challenge_results. */
export function regionalResultKey(regionId: string): string {
  return `region:${regionId}`;
}

/** Why a listed question can't be used (null = usable). */
export function regionalQuestionProblem(config: RegionExperienceConfig, questionId: string): string | null {
  const question: ChallengeQuestion | undefined = getQuestion(questionId);
  if (!question) return `${questionId}: not in the question bank`;
  const linked = question.sourceType === 'destination' ? config.destinationIds : question.sourceType === 'culture_material' ? config.materialIds : config.cultureItemIds;
  if (!linked.includes(question.sourceId)) return `${questionId}: source ${question.sourceId} is not linked to ${config.id}`;
  if (QUESTIONS_WITH_CLAIMS_UNDER_REVIEW.has(questionId)) return `${questionId}: rests on a claim under review`;
  return null;
}

/** The usable questions of a region's pack, or [] below the minimum. */
export function regionalChallengeQuestionIds(config: RegionExperienceConfig | null): string[] {
  if (!config?.challengeQuestionIds) return [];
  const ids = [...new Set(config.challengeQuestionIds)].filter((id) => regionalQuestionProblem(config, id) === null);
  return ids.length >= MIN_REGIONAL_QUESTIONS ? ids : [];
}

/** The region a `region-<id>` challenge id belongs to, when it has a pack. */
export function regionForChallengeId(challengeId: string, configs?: readonly RegionExperienceConfig[]): RegionExperienceConfig | null {
  if (!challengeId.startsWith(PREFIX)) return null;
  const regionId = challengeId.slice(PREFIX.length);
  const config = configs ? (configs.find((candidate) => candidate.id === regionId) ?? null) : getRegionExperience(regionId);
  return regionalChallengeQuestionIds(config).length > 0 ? config : null;
}
