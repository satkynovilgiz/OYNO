export type FaqCategory = 'account' | 'games' | 'culture' | 'explore' | 'rewards' | 'settings';

export type FaqItem = {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
};

export const FAQ_CATEGORY_LABELS: Record<FaqCategory, string> = {
  account: 'Аккаунт',
  games: 'Оюндар',
  culture: 'Маданият',
  explore: 'Изилдөө',
  rewards: 'Сыйлыктар',
  settings: 'Жөндөөлөр',
};

/** Real FAQ about this app's actual current functionality - not
 * placeholder text, and not claims about features that don't exist yet
 * (e.g. no claims about multiplayer or cloud sync, since neither exists). */
export const faqItems: FaqItem[] = [
  {
    id: 'change-password',
    category: 'account',
    question: 'Сырсөзүмдү кантип өзгөртсөм болот?',
    answer: '"Жөндөөлөр → Коопсуздук" бөлүмүнөн учурдагы жана жаңы сырсөзүңүздү жазып өзгөртө аласыз.',
  },
  {
    id: 'forgot-password',
    category: 'account',
    question: 'Сырсөзүмдү унутуп калсам эмне кылам?',
    answer: 'Кирүү экранындагы "Сырсөздү унуттуңузбу?" шилтемесин басып, email аркылуу жаңыртыңыз.',
  },
  {
    id: 'delete-account',
    category: 'account',
    question: 'Аккаунтумду кантип өчүрсөм болот?',
    answer: '"Жөндөөлөр → Аккаунт → Аккаунтту өчүрүү" бөлүмүнөн сырсөзүңүздү ырастап өчүрө аласыз. Бул аракет артка кайтарылбайт.',
  },
  {
    id: 'which-games-playable',
    category: 'games',
    question: 'Азыр кайсы оюндар ойнотулат?',
    answer: 'Учурда "Беш таш" толук ойнотулат. Калган оюндар "Жакында" деп белгиленген - алар үстүндө иштелип жатат.',
  },
  {
    id: 'culture-sections',
    category: 'culture',
    question: 'Маданият бөлүмүндө эмне бар?',
    answer: 'Боз үй, Оймо, Шырдак, Комуз жана башка категориялар менен тааныша аласыз - категориялардын айрымдары азырынча иштелип жатат.',
  },
  {
    id: 'explore-map',
    category: 'explore',
    question: 'Изилдөө картасын кантип колдонсом болот?',
    answer: 'Картадагы аймактарды басып, ар бир жердин баракчасына өтө аласыз. Картаны эки манжа менен чоңойтуп/кичирейте аласыз.',
  },
  {
    id: 'how-xp-works',
    category: 'rewards',
    question: 'XP жана деңгээл кантип эсептелет?',
    answer: 'Учурда бул сандар үлгү (mock) маалымат - чыныгы прогресс системасы иштелип жатат, ошондуктан алар дагы өзгөрбөйт.',
  },
  {
    id: 'change-language',
    category: 'settings',
    question: 'Тилди кантип алмаштырсам болот?',
    answer: '"Жөндөөлөр → Тил" бөлүмүнөн Кыргызча, Орусча же Англисче тилдерин тандай аласыз - тандоо дароо колдонулат.',
  },
];
