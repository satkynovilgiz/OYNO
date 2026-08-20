import type { CharacterEmotion, CharacterId } from '@/components/character/characterAssets';

export type GameIntroLine = {
  text: string;
  emotion: CharacterEmotion;
};

export type GameHostConfig = {
  characterId: CharacterId;
  lines: GameIntroLine[];
};

/**
 * One host character per game (spec Section 6). Dialogue lines are original
 * short copy in the same voice as the spec's given examples (Бөрү's чүкө
 * line and Айдана's "Бул оюнда стратегия маанилүү" are pulled verbatim from
 * the spec; the rest are new lines written to match, not sourced facts, so
 * feel free to revise wording later.
 */
export const gameHostCharacters: Record<string, GameHostConfig> = {
  'toguz-korgool': {
    characterId: 'bek',
    lines: [
      { text: 'Тогуз коргоолго кана баштайлы!', emotion: 'happy' },
      { text: 'Ойлонуп ойногон уттурбайт.', emotion: 'focused' },
    ],
  },
  'arkan-tartysh': {
    characterId: 'bek',
    lines: [
      { text: 'Күчүңдү сынап көрөлү!', emotion: 'happy' },
      { text: 'Биримдик менен күч — жеңиштин сыры ушул.', emotion: 'focused' },
    ],
  },
  'zhaa-atuu': {
    characterId: 'bek',
    lines: [
      { text: 'Жааны так тартып, көздөй атайлы!', emotion: 'focused' },
      { text: 'Дал төп тийгизе аласыңбы?', emotion: 'winking' },
    ],
  },
  ordo: {
    characterId: 'aidana',
    lines: [
      { text: 'Бул оюнда стратегия маанилүү.', emotion: 'focused' },
      { text: 'Чүкөлөрдү тыкыр эсептеп ойно.', emotion: 'thinking' },
    ],
  },
  'besh-tash': {
    characterId: 'aidana',
    lines: [
      { text: 'Беш ташты колдон түшүрбөй кармай аласыңбы?', emotion: 'surprised' },
      { text: 'Көңүл буруп, шашылба.', emotion: 'focused' },
    ],
  },
  chuko: {
    characterId: 'boru',
    lines: [
      { text: 'Кана, чүкө ойнойбузбу? 😄', emotion: 'laughing' },
      { text: 'Так ыргытып, жутуп ал!', emotion: 'happy' },
    ],
  },
  'zholuk-tashtamay': {
    characterId: 'boru',
    lines: [
      { text: 'Жоолукту токтоосуз кармап кал!', emotion: 'surprised' },
      { text: 'Кыймылың тез болсун!', emotion: 'happy' },
    ],
  },
  'cooking-world': {
    characterId: 'aiana',
    lines: [
      { text: 'Ашканага кош келдиң!', emotion: 'happy' },
      { text: 'Даамдуу тамак майда-чүйдөсүнө көңүл бурат.', emotion: 'focused' },
    ],
  },
  'beshbarmak-challenge': {
    characterId: 'aiana',
    lines: [
      { text: 'Бешбармак — коноктордун сыйы!', emotion: 'happy' },
      { text: 'Кайсы ингредиентти биринчи кошобуз?', emotion: 'thinking' },
    ],
  },
  'kyz-kuumay': {
    characterId: 'tulpar',
    lines: [
      { text: 'Атка минип, аны кубалап көр!', emotion: 'happy' },
      { text: 'Ылдамдык менен эптүүлүк керек.', emotion: 'focused' },
    ],
  },
  'ak-terek-kok-terek': {
    characterId: 'elchi',
    lines: [
      { text: 'Команданы тандап, оюнду баштайлы!', emotion: 'happy' },
      { text: 'Кимдин командасы күчтүү экенин көрөлү!', emotion: 'winking' },
    ],
  },
};

export function getGameHostConfig(gameId: string): GameHostConfig | null {
  return gameHostCharacters[gameId] ?? null;
}
