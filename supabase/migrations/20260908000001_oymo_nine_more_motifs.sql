-- Nine more culture_items rows under the 'oymo' category, giving each of
-- these ornament names its own photo+description card (alongside
-- oymo-overview, oymo-umai-ene, oymo-balyk-oyuu already there). Titles and
-- cultural_meaning text are the Kyrgyz descriptions the user forwarded
-- verbatim from a WhatsApp/Telegram share (originally from super.kg,
-- "Кыргыздын оюуларындагы маанилер" by Сүйүн Кулматова, "Супер-Инфо" #744,
-- 2017-02-03 - see sources). Two motifs from that same share, Жалбырак and
-- Карга тырмак, were skipped here since rows/Oymo-Creator shapes for them
-- already existed.
--
-- Photos are the small (~120x60px) icon graphics from that article,
-- bundled at assets/img/OYNO_design/culture/oymo/ and wired via
-- cultureItemImages (src/features/culture/data.ts) - deliberately lower
-- resolution than the oymo-umai-ene/oymo-balyk-oyuu photos; used anyway
-- per explicit user choice over a text-only or photo-less alternative.

insert into public.culture_items (
  id, category_id, subgroup, title, type_label, cultural_meaning, accuracy_level, sources, sort_order
) values
  (
    'oymo-it-kuiruk', 'oymo', null, 'Ит куйрук', 'custom',
    'Иттин чычайта көтөрүлгөн куйругунун элесинен алынган элемент. Ит куйрук оюму жалгыз колдонулбайт. Шырдак, сайма, ала кийиз беттеринде бир нече элемент биригип кооз тизмекти түзөт.',
    'partially_verified', array['https://www.super.kg/article/show/39493'], 3
  ),
  (
    'oymo-kochkor-muyuz', 'oymo', null, 'Кочкор мүйүз', 'custom',
    'Кожоюндун, жайлоодо жайлаган элдин мал-жандыгын түшүндүрөт. Кандай оюм-чийим болбосун кочкор мүйүзсүз түзүлбөйт. Башка элдин оюуларынан кыргыздыкын айырмалап турган ушул элемент.',
    'partially_verified', array['https://www.super.kg/article/show/39493'], 4
  ),
  (
    'oymo-teke-muyuz', 'oymo', null, 'Теке мүйүз', 'custom',
    'Кочкор мүйүздү жандап жүргөн кошумча элемент. Теке мүйүз жалгыз турганда жөнөкөй, көрксүз болуп калат.',
    'partially_verified', array['https://www.super.kg/article/show/39493'], 5
  ),
  (
    'oymo-kaz-moyun', 'oymo', null, 'Каз моюн', 'custom',
    'Каздын моюнуна окшошкон оюу.',
    'partially_verified', array['https://www.super.kg/article/show/39493'], 6
  ),
  (
    'oymo-bulak', 'oymo', null, 'Булак', 'custom',
    'Жерден чыккан көзөнөк суунун булакка айланганы. Кыз-келиндердин кийимдеринде көбүрөөк колдонулат.',
    'partially_verified', array['https://www.super.kg/article/show/39493'], 7
  ),
  (
    'oymo-umai-oyumu', 'oymo', null, 'Умай оюму', 'custom',
    'Кийим-кечеге, анын ичинде балдардын кийимдерине, баш кийимдерге, күмүш буюмдарга түшүрүлөт.',
    'partially_verified', array['https://www.super.kg/article/show/39493'], 8
  ),
  (
    'oymo-adamdyn-juzu', 'oymo', null, 'Адамдын жүзү', 'custom',
    'Аялдардын дээрлик көбү илгери саамайларын экиге бөлүп өрүшкөн. Экиге бөлүнгөн саамайдын элесинен алынган элемент "адамдын жүзү" деп аталат.',
    'partially_verified', array['https://www.super.kg/article/show/39493'], 9
  ),
  (
    'oymo-muyuz-kyal', 'oymo', null, 'Мүйүз кыял', 'custom',
    'Жандыктын мүйүзүнүн элеси тартылган, бирок үзүлбөгөн оюм. Саймада, шырдакта, темир, жыгач буюмдарда, белдемчи, чапандардын жээктеринде жээк оюу катары колдонулат.',
    'partially_verified', array['https://www.super.kg/article/show/39493'], 10
  ),
  (
    'oymo-tort-kulak', 'oymo', null, 'Төрт кулак', 'custom',
    'Боз үйдүн керегелерин билдирип, "боз үй" деген маанини берет. Бир нече оюу бириккенде көп учурда ортосуна жайгашат.',
    'partially_verified', array['https://www.super.kg/article/show/39493'], 11
  )
on conflict (id) do update set
  title = excluded.title, type_label = excluded.type_label,
  cultural_meaning = excluded.cultural_meaning,
  accuracy_level = excluded.accuracy_level, sources = excluded.sources, sort_order = excluded.sort_order;
