/**
 * Typed data layer for Explore locations. Every entry is transcribed from a
 * researched, cited content file at content/explore/{id}.md - do not add or
 * edit facts here without updating the matching content file first (facts
 * live there with citations; this file just shapes them for the UI).
 */
import { colors } from '@/theme';
import discoveryBeshbarmak from '@assets/img/OYNO_design/explore/discovery_beshbarmak.png';
import discoveryBozUy from '@assets/img/OYNO_design/explore/discovery_boz_uy.png';
import discoveryTooTeke from '@assets/img/OYNO_design/explore/discovery_too_teke.png';
import discoveryYsykKol from '@assets/img/OYNO_design/explore/discovery_ysyk_kol.png';

import type {
  ExploreDiscovery,
  ExploreLocation,
  ExploreMapPin,
  ExploreProgress,
  ExploreQuest,
} from './types';

export const exploreLocations: ExploreLocation[] = [
  // --- Regions -----------------------------------------------------------
  {
    id: 'bishkek',
    kind: 'region',
    name: { kg: 'Бишкек', ru: 'Бишкек', en: 'Bishkek' },
    tagline: 'Кыргызстандын борбор шаары',
    facts: [
      '1878-жылы "Пишпек" деп негизделген, 1926-жылы Фрунзе, 1991-жылы көз каранды эмес Кыргызстандын борбор шаары катары Бишкек деп аталды.',
      'Азыркы учурда калкы 1 миллионго жакын.',
    ],
    status: 'verified',
    discoveredPercent: 0,
  },
  {
    id: 'chuy',
    kind: 'region',
    name: { kg: 'Чүй', ru: 'Чуй', en: 'Chüy' },
    tagline: 'Түндүк аймак, Кыргыз Ала-Тоонун этегинде',
    facts: [
      'Ири шаарлары: Токмок, Кант, Кара-Балта.',
      'Бишкек шаары өзүнчө республикалык мааниге ээ болгондуктан, облустун курамына кирбейт.',
    ],
    status: 'verified',
    discoveredPercent: 0,
  },
  {
    id: 'ysyk-kol',
    kind: 'region',
    name: { kg: 'Ысык-Көл', ru: 'Иссык-Куль', en: 'Issyk-Kul' },
    tagline: 'Кыргызстандын бермети',
    facts: [
      'Дүйнөдөгү эң тунук көлдөрдүн бири (Байкалдан кийин 2-орунда), эч качан тоңбойт.',
      'Тереңдиги 702 метр, деңиз деңгээлинен 1608 метр бийикте жайгашкан.',
      'Аянты 6236 км² — дүйнөдөгү 30 чоң көлдүн бири.',
    ],
    status: 'verified',
    discoveredPercent: 42,
  },
  {
    id: 'naryn',
    kind: 'region',
    name: { kg: 'Нарын', ru: 'Нарын', en: 'Naryn' },
    tagline: 'Кыргызстандын эң бийик тоолуу облусу',
    facts: [
      'Аймагынын 95%и деңиз деңгээлинен 1000 метрден бийик жайгашкан.',
      'Сон-Көл, Кол-Суу, Чатыр-Көл сыяктуу бийик тоо көлдөрүнүн мекени.',
    ],
    status: 'verified',
    discoveredPercent: 0,
  },
  {
    id: 'talas',
    kind: 'region',
    name: { kg: 'Талас', ru: 'Талас', en: 'Talas' },
    tagline: '"Манас" эпосунун ыйык жери',
    facts: [
      '"Манас" эпосунун экинчи бөлүгүндө Семетей Таласка кайтып келет.',
      '"Манас" дүйнөдөгү эң узун эпос катары Гиннестин рекорддор китебине кирген.',
    ],
    status: 'partially_verified',
    discoveredPercent: 0,
  },
  {
    id: 'osh',
    kind: 'region',
    name: { kg: 'Ош', ru: 'Ош', en: 'Osh' },
    tagline: 'Борбор Азиядагы эң байыркы шаарлардын бири',
    facts: [
      'Фергана өрөөнүнүн чыгыш бөлүгүндө, Алай тоолорунун этегинде жайгашкан.',
      'Кыргызстандагы экинчи чоң шаар.',
    ],
    status: 'partially_verified',
    discoveredPercent: 0,
  },
  {
    id: 'jalal-abad',
    kind: 'region',
    name: { kg: 'Жалал-Абад', ru: 'Джалал-Абад', en: 'Jalal-Abad' },
    tagline: 'Дарыгер булактардын аймагы',
    facts: [
      'Минералдык суу булактарынын негизинде курорттор өнүккөн.',
      'Арсланбоб жаңгак токою жана Сары-Челек биосфералык коругу ушул облуста жайгашкан.',
    ],
    status: 'verified',
    discoveredPercent: 0,
  },
  {
    id: 'batken',
    kind: 'region',
    name: { kg: 'Баткен', ru: 'Баткен', en: 'Batken' },
    tagline: 'Кыргызстандын эң жаш облусу',
    facts: [
      '1999-жылдын 13-октябрында түзүлгөн — Кыргызстандын эң жаш облусу.',
      'Тажикстан жана Өзбекстан менен чектешет.',
    ],
    status: 'verified',
    discoveredPercent: 0,
  },

  // --- Nature --------------------------------------------------------------
  {
    id: 'son-kol',
    kind: 'nature',
    name: { kg: 'Сон-Көл', ru: 'Сон-Куль', en: 'Son-Köl' },
    tagline: 'Мөңгүлөрдөн пайда болгон бийик тоо көлү',
    facts: [
      'Деңиз деңгээлинен 3016 метр бийикте, Нарын облусунда жайгашкан.',
      'Кыргызстандагы эң чоң таза суулуу көл. Сентябрдын аягынан майга чейин тоңуп турат.',
    ],
    status: 'verified',
    discoveredPercent: 0,
  },
  {
    id: 'suusamyr',
    kind: 'nature',
    name: { kg: 'Суусамыр', ru: 'Суусамыр', en: 'Suusamyr' },
    tagline: 'Кеңири жайлоо өрөөнү',
    facts: [
      'Кыргыз Ала-Тоо менен Суусамыр, Жумгал тоолорунун ортосунда, 2000–3200 метр бийикте.',
      'Чүй, Талас, Кетмен-Төбө өрөөндөрүнөн келген малдын негизги жайыты.',
    ],
    status: 'verified',
    discoveredPercent: 0,
  },
  {
    id: 'alay',
    kind: 'nature',
    name: { kg: 'Алай', ru: 'Алай', en: 'Alay' },
    tagline: 'Ленин чокусунун мекени',
    facts: [
      'Чоң Алай кырка тоосунун эң бийик чокусу — Ленин чокусу, 7137 метр.',
      'Ачыкташ альплагери ушул жерде жайгашкан, альпинизм үчүн ыңгайлуу.',
    ],
    status: 'verified',
    discoveredPercent: 0,
  },
  {
    id: 'sary-chelek',
    kind: 'nature',
    name: { kg: 'Сары-Челек', ru: 'Сары-Челек', en: 'Sary-Chelek' },
    tagline: 'ЮНЕСКОнун бүткүл дүйнөлүк мурасы',
    facts: [
      'Тереңдиги 244 метр — Ысык-Көлдөн кийинки Кыргызстандагы эң терең көл.',
      '1979-жылы ЮНЕСКОнун биосфералык коруктар тизмесине, 2016-жылы Бүткүл дүйнөлүк мурас тизмесине кирген.',
    ],
    status: 'verified',
    discoveredPercent: 0,
  },
  {
    id: 'arslanbob',
    kind: 'nature',
    name: { kg: 'Арсланбоб', ru: 'Арсланбоб', en: 'Arslanbob' },
    tagline: 'Дүйнөдөгү эң чоң жаңгак токою',
    facts: [
      'Жалал-Абад облусунда, Арстанбап өрөөнүндө жайгашкан.',
      'Айрым жаңгак дарактарынын жашы миң жылдан ашык.',
    ],
    status: 'partially_verified',
    discoveredPercent: 0,
  },
  {
    id: 'ala-too',
    kind: 'nature',
    name: { kg: 'Ала-Тоо', ru: 'Ала-Тоо', en: 'Ala-Too' },
    tagline: 'Түндүк Тянь-Шандын улуу кырка тоосу',
    facts: [
      'Узундугу 454 км, эң бийик чокусу — Аламүдүн чокусу, 4895 метр.',
      'Чүй өрөөнүн Талас, Суусамыр, Кочкор өрөөндөрүнөн бөлүп турат.',
    ],
    status: 'verified',
    discoveredPercent: 0,
  },
];

