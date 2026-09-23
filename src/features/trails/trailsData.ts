import type { ImageSourcePropType } from 'react-native';

import bozUyYurtCamp from '@assets/img/OYNO_design/culture/boz_uy/yurt_camp.jpg';
import bozUyBuilders from '@assets/img/OYNO_design/culture/boz_uy/yurt_builders_alpine_meadow.jpg';
import horseEagleHunter from '@assets/img/OYNO_design/culture/horse/eagle_hunter_golden_hour.jpg';

import { natureSiteImages } from '@/features/explore/data';
import type { LocalizedText } from '@/features/explore/types';

/**
 * Guided Cultural Trails - ordered walks through content OYNO already has.
 * A trail stores ONLY references (type + real id), never copied text: every
 * step's title, photo and screen come from the existing sources at render
 * time (explore_regions, culture_items, games list, interactive
 * experiences, collections). `title`/`intro` are short original framing
 * copy that makes no cultural or historical claims of its own - the facts
 * live in the linked content. Every id below was checked against the live
 * database / bundled catalogs; trailsData.test.ts keeps them honest.
 *
 * Designed for Offline Mode later: a trail's downloadable content is just
 * its `steps`, so a future "Download Trail" can hand them to the offline
 * service without a second list.
 */
export type TrailStepRef =
  | { type: 'destination'; id: string }
  | { type: 'culture_item'; id: string }
  | { type: 'culture_material'; id: string }
  | { type: 'interactive_experience'; id: string }
  | { type: 'game'; id: string }
  | { type: 'collection'; id: string };

export type Trail = {
  id: string;
  title: LocalizedText;
  intro: LocalizedText;
  heroImage: ImageSourcePropType;
  steps: TrailStepRef[];
};

export const trails: Trail[] = [
  {
    id: 'horse-culture',
    heroImage: horseEagleHunter,
    title: { kg: 'Ат маданияты', ru: 'Конная культура', en: 'Horse Culture' },
    intro: {
      kg: 'Жылкы жана ат үстүндөгү оюндар жөнүндөгү окуяларды оку, анан ошол оюндарды өзүң ойноп көр.',
      ru: 'Прочитай о лошадях и конных играх, а затем сыграй в эти игры сам(а).',
      en: 'Read about horses and horseback games, then play those games yourself.',
    },
    steps: [
      { type: 'culture_item', id: 'horse-overview' },
      { type: 'culture_item', id: 'horse-jylky' },
      { type: 'culture_item', id: 'horse-kok-boru' },
      { type: 'game', id: 'kok-boru' },
      { type: 'culture_item', id: 'horse-kyz-kuumai' },
      { type: 'game', id: 'kyz-kuumay' },
    ],
  },
  {
    id: 'boz-uy-home',
    heroImage: bozUyBuilders,
    title: { kg: 'Кыргыз үйү: боз үй', ru: 'Кыргызский дом: юрта', en: 'Kyrgyz Home & Boz Uy' },
    intro: {
      kg: 'Боз үйдүн бөлүктөрүн биринин артынан бирин ачып чык, анан өзүң курап, ичин шырдак менен жасалгала.',
      ru: 'Открой части юрты одну за другой, затем собери её сам(а) и укрась шырдаком.',
      en: 'Discover the parts of the boz uy one by one, then build one yourself and design a shyrdak for it.',
    },
    steps: [
      { type: 'culture_item', id: 'boz-uy-overview' },
      { type: 'culture_item', id: 'boz-uy-karkas' },
      { type: 'culture_item', id: 'boz-uy-tunduk' },
      { type: 'culture_item', id: 'boz-uy-kiyiz-jabuu' },
      { type: 'interactive_experience', id: 'boz-uy' },
      { type: 'culture_item', id: 'boz-uy-ichki-jasalga' },
      { type: 'culture_item', id: 'shyrdak-craft' },
      { type: 'interactive_experience', id: 'shyrdak' },
    ],
  },
  {
    id: 'nomad-life',
    heroImage: bozUyYurtCamp,
    title: { kg: 'Көчмөн турмушу', ru: 'Жизнь кочевников', en: 'Nomad Life' },
    intro: {
      kg: 'Боз үй, жылкы, жайлоо жана салттуу оюндар - OYNOдогу окуялар аркылуу бир жолго чык.',
      ru: 'Юрта, лошади, джайлоо и традиционные игры - один путь через истории OYNO.',
      en: 'The boz uy, horses, summer pastures and traditional games - one path through stories already in OYNO.',
    },
    steps: [
      { type: 'culture_item', id: 'boz-uy-overview' },
      { type: 'interactive_experience', id: 'boz-uy' },
      { type: 'culture_item', id: 'horse-jylky' },
      { type: 'destination', id: 'suusamyr' },
      { type: 'game', id: 'chuko' },
      { type: 'collection', id: 'horse-culture' },
    ],
  },
  {
    id: 'nature-of-kyrgyzstan',
    heroImage: natureSiteImages['son-kol'],
    title: { kg: 'Кыргызстандын табияты', ru: 'Природа Кыргызстана', en: 'Nature of Kyrgyzstan' },
    intro: {
      kg: 'OYNOдогу алты табигый жерди аралап чык - көлдөрдөн токойго, өрөөндөн тоолорго.',
      ru: 'Пройди по шести природным местам OYNO - от озёр до леса, от долин до гор.',
      en: "Travel through OYNO's six nature sites - from lakes to forest, valleys to mountains.",
    },
    steps: [
      { type: 'destination', id: 'ala-too' },
      { type: 'destination', id: 'suusamyr' },
      { type: 'destination', id: 'son-kol' },
      { type: 'destination', id: 'sary-chelek' },
      { type: 'destination', id: 'arslanbob' },
      { type: 'destination', id: 'alay' },
    ],
  },
];

export function getTrail(id: string): Trail | undefined {
  return trails.find((trail) => trail.id === id);
}

export function stepKey(step: TrailStepRef): string {
  return `${step.type}:${step.id}`;
}
