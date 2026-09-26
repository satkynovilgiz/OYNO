import { CHARACTERS_WITH_FULL_SHEET, type CharacterEmotion, type CharacterId } from '@/components/character/characterAssets';
import type { AgeExperience } from '@/services/ageExperience/types';

/** The default guide when a stored id is missing, invalid, or points at a
 * character without complete art (never a "Coming soon" placeholder). */
export const DEFAULT_COMPANION: CharacterId = 'bek';

export function resolveCompanion(id: string | null | undefined): CharacterId {
  return id && (CHARACTERS_WITH_FULL_SHEET as string[]).includes(id) ? (id as CharacterId) : DEFAULT_COMPANION;
}

/** Deterministic emotion per moment - never random. */
export type CompanionMomentType = 'intro' | 'hint' | 'challenge' | 'discovery' | 'completion' | 'encouragement' | 'empty';

const EMOTION_BY_MOMENT: Record<CompanionMomentType, CharacterEmotion> = {
  intro: 'happy',
  hint: 'thinking',
  challenge: 'focused',
  discovery: 'surprised',
  completion: 'happy',
  encouragement: 'winking',
  empty: 'thinking',
};

export function emotionFor(moment: CompanionMomentType): CharacterEmotion {
  return EMOTION_BY_MOMENT[moment];
}

/**
 * Where the companion may speak, and the authored line for each moment
 * (`companion.lines.<key>` in every locale). Lines are fixed copy - never
 * generated, never a comment on the player's intelligence, never shaming.
 */
export const COMPANION_LINES = {
  daily: { intro: 'daily.intro', completion: 'daily.outro' },
  trail: { intro: 'trail.start', completion: 'trail.complete' },
  challenge: { challenge: 'challenge.start', completion: 'challenge.resultStrong', encouragement: 'challenge.resultKeepGoing' },
  journey: { empty: 'journey.start', discovery: 'journey.progress' },
  achievement: { completion: 'achievement.unlocked' },
  emptySaved: { empty: 'empty.saved' },
  emptyJournal: { empty: 'empty.journal' },
  emptyQuests: { empty: 'empty.quests' },
} as const satisfies Record<string, Partial<Record<CompanionMomentType, string>>>;

export type CompanionSurface = keyof typeof COMPANION_LINES | 'quest';

export function companionLineKey(surface: keyof typeof COMPANION_LINES, moment: CompanionMomentType): string | null {
  const line = (COMPANION_LINES[surface] as Partial<Record<CompanionMomentType, string>>)[moment];
  return line ? `companion.lines.${line}` : null;
}

/**
 * Age-based presence. Younger players get their guide on every story
 * moment; teens on the main moments; adults only where the guide carries
 * the story (quests) or helps an empty screen - the rest of their UI stays
 * editorial.
 */
const SURFACES_BY_EXPERIENCE: Record<AgeExperience, ReadonlySet<CompanionSurface>> = {
  child: new Set<CompanionSurface>(['quest', 'daily', 'trail', 'challenge', 'journey', 'achievement', 'emptySaved', 'emptyJournal', 'emptyQuests']),
  preteen: new Set<CompanionSurface>(['quest', 'daily', 'trail', 'challenge', 'journey', 'achievement', 'emptySaved', 'emptyJournal', 'emptyQuests']),
  teen: new Set<CompanionSurface>(['quest', 'daily', 'trail', 'challenge', 'journey', 'emptySaved', 'emptyJournal', 'emptyQuests']),
  adult: new Set<CompanionSurface>(['quest', 'emptySaved', 'emptyJournal', 'emptyQuests']),
};

export function companionVisible(experience: AgeExperience, surface: CompanionSurface): boolean {
  return SURFACES_BY_EXPERIENCE[experience].has(surface);
}
