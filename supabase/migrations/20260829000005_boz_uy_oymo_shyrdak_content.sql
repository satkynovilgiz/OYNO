-- Real, sourced content for the 3 Culture categories that had either a
-- single empty stub row (boz-uy) or zero rows at all (oymo, shyrdak) - see
-- this session's audit: these were the last "visual placeholder" gaps in
-- Culture. Sourced from a short web research pass (ru/ky Wikipedia +
-- kg-language culture sites), not deeply cross-verified the way
-- content/explore/*.md was originally researched, so accuracy_level is
-- 'partially_verified' throughout rather than 'verified' - honest about
-- the shallower research depth, not a claim these facts are wrong.
--
-- This still doesn't build the interactive modules themselves (an Oymo
-- pattern editor, a Shyrdak matching minigame, a Boz-Üy walkthrough) -
-- that's UI/engine work, separate from having real content to build it
-- from. This migration only replaces invented-or-empty content with real,
-- cited facts in culture_items, viewable today via the existing
-- /culture/[categoryId] -> /culture/item/[itemId] screens.

update public.culture_items set
  origin = 'Байыркы көчмөн турмуш-тиричилигинен келип чыккан, жеңил куралып-бузулган, жүктөлүп ташылган турак жай.',
  history = 'Кыргыздардын негизги салттуу турагы - жыгачтан жасалган каркасы кийиз менен жабылган көчмөн турак жай. Формасы кылымдар бою өзгөрбөй сакталып калган.',
  cultural_meaning = 'Түндүк кыргыз элинин улуттук идентификациясынын символу - Кыргызстандын мамлекеттик желегинде түндүктүн сүрөтү чагылдырылган.',
  objects_used = 'Керегe (дубал каркасы), уук (чатыр таякчалары), түндүк (чатырдын жогорку шакеги), бозого (эшик каркасы), каалга (эшик).',
  traditional_method = 'Курулуш иреттүү жүрөт: адегенде керегe жайылып тигилет, анан уктар керегeнин үстүнкү четине учтуу жагы менен байланат, түндүк устундардын жардамы менен көтөрүлүп уктардын учтары ага орнотулат, андан кийин чий, кийиз жабуулар жана эшик каалгасы илинет.',
  accuracy_level = 'partially_verified',
  sources = array[
    'https://ky.wikipedia.org/wiki/%D0%91%D0%BE%D0%B7_%D2%AF%D0%B9',
    'https://www.kyrgyzinfo.ru/kyrgyz-bujumdary-boz-j-tush-kijiz-kamchy/'
  ]
where id = 'boz-uy-overview';

insert into public.culture_items (
  id, category_id, subgroup, title, type_label, origin, history, cultural_meaning,
  objects_used, fun_facts, accuracy_level, sources, sort_order
) values (
  'oymo-overview', 'oymo', null, 'Кыргыз оймо-чийимдери', 'custom',
  'Оюм (оймо) - кыргыз колдонмо искусствосунун бардык түрлөрүндө колдонулган кооздук, сүрөт, түр.',
  'Кыргыз аялдары бир эле мотивдин көптөгөн вариацияларын жаратып, бул оюмдардын өнүгүшүнө жана ар түрдүүлүгүнө чоң салым кошушкан.',
  'Ар бир оюм белгилүү бир мааниге ээ: "мүйүз" (мал мүйүзү), "карга тырмак" (карганын тырмагы), "кыял" (кыялдан алынган түрлөр), "жалбырак", "гүл" жана күн-ай-суу сыяктуу жаратылыш образдары символдук маанини алып жүрөт.',
  'Кийиз (алакийиз, шырдак, түш кийиз), тери буюмдар (көөкөр, көнөк, тердик), жыгач буюмдар, күмүш-жез зер буюмдар, сайма.',
  'Оймо бир гана кооздук эмес, ар бир элемент өз алдынча маани алып жүргөн белгилер тутуму катары каралат.',
  'partially_verified',
  array['https://ky.wikipedia.org/wiki/%D0%9A%D1%8B%D1%80%D0%B3%D1%8B%D0%B7_%D0%BE%D1%8E%D0%BC_%D1%87%D0%B8%D0%B9%D0%B8%D0%BC%D0%B4%D0%B5%D1%80%D0%B8'],
  0
)
on conflict (id) do update set
  title = excluded.title, type_label = excluded.type_label, origin = excluded.origin,
  history = excluded.history, cultural_meaning = excluded.cultural_meaning,
  objects_used = excluded.objects_used, fun_facts = excluded.fun_facts,
  accuracy_level = excluded.accuracy_level, sources = excluded.sources;

insert into public.culture_items (
  id, category_id, subgroup, title, type_label, origin, history,
  traditional_method, modern_status, fun_facts, accuracy_level, sources, sort_order
) values (
  'shyrdak-craft', 'shyrdak', null, 'Шырдак', 'custom',
  'Кыргыз жана моңгол элдеринин эң татаал даярдоо технологиясына ээ кийиз буюмдарынын бири - моңголчо "ширдег" деп аталат.',
  '2012-жылы кыргыздын салттуу шырдак жана ала кийиз тигүү өнөрү ЮНЕСКОнун Материалдык эмес маданий мурас тизмесине кирген.',
  'Стандарттуу өлчөмү 2х4 метр. Түсү каршы-терши эки кийиз кабаты үстөм-үстөм коюлуп, үлгү тартылат, экөө тең бир учурда курч курал менен кесилет, анан кесилген бөлүктөр орун алмаштырылып, өз ара тигилип, оң жана терс сүрөт (позитив-негатив) пайда болот. Тигүү техникасы "шырык" деп аталып, ушундан "шырдак" деген ат келип чыккан.',
  'Учурда табигый боёктордун ордуна (уу тамыры, индиго, испарак) анилин боёктору колдонулат.',
  'Оюулар көбүнчө айбандардын бөлүктөрүн чагылдырат: ит куйругу, тоо теке мүйүзү, куш тырмагы. Четтери милдеттүү түрдө ак-кара түстөр менен аяктайт - бул кыргыз тоолорунун карлуу чокуларын билдирет. Жакшы кийизден жасалган жана туура сакталган шырдак жүз жылга чейин кызмат кыла алат.',
  'partially_verified',
  array[
    'https://ru.wikipedia.org/wiki/%D0%A8%D0%B8%D1%80%D0%B4%D0%B0%D0%BA',
    'https://eurasia.travel/ru/kyrgyzstan/culture/carpets/shyrdak/'
  ],
  0
)
on conflict (id) do update set
  title = excluded.title, type_label = excluded.type_label, origin = excluded.origin,
  history = excluded.history,
  traditional_method = excluded.traditional_method, modern_status = excluded.modern_status,
  fun_facts = excluded.fun_facts, accuracy_level = excluded.accuracy_level, sources = excluded.sources;