export function getExploreLocationById(id: string): ExploreLocation | undefined {
  return exploreLocations.find((location) => location.id === id);
}

/**
 * Pin tap-target placement on KyrgyzstanMap, measured directly against the
 * pins already painted into map_terrain.png (sliced from the design
 * reference "Explore Kyrgyzstan Learning Map.png") - KyrgyzstanMap renders
 * that art as-is and places an invisible tap target at each of these
 * coordinates rather than drawing a second pin on top. `color`/`variant`
 * aren't consumed by the map right now (nothing to color - the pin is
 * already baked into the art) but are kept as location metadata for when a
 * clean, pin-free map asset exists and MapPin goes back to being rendered.
 */
export const exploreMapPins: ExploreMapPin[] = [
  { locationId: 'talas', xPercent: 24.7, yPercent: 7.7, color: '#2E6E82', variant: 'default' },
  { locationId: 'chuy', xPercent: 44.6, yPercent: 7.4, color: colors.primary, variant: 'default' },
  { locationId: 'bishkek', xPercent: 60.4, yPercent: 12.0, color: '#C0392B', variant: 'landmark' },
  { locationId: 'ysyk-kol', xPercent: 84.9, yPercent: 17.5, color: '#3E8E9E', variant: 'default' },
  { locationId: 'jalal-abad', xPercent: 18.0, yPercent: 44.5, color: colors.primary, variant: 'default' },
  { locationId: 'naryn', xPercent: 60.7, yPercent: 42.7, color: colors.discovery.animals, variant: 'default' },
  { locationId: 'osh', xPercent: 41.8, yPercent: 64.7, color: '#C77B2E', variant: 'landmark' },
  { locationId: 'batken', xPercent: 6.1, yPercent: 73.9, color: colors.discovery.animals, variant: 'default' },
];

