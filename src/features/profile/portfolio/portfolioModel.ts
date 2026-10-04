import { GLOSSARY } from '@/features/culture/glossary/glossaryData';
import type { StudyData } from '@/features/culture/glossary/study/glossaryStudy';
import type { ReadingData } from '@/features/culture/reading/readingModel';
import { TOPIC_QUIZZES, topicResultKey } from '@/features/challenges/topics/topicQuizzes';
import { GAME_RECORD_RULES } from '@/features/games/records/gameRecords';
import { LEARNING_PATHS, pathProgress, type LearningPath, type PathSignals } from '@/features/learn/learningPaths';
import type { OwnerRecords } from '@/store/useGameRecordsStore';
import type { ChallengeResult } from '@/store/useChallengeStore';

/**
 * My Learning Portfolio - a private SUMMARY derived from what OYNO already
 * records for the CURRENT owner. No new progress store, no XP, no rank,
 * no timeline. Dates are shown only where a real completion timestamp
 * exists for that very fact; otherwise none (never install date, never
 * "last viewed", never another record's createdAt).
 */

export type PortfolioPath = { id: string; titleKey: string; heroItemId: string | null; completed: number; total: number; done: boolean };
export type PortfolioQuiz = { id: string; titleKey: string; heroItemId: string; best: number; lastTotal: number; attempts: number };
export type PortfolioReading = { completed: number; inProgress: number; recentlyCompletedIds: string[] };
export type PortfolioGlossary = { studied: number; needsReview: number; gotIt: number };
export type PortfolioGame = {
  gameId: string;
  listId: string;
  /** All rounds recorded for this game on this device (official + practice). */
  rounds: number;
  /** Only for games whose rule HAS a numeric best (never Kok Boru). */
  best: number | null;
  bestRule: 'higher' | 'lower' | null;
  /** Official wins, only where a win means something for that game. */
  wins: number | null;
};
export type PortfolioAchievements = { pinned: string[]; earned: string[] };

export type Portfolio = {
  completedPaths: PortfolioPath[];
  activePaths: PortfolioPath[];
  quizzes: PortfolioQuiz[];
  reading: PortfolioReading | null;
  glossary: PortfolioGlossary | null;
  games: PortfolioGame[];
  achievements: PortfolioAchievements | null;
  isEmpty: boolean;
};

/** Where a "win" is a real outcome of the game (Jaa Atuu only scores). */
export const WIN_MEANINGFUL_GAMES = ['ordo', 'chuko', 'kyz_kuumai', 'kok_boru'] as const;
export const RECENT_READING_LIMIT = 3;

export type PortfolioInput = {
  signals: PathSignals;
  paths?: readonly LearningPath[];
  challengeResults: Record<string, ChallengeResult>;
  reading: ReadingData;
  /** Article still exists (stale references are skipped). */
  readingExists: (contentType: string, contentId: string) => boolean;
  study: StudyData;
  records: OwnerRecords;
  earnedAchievementIds: readonly string[];
  pinnedAchievementIds: readonly string[];
};

