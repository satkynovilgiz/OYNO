import type { LocalizedText } from '@/features/explore/types';

export type FaqCategory = 'account' | 'games' | 'culture' | 'explore' | 'rewards' | 'settings';

export type FaqItem = {
  id: string;
  category: FaqCategory;
  question: LocalizedText;
  answer: LocalizedText;
};

/** Real FAQ about this app's actual current functionality - not
 * placeholder text, and not claims about features that don't exist yet
 * (e.g. no claims about multiplayer or cloud sync, since neither exists).
 * `question`/`answer` are per-language content (same `LocalizedText` shape
 * used for Explore/Culture discovery titles), not i18n UI keys - resolved
 * the same way at the call site: `faqItem.question[language] ?? .kg`. */
export const faqItems: FaqItem[] = [
  {
    id: 'change-password',
    category: 'account',
    question: {
      kg: 'Сырсөзүмдү кантип өзгөртсөм болот?',
      ru: 'Как я могу изменить пароль?',
      en: 'How do I change my password?',
    },
    answer: {
      kg: '"Жөндөөлөр → Коопсуздук" бөлүмүнөн учурдагы жана жаңы сырсөзүңүздү жазып өзгөртө аласыз.',
      ru: 'В разделе "Настройки → Безопасность" введите текущий и новый пароль, чтобы изменить его.',
      en: 'In "Settings → Security", enter your current and new password to change it.',
    },
  },
  {
    id: 'forgot-password',
    category: 'account',
    question: {
      kg: 'Сырсөзүмдү унутуп калсам эмне кылам?',
      ru: 'Что делать, если я забыл(а) пароль?',
      en: 'What if I forgot my password?',
    },
    answer: {
      kg: 'Кирүү экранындагы "Сырсөздү унуттуңузбу?" шилтемесин басып, email аркылуу жаңыртыңыз.',
      ru: 'Нажмите "Забыли пароль?" на экране входа и восстановите его через email.',
      en: 'Tap "Forgot password?" on the sign-in screen and reset it through your email.',
    },
  },
  {
    id: 'delete-account',
    category: 'account',
    question: {
      kg: 'Аккаунтумду кантип өчүрсөм болот?',
      ru: 'Как удалить мой аккаунт?',
      en: 'How do I delete my account?',
    },
    answer: {
      kg: '"Жөндөөлөр → Аккаунт → Аккаунтту өчүрүү" бөлүмүнөн сырсөзүңүздү ырастап өчүрө аласыз. Бул аракет артка кайтарылбайт.',
      ru: 'В разделе "Настройки → Аккаунт → Удалить аккаунт" подтвердите пароль, чтобы удалить его. Это действие необратимо.',
      en: 'In "Settings → Account → Delete account", confirm your password to delete it. This action cannot be undone.',
    },
  },
  {
    id: 'which-games-playable',
    category: 'games',
    question: {
      kg: 'Азыр кайсы оюндар ойнотулат?',
      ru: 'В какие игры уже можно играть?',
      en: 'Which games are playable right now?',
    },
    answer: {
      kg: 'Учурда "Беш таш" толук ойнотулат. Калган оюндар "Жакында" деп белгиленген - алар үстүндө иштелип жатат.',
      ru: 'Сейчас полностью доступна игра "Беш таш". Остальные игры отмечены как "Скоро" - они ещё в разработке.',
      en: '"Besh Tash" is fully playable right now. The other games are marked "Coming soon" - they’re still in development.',
    },
  },
  {
    id: 'culture-sections',
    category: 'culture',
    question: {
      kg: 'Маданият бөлүмүндө эмне бар?',
      ru: 'Что есть в разделе "Культура"?',
      en: 'What’s in the Culture section?',
    },
    answer: {
      kg: 'Боз үй, Оймо, Шырдак, Комуз жана башка категориялар менен тааныша аласыз - категориялардын айрымдары азырынча иштелип жатат.',
      ru: 'Вы можете изучить Боз үй, Оймо, Шырдак, Комуз и другие категории - некоторые из них ещё дорабатываются.',
      en: 'You can explore Boz Uy, Oymo, Shyrdak, Komuz, and other categories - some of them are still being built out.',
    },
  },
  {
    id: 'explore-map',
    category: 'explore',
    question: {
      kg: 'Изилдөө картасын кантип колдонсом болот?',
      ru: 'Как пользоваться картой в разделе "Исследуй"?',
      en: 'How do I use the Explore map?',
    },
    answer: {
      kg: 'Картадагы аймактарды басып, ар бир жердин баракчасына өтө аласыз. Картаны эки манжа менен чоңойтуп/кичирейте аласыз.',
      ru: 'Нажмите на регион на карте, чтобы открыть страницу этого места. Карту можно масштабировать двумя пальцами.',
      en: 'Tap a region on the map to open that place’s page. You can pinch to zoom the map in and out.',
    },
  },
  {
    id: 'how-xp-works',
    category: 'rewards',
    question: {
      kg: 'XP жана деңгээл кантип эсептелет?',
      ru: 'Как считаются XP и уровень?',
      en: 'How are XP and level calculated?',
    },
    answer: {
      kg: 'Учурда бул сандар үлгү (mock) маалымат - чыныгы прогресс системасы иштелип жатат, ошондуктан алар дагы өзгөрбөйт.',
      ru: 'Сейчас эти цифры - демонстрационные (mock) данные, настоящая система прогресса ещё в разработке, поэтому пока они не меняются.',
      en: 'These numbers are currently mock/placeholder data - the real progress system is still being built, so they don’t change yet.',
    },
  },
  {
    id: 'change-language',
    category: 'settings',
    question: {
      kg: 'Тилди кантип алмаштырсам болот?',
      ru: 'Как изменить язык?',
      en: 'How do I change the language?',
    },
    answer: {
      kg: '"Жөндөөлөр → Тил" бөлүмүнөн Кыргызча, Орусча же Англисче тилдерин тандай аласыз - тандоо дароо колдонулат.',
      ru: 'В разделе "Настройки → Язык" выберите кыргызский, русский или английский - выбор применяется сразу.',
      en: 'In "Settings → Language", choose Kyrgyz, Russian, or English - the choice applies immediately.',
    },
  },
];
