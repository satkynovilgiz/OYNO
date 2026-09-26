import type { CharacterEmotion, CharacterId } from '@/components/character/characterAssets';
import { resolveCompanion } from '@/components/companion/companionModel';
import type { LocalizedText } from '@/features/explore/types';

export type GameIntroLine = {
  text: LocalizedText;
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
 * feel free to revise wording later. `text` is per-language content (the
 * same `LocalizedText` shape used for Explore/Culture discovery titles),
 * not an i18n UI key - resolved the same way at the call site:
 * `line.text[language] ?? line.text.kg`.
 */
export const gameHostCharacters: Record<string, GameHostConfig> = {
  'toguz-korgool': {
    characterId: 'bek',
    lines: [
      {
        text: {
          kg: 'Тогуз коргоолго кана баштайлы!',
          ru: 'Давай начнём партию в тогуз коргоол!',
          en: "Let's start a game of Toguz Korgool!",
        },
        emotion: 'happy',
      },
      {
        text: {
          kg: 'Ойлонуп ойногон уттурбайт.',
          ru: 'Кто играет с умом, тот не проигрывает.',
          en: 'Play with your head, and you won’t lose.',
        },
        emotion: 'focused',
      },
    ],
  },
  'arkan-tartysh': {
    characterId: 'bek',
    lines: [
      {
        text: {
          kg: 'Күчүңдү сынап көрөлү!',
          ru: 'Давай проверим твою силу!',
          en: "Let's test your strength!",
        },
        emotion: 'happy',
      },
      {
        text: {
          kg: 'Биримдик менен күч — жеңиштин сыры ушул.',
          ru: 'Сила в единстве — вот секрет победы.',
          en: 'Strength in unity - that’s the secret to winning.',
        },
        emotion: 'focused',
      },
    ],
  },
  'zhaa-atuu': {
    characterId: 'bek',
    lines: [
      {
        text: {
          kg: 'Жааны так тартып, көздөй атайлы!',
          ru: 'Натяни лук точно и цель на мишень!',
          en: "Draw the bow steady and aim true!",
        },
        emotion: 'focused',
      },
      {
        text: {
          kg: 'Дал төп тийгизе аласыңбы?',
          ru: 'Сможешь попасть точно в цель?',
          en: 'Think you can hit the bullseye?',
        },
        emotion: 'winking',
      },
    ],
  },
  ordo: {
    characterId: 'aidana',
    lines: [
      {
        text: {
          kg: 'Бул оюнда стратегия маанилүү.',
          ru: 'В этой игре важна стратегия.',
          en: 'Strategy matters in this game.',
        },
        emotion: 'focused',
      },
      {
        text: {
          kg: 'Чүкөлөрдү тыкыр эсептеп ойно.',
          ru: 'Считай ходы с чүкө внимательно.',
          en: 'Count your shots carefully.',
        },
        emotion: 'thinking',
      },
    ],
  },
  'besh-tash': {
    characterId: 'aidana',
    lines: [
      {
        text: {
          kg: 'Беш ташты колдон түшүрбөй кармай аласыңбы?',
          ru: 'Сможешь удержать все пять камешков, не уронив?',
          en: 'Can you keep all five stones from falling?',
        },
        emotion: 'surprised',
      },
      {
        text: {
          kg: 'Көңүл буруп, шашылба.',
          ru: 'Будь внимателен и не торопись.',
          en: 'Stay focused, and don’t rush.',
        },
        emotion: 'focused',
      },
    ],
  },
  chuko: {
    characterId: 'boru',
    lines: [
      {
        text: {
          kg: 'Кана, чүкө ойнойбузбу? 😄',
          ru: 'Ну что, сыграем в чүкө? 😄',
          en: 'So, shall we play chuko? 😄',
        },
        emotion: 'laughing',
      },
      {
        text: {
          kg: 'Так ыргытып, жутуп ал!',
          ru: 'Точно подбрось и поймай!',
          en: 'Toss it just right and grab it!',
        },
        emotion: 'happy',
      },
    ],
  },
  'zholuk-tashtamay': {
    characterId: 'boru',
    lines: [
      {
        text: {
          kg: 'Жоолукту токтоосуз кармап кал!',
          ru: 'Хватай платок без промедления!',
          en: 'Grab the handkerchief without hesitating!',
        },
        emotion: 'surprised',
      },
      {
        text: {
          kg: 'Кыймылың тез болсун!',
          ru: 'Двигайся быстрее!',
          en: 'Move fast!',
        },
        emotion: 'happy',
      },
    ],
  },
  'cooking-world': {
    characterId: 'aiana',
    lines: [
      {
        text: {
          kg: 'Ашканага кош келдиң!',
          ru: 'Добро пожаловать на кухню!',
          en: 'Welcome to the kitchen!',
        },
        emotion: 'happy',
      },
      {
        text: {
          kg: 'Даамдуу тамак майда-чүйдөсүнө көңүл бурат.',
          ru: 'Вкусная еда любит внимание к деталям.',
          en: 'Tasty food is all about the details.',
        },
        emotion: 'focused',
      },
    ],
  },
  'beshbarmak-challenge': {
    characterId: 'aiana',
    lines: [
      {
        text: {
          kg: 'Бешбармак — коноктордун сыйы!',
          ru: 'Бешбармак — угощение для гостей!',
          en: 'Beshbarmak - a dish fit for guests!',
        },
        emotion: 'happy',
      },
      {
        text: {
          kg: 'Кайсы ингредиентти биринчи кошобуз?',
          ru: 'Какой ингредиент добавим первым?',
          en: 'Which ingredient goes in first?',
        },
        emotion: 'thinking',
      },
    ],
  },
  'kyz-kuumay': {
    characterId: 'tulpar',
    lines: [
      {
        text: {
          kg: 'Атка минип, аны кубалап көр!',
          ru: 'Садись на коня и догони её!',
          en: 'Get on your horse and catch her!',
        },
        emotion: 'happy',
      },
      {
        text: {
          kg: 'Ылдамдык менен эптүүлүк керек.',
          ru: 'Нужны скорость и ловкость.',
          en: 'You’ll need speed and skill.',
        },
        emotion: 'focused',
      },
    ],
  },
  'ak-terek-kok-terek': {
    characterId: 'elchi',
    lines: [
      {
        text: {
          kg: 'Команданы тандап, оюнду баштайлы!',
          ru: 'Выбери команду, и начнём игру!',
          en: "Pick a team, and let's begin!",
        },
        emotion: 'happy',
      },
      {
        text: {
          kg: 'Кимдин командасы күчтүү экенин көрөлү!',
          ru: 'Посмотрим, чья команда сильнее!',
          en: "Let's see whose team is stronger!",
        },
        emotion: 'winking',
      },
    ],
  },
};

/** A host without complete art (Бөрү, Тулпар, Элчи - not released yet) is
 * presented by the default companion instead of a placeholder; the lines
 * are written character-neutral so they read the same. */
export function getGameHostConfig(gameId: string): GameHostConfig | null {
  const host = gameHostCharacters[gameId];
  return host ? { ...host, characterId: resolveCompanion(host.characterId) } : null;
}
