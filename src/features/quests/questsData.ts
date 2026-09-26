import type { ImageSourcePropType } from 'react-native';

import type { CharacterId } from '@/components/character/characterAssets';
import { cultureCategoryImages } from '@/features/culture/data';
import { routeForInteractiveExperience } from '@/features/culture/interactiveExperiences';
import { natureSiteImages } from '@/features/explore/data';
import { gameArt } from '@/features/games/gamesCatalog';
import { mockGamesList } from '@/features/games/mockData';
import { progressGameIdFor } from '@/features/games/progressGameIds';
import type { LocalizedText } from '@/features/explore/types';

/**
 * Guided Quests - short themed adventures (3-4 steps) that connect real
 * OYNO experiences. Quest = one small adventure; Journey = the long-term
 * record. Every step completes ONLY from a signal the app already records
 * (a game played, a place visited, a lab finished, a challenge completed) -
 * opening a screen never counts. The same requirements are stored
 * server-side (supabase/migrations/20260927000004_guided_quests.sql) so the
 * reward is verified and granted once; a test keeps the two in sync.
 */
export type QuestStepType = 'play_game' | 'explore_destination' | 'complete_interactive' | 'complete_challenge';

export type QuestStep = {
  type: QuestStepType;
  /** App id: game list id, destination id, interactive experience id, or
   * challenge result key ('collection:<id>' | 'journey'). */
  targetId: string;
  instruction: LocalizedText;
  /** Child-friendly short version. */
  short: LocalizedText;
};

export type GuidedQuest = {
  id: string;
  /** One of the companions with complete character art. */
  guide: CharacterId;
  title: LocalizedText;
  theme: LocalizedText;
  intro: LocalizedText;
  completion: LocalizedText;
  heroImage: ImageSourcePropType | null;
  steps: QuestStep[];
  /** Existing economy only (server grants it once). */
  reward: { xp: number; coins: number };
};

const REWARD = { xp: 80, coins: 40 };
const game = (id: string) => mockGamesList.find((entry) => entry.id === id);