export function buildPortfolio(input: PortfolioInput): Portfolio {
  const paths = (input.paths ?? LEARNING_PATHS).map((path) => {
    const progress = pathProgress(path, input.signals);
    return { path, progress };
  });
  const toPath = ({ path, progress }: (typeof paths)[number]): PortfolioPath => ({ id: path.id, titleKey: path.titleKey, heroItemId: path.heroItemId, completed: progress.completed, total: progress.total, done: progress.done });
  const completedPaths = paths.filter(({ progress }) => progress.done).map(toPath);
  const activePaths = paths.filter(({ progress }) => progress.started && !progress.done).map(toPath);

  const quizzes: PortfolioQuiz[] = TOPIC_QUIZZES.flatMap((topic) => {
    const result = input.challengeResults[topicResultKey(topic.id)];
    if (!result?.completedAt || !(result.attempts > 0)) return [];
    return [{ id: topic.id, titleKey: topic.titleKey, heroItemId: topic.heroItemId, best: result.bestCorrect, lastTotal: result.lastTotal, attempts: result.attempts }];
  });

  const records = Object.values(input.reading).filter((record) => input.readingExists(record.contentType, record.contentId));
  const completedReading = records.filter((record) => !!record.completedAt).sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '') || a.contentId.localeCompare(b.contentId));
  const inProgress = records.filter((record) => !record.completedAt).length;
  const reading = records.length > 0 ? { completed: completedReading.length, inProgress, recentlyCompletedIds: completedReading.filter((record) => record.contentType === 'culture_item').slice(0, RECENT_READING_LIMIT).map((record) => record.contentId) } : null;

  const glossaryIds = new Set(GLOSSARY.map((entry) => entry.id));
  const studied = Object.values(input.study).filter((record) => glossaryIds.has(record.glossaryEntryId));
  const glossary = studied.length > 0 ? { studied: studied.length, needsReview: studied.filter((record) => record.needsReview).length, gotIt: studied.filter((record) => !record.needsReview && record.gotItCount > 0).length } : null;

  const games: PortfolioGame[] = Object.values(GAME_RECORD_RULES).flatMap((rule) => {
    const rounds = input.records.sessions[rule.gameId] ?? 0;
    if (rounds === 0) return [];
    const numeric = rule.best === 'higher' || rule.best === 'lower';
    const best = numeric ? (input.records.best[rule.gameId] ?? null) : null;
    return [{
      gameId: rule.gameId,
      listId: rule.listId,
      rounds,
      best: best !== null && Number.isFinite(best) ? best : null,
      bestRule: numeric ? (rule.best as 'higher' | 'lower') : null,
      wins: (WIN_MEANINGFUL_GAMES as readonly string[]).includes(rule.gameId) ? (input.records.wins[rule.gameId] ?? 0) : null,
    }];
  });

  const earned = [...new Set(input.earnedAchievementIds)];
  const pinned = input.pinnedAchievementIds.filter((id) => earned.includes(id));
  const achievements = earned.length > 0 ? { pinned, earned: [...pinned, ...earned.filter((id) => !pinned.includes(id))] } : null;

  const isEmpty = completedPaths.length === 0 && activePaths.length === 0 && quizzes.length === 0 && !reading && !glossary && games.length === 0 && !achievements;
  return { completedPaths, activePaths, quizzes, reading, glossary, games, achievements, isEmpty };
}

// ---------------------------------------------------------------------
// Share summary - only categories the person switched on; never Journal,
// notes, highlights, mistakes, reading/listening positions or identity.
// ---------------------------------------------------------------------
export const SHAREABLE_CATEGORIES = ['paths', 'quizzes', 'achievements', 'games'] as const;
export type ShareCategory = (typeof SHAREABLE_CATEGORIES)[number];
export const DEFAULT_SHARE: Record<ShareCategory, boolean> = { paths: true, quizzes: true, achievements: true, games: true };

export type PortfolioShare = { lines: { key: ShareCategory; count: number }[]; featured: { kind: 'path' | 'quiz'; titleKey: string }[] };

export function portfolioShare(portfolio: Portfolio, include: Record<ShareCategory, boolean>): PortfolioShare {
  const lines: PortfolioShare['lines'] = [];
  if (include.paths && portfolio.completedPaths.length) lines.push({ key: 'paths', count: portfolio.completedPaths.length });
  if (include.quizzes && portfolio.quizzes.length) lines.push({ key: 'quizzes', count: portfolio.quizzes.length });
  if (include.achievements && portfolio.achievements) lines.push({ key: 'achievements', count: portfolio.achievements.earned.length });
  if (include.games && portfolio.games.length) lines.push({ key: 'games', count: portfolio.games.length });
  const featured = [
    ...(include.paths ? portfolio.completedPaths.map((path) => ({ kind: 'path' as const, titleKey: path.titleKey })) : []),
    ...(include.quizzes ? portfolio.quizzes.map((quiz) => ({ kind: 'quiz' as const, titleKey: quiz.titleKey })) : []),
  ].slice(0, 3);
  return { lines, featured };
}

/** "Boz Üy Learning Path. Completed. 5 of 5 steps." */
export function pathA11yLabel(title: string, path: PortfolioPath, words: { learningPath: string; completed: string; inProgress: string; steps: (done: number, total: number) => string }): string {
  return `${title} ${words.learningPath}. ${path.done ? words.completed : words.inProgress}. ${words.steps(path.completed, path.total)}.`;
}
