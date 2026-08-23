-- Phase 6f: expand culture_items with 4 more "tradition" subgroups
-- (hospitality, nomadic-labor, festive-spiritual, funeral) ported from
-- content/culture/{hospitality,nomadic-labor,festive-spiritual,funeral}-customs.md,
-- plus new nullable columns to carry the customs-specific card fields that
-- don't map onto the food-oriented columns already on this table
-- (ingredients/traditional_method/when_used), and the one fully-researched
-- write-up (Сүйүнчү) from content/culture/customs-overview.md's worked
-- example.
--
-- type_label classifies what *kind* of thing an item is (custom / customary
-- practice / ritual / rite of passage / festival) - see
-- content/culture/customs-overview.md's "Type label" section. Left null on
-- every term-list-only row below: classifying ~70 items without individual
-- research would be fabricated precision, not honest content. Only
-- Сүйүнчү, which has the full write-up, gets one.
--
-- Item de-duplication: a handful of terms were sent by the user under more
-- than one category (Сүйүнчү/Көрүндүк under both birth and hospitality,
-- Бата берүү under birth/hospitality/festive, Өрүлүктөө and Ашар under
-- both hospitality and nomadic-labor). Each is kept once, under whichever
-- category it was first inserted in this session, rather than duplicated
-- as separate rows - see content/culture's per-file dedup notes for the
-- full reasoning.

alter table public.culture_items
  add column type_label text check (type_label in ('custom', 'practice', 'ritual', 'ceremony', 'festival')),
  add column who_participates text,
  add column objects_used text,
  add column regional_notes text,
  add column modern_status text;

update public.culture_items set
  type_label = 'ritual',
  origin = 'Көчмөн турмушта кабарды тезинен жеткирүү жана жакшы кабарды сыйлоо салтынан келип чыккан.',
  history = 'Байыртадан бери сакталып келе жаткан, жакшы кабар алып келген адамга сый көрсөтүү салты.',
  cultural_meaning = 'Жакшы кабарды баалоо, кабар алып келген адамдын эмгегин сыйлоо; коомдук ынтымакты чагылдырган жөрөлгө.',
  traditional_method = 'Жакшы кабар (мис. бала төрөлгөндө, узак жолдон кабар келгенде) алып келген адамга кабарды укан адам белек же тартуу берет.',
  who_participates = 'Кабар алып келүүчү жана кабарды угуучу — көбүнчө үй-бүлө же жамаат мүчөлөрү.',
  objects_used = 'Катаал белгиленген буюм жок — акча, кездеме, мал же башка баалуу нерсе берилиши мүмкүн.',
  modern_status = 'Азыр да колдонулат, айрыкча үй-бүлөлүк жакшы кабарларда (бала төрөлүү, ийгилик ж.б.).',
  fun_facts = 'Сүйүнчү берүү милдеттүү эмес — ыктыярдуулукка негизделген, бирок аны берүү сый-урмат катары каралат.',
  accuracy_level = 'partially_verified'
where id = 'trad-birth-01';