export const GUIDED_QUESTS: GuidedQuest[] = [
  {
    id: 'inside-boz-uy',
    guide: 'aidana',
    title: { kg: 'Боз үйдүн ичинде', ru: 'Внутри боз үй', en: 'Inside the Boz Üy' },
    theme: { kg: 'Көчмөн үй', ru: 'Кочевой дом', en: 'The nomad home' },
    intro: {
      kg: 'Боз үйдү өз колуң менен кур, анын ичин кооздогон шырдакты жаса, анан билимиңди сына.',
      ru: 'Собери боз үй своими руками, сделай шырдак, который украшает его изнутри, а затем проверь себя.',
      en: 'Put a boz üy together yourself, make a shyrdak like the ones that furnish it, then test what you learned.',
    },
    completion: {
      kg: 'Кереге, уук, түндүк - эми боз үйдү ичинен билесиң.',
      ru: 'Кереге, уук, түндүк - теперь ты знаешь боз үй изнутри.',
      en: 'Kerege, uuk, tunduk - now you know the boz üy from the inside.',
    },
    heroImage: cultureCategoryImages['boz-uy'],
    steps: [
      { type: 'complete_interactive', targetId: 'boz-uy', instruction: { kg: 'Боз үйдү баштан аяк кур', ru: 'Собери боз үй от начала до конца', en: 'Build a boz üy from start to finish' }, short: { kg: 'Боз үй кур', ru: 'Собери боз үй', en: 'Build a boz üy' } },
      { type: 'complete_interactive', targetId: 'shyrdak', instruction: { kg: 'Өзүңдүн шырдагыңды жаса', ru: 'Создай свой шырдак', en: 'Make your own shyrdak' }, short: { kg: 'Шырдак жаса', ru: 'Сделай шырдак', en: 'Make a shyrdak' } },
      { type: 'complete_challenge', targetId: 'collection:boz-uy-world', instruction: { kg: '«Боз үйдүн дүйнөсү» сынагынан өт', ru: 'Пройди испытание «Мир юрты»', en: 'Complete the “The World of the Boz Uy” challenge' }, short: { kg: 'Сынактан өт', ru: 'Пройди испытание', en: 'Take the challenge' } },
    ],
    reward: REWARD,
  },
  {
    id: 'craft-and-ornament',
    guide: 'aiana',
    title: { kg: 'Өнөр жана оюм', ru: 'Ремесло и орнамент', en: 'Craft & Ornament' },
    theme: { kg: 'Колдонмо өнөр', ru: 'Прикладное искусство', en: 'Kyrgyz craft' },
    intro: {
      kg: 'Оймо чийип, аны шырдакка айландыр - анан кыргыз оюмдары жөнүндө билгениңди сына.',
      ru: 'Нарисуй оймо, преврати узор в шырдак - и проверь свои знания о кыргызском орнаменте.',
      en: 'Draw an oymo, turn a pattern into a shyrdak, then check what you learned about Kyrgyz ornament.',
    },
    completion: {
      kg: 'Оюмду чийдиң, шырдакты жасадың - колуңдан өнөр чыгат!',
      ru: 'Оймо нарисован, шырдак готов - настоящая работа мастера!',
      en: 'You drew an oymo and made a shyrdak - a craftsperson’s work!',
    },
    heroImage: cultureCategoryImages.oymo,
    steps: [
      { type: 'complete_interactive', targetId: 'oymo', instruction: { kg: 'Өзүңдүн оймоңду түзүп сакта', ru: 'Создай и сохрани свой оймо', en: 'Create and save your own oymo' }, short: { kg: 'Оймо түз', ru: 'Создай оймо', en: 'Create an oymo' } },
      { type: 'complete_interactive', targetId: 'shyrdak', instruction: { kg: 'Шырдак жасап сакта', ru: 'Создай и сохрани шырдак', en: 'Create and save a shyrdak' }, short: { kg: 'Шырдак жаса', ru: 'Сделай шырдак', en: 'Make a shyrdak' } },
      { type: 'complete_challenge', targetId: 'collection:kyrgyz-ornament', instruction: { kg: '«Кыргыз оймо-чиймдери» сынагынан өт', ru: 'Пройди испытание «Кыргызский орнамент»', en: 'Complete the “Kyrgyz Ornament” challenge' }, short: { kg: 'Сынактан өт', ru: 'Пройди испытание', en: 'Take the challenge' } },
    ],
    reward: REWARD,
  },
  {
    id: 'horse-games',
    guide: 'bek',
    title: { kg: 'Ат оюндары', ru: 'Конные игры', en: 'Horse Games' },
    theme: { kg: 'Ат маданияты', ru: 'Конная культура', en: 'Horse culture' },
    intro: {
      kg: 'Көк бөрү менен Кыз куумайды ойноп көр, анан ат маданияты боюнча сынактан өт.',
      ru: 'Сыграй в кок бору и кыз куумай, а потом пройди испытание о конной культуре.',
      en: 'Play Kok Boru and Kyz Kuumai, then take the horse culture challenge.',
    },
    completion: {
      kg: 'Ээрде бекем отурдуң - азаматсың!',
      ru: 'Отличная езда - так держать!',
      en: 'You stayed firm in the saddle - well ridden!',
    },
    heroImage: game('kok-boru') ? gameArt(game('kok-boru')!, 'large') : null,
    steps: [
      { type: 'play_game', targetId: 'kok-boru', instruction: { kg: 'Көк бөрүнү бир жолу ойно', ru: 'Сыграй один раз в кок бору', en: 'Play one round of Kok Boru' }, short: { kg: 'Көк бөрү ойно', ru: 'Сыграй в кок бору', en: 'Play Kok Boru' } },
      { type: 'play_game', targetId: 'kyz-kuumay', instruction: { kg: 'Кыз куумайды бир жолу ойно', ru: 'Сыграй один раз в кыз куумай', en: 'Play one round of Kyz Kuumai' }, short: { kg: 'Кыз куумай ойно', ru: 'Сыграй в кыз куумай', en: 'Play Kyz Kuumai' } },
      { type: 'complete_challenge', targetId: 'collection:horse-culture', instruction: { kg: '«Ат жана кыргыз маданияты» сынагынан өт', ru: 'Пройди испытание «Конная культура кыргызов»', en: 'Complete the “Horse Culture” challenge' }, short: { kg: 'Сынактан өт', ru: 'Пройди испытание', en: 'Take the challenge' } },
    ],
    reward: REWARD,
  },
  {
    id: 'mountain-journey',
    guide: 'aidana',
    title: { kg: 'Тоолор аркылуу саякат', ru: 'Путешествие по горам', en: 'Journey through the Mountains' },
    theme: { kg: 'Табият', ru: 'Природа', en: 'Nature' },
    intro: {
      kg: 'Үч жерди картадан ачып, ар биринин баракчасын оку, анан саякат сынагынан өт.',
      ru: 'Открой три места на карте, прочитай о каждом, а потом пройди испытание путешествия.',
      en: 'Visit three places on the map, read about each one, then take your journey challenge.',
    },
    completion: {
      kg: 'Соң-Көлдөн Сары-Челекке чейин - жолуң узун болсун!',
      ru: 'От Сон-Куля до Сары-Челека - доброго пути!',
      en: 'From Son-Köl to Sary-Chelek - a journey well travelled!',
    },
    heroImage: natureSiteImages['son-kol'] ?? null,
    steps: [
      { type: 'explore_destination', targetId: 'son-kol', instruction: { kg: 'Соң-Көлдү ач', ru: 'Открой Сон-Куль', en: 'Visit Son-Köl' }, short: { kg: 'Соң-Көл', ru: 'Сон-Куль', en: 'Son-Köl' } },
      { type: 'explore_destination', targetId: 'suusamyr', instruction: { kg: 'Суусамырды ач', ru: 'Открой Суусамыр', en: 'Visit Suusamyr' }, short: { kg: 'Суусамыр', ru: 'Суусамыр', en: 'Suusamyr' } },
      { type: 'explore_destination', targetId: 'sary-chelek', instruction: { kg: 'Сары-Челекти ач', ru: 'Открой Сары-Челек', en: 'Visit Sary-Chelek' }, short: { kg: 'Сары-Челек', ru: 'Сары-Челек', en: 'Sary-Chelek' } },
      { type: 'complete_challenge', targetId: 'journey', instruction: { kg: 'Саякат сынагынан өт', ru: 'Пройди испытание путешествия', en: 'Complete your journey challenge' }, short: { kg: 'Сынактан өт', ru: 'Пройди испытание', en: 'Take the challenge' } },
    ],
    reward: REWARD,
  },
];

export function getGuidedQuest(id: string): GuidedQuest | undefined {
  return GUIDED_QUESTS.find((quest) => quest.id === id);
}

/** The real screen a step opens - never a quest-specific copy of content. */
export function questStepRoute(step: QuestStep): string | null {
  switch (step.type) {
    case 'explore_destination':
      return `/explore/${step.targetId}`;
    case 'play_game':
      return game(step.targetId)?.route ?? null;
    case 'complete_interactive':
      return routeForInteractiveExperience(step.targetId);
    case 'complete_challenge':
      return step.targetId === 'journey' ? '/challenges/journey' : step.targetId.startsWith('collection:') ? `/challenges/collection-${step.targetId.slice('collection:'.length)}` : null;
  }
}

/** The id the server stores for this step (games record snake_case ids). */
export function serverTargetId(step: QuestStep): string {
  return step.type === 'play_game' ? progressGameIdFor(step.targetId) : step.targetId;
}