/** Mock exploration progress - matches the numbers given in the Explore
 * screen design spec, not wired to real user progress yet. */
export const exploreProgress: ExploreProgress = {
  overallPercent: 37,
  stats: {
    locations: { current: 12, total: 40 },
    nature: { current: 15, total: 30 },
    culture: { current: 20, total: 50 },
    animals: { current: 8, total: 20 },
    food: { current: 7, total: 20 },
    quests: { current: 18, total: 60 },
  },
};

export const exploreCurrentQuest: ExploreQuest = {
  id: 'lost-shyrdak',
  characterId: 'boru',
  title: 'Жоголгон шырдакты тап',
  subtitle: 'Бөрү сага жардамга муктаж!',
  foundCount: 2,
  totalCount: 5,
  ctaLabel: 'Квестти улантуу',
};

export const exploreDiscoveries: ExploreDiscovery[] = [
  { id: 'ysyk-kol-shore', title: 'Ысык-Көлдүн жээги', category: 'nature', xpReward: 50, imageSource: discoveryYsykKol },
  { id: 'boz-uy', title: 'Боз үй', category: 'culture', xpReward: 60, imageSource: discoveryBozUy },
  { id: 'too-teke', title: 'Тоо теке', category: 'animals', xpReward: 40, imageSource: discoveryTooTeke },
  { id: 'beshbarmak-dish', title: 'Бешбармак', category: 'food', xpReward: 50, imageSource: discoveryBeshbarmak },
];