insert into public.culture_items (id, category_id, subgroup, title, accuracy_level, sort_order) values
  ('trad-hosp-01', 'tradition', 'hospitality', 'Конок тосуу', 'unverified', 35),
  ('trad-hosp-02', 'tradition', 'hospitality', 'Конокту төргө чыгаруу', 'unverified', 36),
  ('trad-hosp-03', 'tradition', 'hospitality', 'Дасторкон жаюу', 'unverified', 37),
  ('trad-hosp-04', 'tradition', 'hospitality', 'Мал союу', 'unverified', 38),
  ('trad-hosp-05', 'tradition', 'hospitality', 'Устукан тартуу', 'unverified', 39),
  ('trad-hosp-06', 'tradition', 'hospitality', 'Табак тартуу', 'unverified', 40),
  ('trad-hosp-07', 'tradition', 'hospitality', 'Баш тартуу', 'unverified', 41),
  ('trad-hosp-08', 'tradition', 'hospitality', 'Бата алуу', 'unverified', 42),
  ('trad-hosp-09', 'tradition', 'hospitality', 'Саламдашуу', 'unverified', 43),
  ('trad-hosp-10', 'tradition', 'hospitality', 'Улууга жол берүү', 'unverified', 44),
  ('trad-hosp-11', 'tradition', 'hospitality', 'Улууну урматтоо', 'unverified', 45),
  ('trad-hosp-12', 'tradition', 'hospitality', 'Кичүүгө ызаат көрсөтүү', 'unverified', 46),
  ('trad-hosp-13', 'tradition', 'hospitality', 'Белек берүү', 'unverified', 47),
  ('trad-hosp-14', 'tradition', 'hospitality', 'Тартуу', 'unverified', 48),
  ('trad-hosp-15', 'tradition', 'hospitality', 'Өрүлүктөө', 'unverified', 49),
  ('trad-hosp-16', 'tradition', 'hospitality', 'Енчи берүү', 'unverified', 50),
  ('trad-hosp-17', 'tradition', 'hospitality', 'Жардамдашуу', 'unverified', 51),
  ('trad-hosp-18', 'tradition', 'hospitality', 'Ашар', 'unverified', 52),
  ('trad-hosp-19', 'tradition', 'hospitality', 'Туугандык мамилени сактоо', 'unverified', 53),

  ('trad-nomad-01', 'tradition', 'nomadic-labor', 'Көчүү', 'unverified', 54),
  ('trad-nomad-02', 'tradition', 'nomadic-labor', 'Жайлоого көчүү', 'unverified', 55),
  ('trad-nomad-03', 'tradition', 'nomadic-labor', 'Кыштоого түшүү', 'unverified', 56),
  ('trad-nomad-04', 'tradition', 'nomadic-labor', 'Конуш тандоо', 'unverified', 57),
  ('trad-nomad-05', 'tradition', 'nomadic-labor', 'Боз үй тигүү', 'unverified', 58),
  ('trad-nomad-06', 'tradition', 'nomadic-labor', 'Боз үй чечүү', 'unverified', 59),
  ('trad-nomad-07', 'tradition', 'nomadic-labor', 'Түндүк көтөрүү', 'unverified', 60),
  ('trad-nomad-08', 'tradition', 'nomadic-labor', 'Малга эн салуу', 'unverified', 61),
  ('trad-nomad-09', 'tradition', 'nomadic-labor', 'Ат коюу (жылкыга ат берүү маанисинде)', 'unverified', 62),
  ('trad-nomad-10', 'tradition', 'nomadic-labor', 'Ат мингизүү', 'unverified', 63),
  ('trad-nomad-11', 'tradition', 'nomadic-labor', 'Ат токуу', 'unverified', 64),
  ('trad-nomad-12', 'tradition', 'nomadic-labor', 'Ат күтүү', 'partially_verified', 65),
  ('trad-nomad-13', 'tradition', 'nomadic-labor', 'Бээ байлоо', 'unverified', 66),
  ('trad-nomad-14', 'tradition', 'nomadic-labor', 'Кымыз ачуу', 'unverified', 67),
  ('trad-nomad-15', 'tradition', 'nomadic-labor', 'Саба бышуу', 'unverified', 68),
  ('trad-nomad-16', 'tradition', 'nomadic-labor', 'Кой кыркуу', 'unverified', 69),
  ('trad-nomad-17', 'tradition', 'nomadic-labor', 'Жүн сабоо', 'unverified', 70),
  ('trad-nomad-18', 'tradition', 'nomadic-labor', 'Кийиз басуу', 'unverified', 71),
  ('trad-nomad-19', 'tradition', 'nomadic-labor', 'Шырдак жасоо', 'unverified', 72),
  ('trad-nomad-20', 'tradition', 'nomadic-labor', 'Туш кийиз жасоо', 'unverified', 73),

  ('trad-fest-01', 'tradition', 'festive-spiritual', 'Нооруз', 'unverified', 74),
  ('trad-fest-02', 'tradition', 'festive-spiritual', 'Нооруз көжө даярдоо', 'unverified', 75),
  ('trad-fest-03', 'tradition', 'festive-spiritual', 'Сүмөлөк кайнатуу', 'unverified', 76),
  ('trad-fest-04', 'tradition', 'festive-spiritual', 'Аластоо', 'unverified', 77),
  ('trad-fest-05', 'tradition', 'festive-spiritual', 'Тилек айтуу', 'unverified', 78),
  ('trad-fest-06', 'tradition', 'festive-spiritual', 'Ак бата', 'unverified', 79),
  ('trad-fest-07', 'tradition', 'festive-spiritual', 'Аксарбашыл айтуу', 'unverified', 80),
  ('trad-fest-08', 'tradition', 'festive-spiritual', 'Садага чабуу', 'unverified', 81),
  ('trad-fest-09', 'tradition', 'festive-spiritual', 'Түлөө өткөрүү', 'unverified', 82),
  ('trad-fest-10', 'tradition', 'festive-spiritual', 'Жаратылышка байланыштуу ырым-жырымдар', 'unverified', 83),
  ('trad-fest-11', 'tradition', 'festive-spiritual', 'Жайлоого чыгуу салтанаты', 'unverified', 84),
  ('trad-fest-12', 'tradition', 'festive-spiritual', 'Түшүм жыйноого байланышкан салттар', 'unverified', 85),

  ('trad-funeral-01', 'tradition', 'funeral', 'Кабар айтуу', 'unverified', 86),
  ('trad-funeral-02', 'tradition', 'funeral', 'Угузуу', 'unverified', 87),
  ('trad-funeral-03', 'tradition', 'funeral', 'Кошок кошуу', 'unverified', 88),
  ('trad-funeral-04', 'tradition', 'funeral', 'Өкүрүү', 'unverified', 89),
  ('trad-funeral-05', 'tradition', 'funeral', 'Тул көтөрүү', 'unverified', 90),
  ('trad-funeral-06', 'tradition', 'funeral', 'Сөөк жуу', 'unverified', 91),
  ('trad-funeral-07', 'tradition', 'funeral', 'Кепиндөө', 'unverified', 92),
  ('trad-funeral-08', 'tradition', 'funeral', 'Жаназа', 'unverified', 93),
  ('trad-funeral-09', 'tradition', 'funeral', 'Сөөк коюу', 'unverified', 94),
  ('trad-funeral-10', 'tradition', 'funeral', 'Топурак салуу', 'unverified', 95),
  ('trad-funeral-11', 'tradition', 'funeral', 'Жыртыш берүү', 'unverified', 96),
  ('trad-funeral-12', 'tradition', 'funeral', 'Көңүл айтуу', 'unverified', 97),
  ('trad-funeral-13', 'tradition', 'funeral', 'Кара кийүү', 'unverified', 98),
  ('trad-funeral-14', 'tradition', 'funeral', 'Кара аш', 'unverified', 99),
  ('trad-funeral-15', 'tradition', 'funeral', 'Үчтүгү', 'unverified', 100),
  ('trad-funeral-16', 'tradition', 'funeral', 'Жетилиги', 'unverified', 101),
  ('trad-funeral-17', 'tradition', 'funeral', 'Кыркы', 'unverified', 102),
  ('trad-funeral-18', 'tradition', 'funeral', 'Жылдыгы', 'unverified', 103),
  ('trad-funeral-19', 'tradition', 'funeral', 'Аш берүү', 'unverified', 104)
;

update public.culture_items set
  sources = array['https://encyclopedia.edu.kg/KyrgWiki/index.php?title=%D0%90%D0%A2_%D0%9A%D2%AE%D0%A2%D2%AE%D2%AE_%D0%A1%D0%90%D0%9B%D0%A2%D0%AB']
where id = 'trad-nomad-12';
