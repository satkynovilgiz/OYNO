import type { ImageSourcePropType } from 'react-native';

import bozUyYurtCamp from '@assets/img/OYNO_design/culture/boz_uy/yurt_camp.jpg';
import horseEagleHunterGoldenHour from '@assets/img/OYNO_design/culture/horse/eagle_hunter_golden_hour.jpg';
import oymoWoodcarvingWarmLight from '@assets/img/OYNO_design/culture/oymo/woodcarving_warm_light.jpg';

import type { LocalizedText } from '@/features/explore/types';

/**
 * Editorial "stories" that connect content already in the app into a
 * narrative, rather than another database (spec "A collection is NOT a
 * new content database... reference existing Culture materials, Explore
 * content, interactive experiences, games when relevant"). Every `id`
 * below is a real, verified id from `culture_items`/`culture_materials`/
 * `interactiveExperiences.ts`/`mockGamesList` - chosen from the
 * categories with genuinely rich, photo-backed content (boz-uy, horse,
 * oymo, shyrdak), not the many name-only stub rows elsewhere in the
 * catalog (food/tradition), so nothing here has to fake depth it doesn't
 * have. `title`/`intro` are original editorial copy (not pulled from any
 * DB row), so they use the same `LocalizedText` shape as Explore/Culture
 * discovery content rather than an i18n UI key - resolved the same way:
 * `collection.title[language] ?? .kg`.
 */
export type CollectionSectionRef =
  | { kind: 'culture_item'; id: string }
  | { kind: 'culture_material'; id: string }
  | { kind: 'interactive_experience'; id: string }
  | { kind: 'game'; id: string };

export type Collection = {
  id: string;
  heroImage: ImageSourcePropType;
  title: LocalizedText;
  intro: LocalizedText;
  sections: CollectionSectionRef[];
  /** The one real Culture category this story lives under - the "related
   * discovery" CTA at the end links here rather than guessing from the
   * section list. */
  relatedCategoryId: string;
};

export const collections: Collection[] = [
  {
    id: 'boz-uy-world',
    relatedCategoryId: 'boz-uy',
    heroImage: bozUyYurtCamp,
    title: {
      kg: 'Боз үйдүн дүйнөсү',
      ru: 'Мир юрты',
      en: 'The World of the Boz Uy',
    },
    intro: {
      kg: 'Боз үй — көчмөн кыргыздардын үй-бүлөлүк жашоосунун жүрөгү. Ар бир бөлүгү - түндүктөн ички жасалгасына чейин - өз маанисине жана тарыхына ээ. Түндүктү жакындан кара, каркасын түшүн жана өзүң курулуш процессин сынап көр.',
      ru: 'Юрта - сердце семейной жизни кочевых кыргызов. Каждая её часть - от тундука до внутреннего убранства - несёт своё значение и историю. Рассмотри тундук поближе, узнай устройство каркаса и попробуй собрать юрту сам(а).',
      en: 'The boz uy (yurt) is the heart of nomadic Kyrgyz family life. Every part of it - from the tunduk roof-crown to its interior layout - carries its own meaning and history. Look closely at the tunduk, learn how the frame goes together, and try building one yourself.',
    },
    sections: [
      { kind: 'culture_item', id: 'boz-uy-overview' },
      { kind: 'culture_item', id: 'boz-uy-tunduk' },
      { kind: 'culture_item', id: 'boz-uy-karkas' },
      { kind: 'culture_item', id: 'boz-uy-kiyiz-jabuu' },
      { kind: 'culture_item', id: 'boz-uy-ichki-jasalga' },
      { kind: 'interactive_experience', id: 'boz-uy' },
      { kind: 'culture_item', id: 'boz-uy-ak-orgoo' },
    ],
  },
  {
    id: 'horse-culture',
    relatedCategoryId: 'horse',
    heroImage: horseEagleHunterGoldenHour,
    title: {
      kg: 'Ат жана кыргыз маданияты',
      ru: 'Конная культура кыргызов',
      en: 'Horse Culture',
    },
    intro: {
      kg: 'Ат - кыргыз үчүн жөн гана унаа эмес, курал-жарак, спорт жана ырым-жырымдын бир бөлүгү. Көк бөрүдөн Кыз куумайга чейин, ат үстүндөгү оюндар кылымдар бою кыргыз турмушунун бир бөлүгү болуп келген. Тарыхын оку, анан өзүң ойноп көр.',
      ru: 'Конь для кыргыза - не просто транспорт, а часть снаряжения, спорта и обрядов. От Кок бору до Кыз куумай - конные игры веками были частью кыргызской жизни. Прочитай их историю, а затем сыграй сам(а).',
      en: 'For Kyrgyz people, the horse is far more than transport - it\'s part of daily gear, sport, and ritual. From Kok Boru to Kyz Kuumai, horseback games have shaped Kyrgyz life for centuries. Read their history, then play them yourself.',
    },
    sections: [
      { kind: 'culture_item', id: 'horse-overview' },
      { kind: 'culture_item', id: 'horse-jylky' },
      { kind: 'culture_item', id: 'horse-eer' },
      { kind: 'culture_item', id: 'horse-kok-boru' },
      { kind: 'game', id: 'kok-boru' },
      { kind: 'culture_item', id: 'horse-kyz-kuumai' },
      { kind: 'game', id: 'kyz-kuumay' },
      { kind: 'culture_item', id: 'horse-at-chabysh' },
      { kind: 'culture_item', id: 'horse-oodarysh' },
    ],
  },
  {
    id: 'kyrgyz-ornament',
    relatedCategoryId: 'oymo',
    heroImage: oymoWoodcarvingWarmLight,
    title: {
      kg: 'Кыргыз оймо-чиймдери',
      ru: 'Кыргызский орнамент',
      en: 'Kyrgyz Ornament',
    },
    intro: {
      kg: 'Мүйүз сымал ийри сызыктар, канат жана асман белгилери - кыргыз оймосу турмуш менен табиятты бир тилде сүйлөтөт. Ушул эле оймо тили жыгач оюусунда да, шырдактын кийизинде да кездешет. Түр-түрдүн маанисин үйрөн, анан өзүң тарт же кый.',
      ru: 'Рогообразные завитки, крылья, небесные знаки - кыргызский орнамент говорит о жизни и природе на одном языке. Этот же язык узора встречается и в резьбе по дереву, и в войлоке шырдака. Узнай значение мотивов, а затем создай свой узор.',
      en: 'Horn-like spirals, wings, and celestial signs - Kyrgyz ornament speaks about life and nature in one visual language. The same motifs appear carved in wood and felted into a shyrdak rug. Learn what the patterns mean, then design your own.',
    },
    sections: [
      { kind: 'culture_item', id: 'oymo-overview' },
      { kind: 'culture_item', id: 'oymo-umai-ene' },
      { kind: 'culture_item', id: 'oymo-kochkor-muyuz' },
      { kind: 'culture_item', id: 'oymo-kaz-moyun' },
      { kind: 'interactive_experience', id: 'oymo' },
      { kind: 'culture_item', id: 'shyrdak-craft' },
      { kind: 'culture_item', id: 'shyrdak-tustor' },
      { kind: 'culture_item', id: 'shyrdak-at-bashy' },
      { kind: 'interactive_experience', id: 'shyrdak' },
    ],
  },
];

export function getCollection(id: string): Collection | undefined {
  return collections.find((collection) => collection.id === id);
}
