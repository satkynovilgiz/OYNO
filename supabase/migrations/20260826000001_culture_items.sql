-- Phase 6e: culture_items - structured per-item content for Culture
-- categories (customs, dishes, and other entries), separate from
-- culture_materials (which stays the "reading/video/game/daily
-- discovery" feed on the Culture home screen). Rows here back the new
-- category detail and item detail screens.
--
-- Content is a mix of maturity levels by design, tracked via
-- accuracy_level: most rows right now are just a sourced name (title +
-- sources, everything else null) because only the term list has been
-- researched so far - see content/culture/*.md for the source material
-- these were ported from. A handful of rows (Бешбармак) have the full
-- write-up. Both are valid states, not a bug - the detail screen must
-- render gracefully when the optional fields are null.

create table public.culture_items (
  id text primary key,
  category_id text not null references public.culture_categories(id),
  subgroup text,
  title text not null,
  alt_names text,
  origin text,
  history text,
  cultural_meaning text,
  when_used text,
  ingredients text,
  traditional_method text,
  fun_facts text,
  accuracy_level text not null check (accuracy_level in ('verified', 'partially_verified', 'unverified')),
  sources text[],
  sort_order int not null
);

alter table public.culture_items enable row level security;
create policy "public read culture items" on public.culture_items for select using (true);

-- Seed: ported from content/culture/birth-customs.md (tradition category,
-- 15 terms, single source, no per-term detail yet), content/culture/food.md
-- (food category, 4 subgroups; Бешбармак is the one fully-researched
-- example, everything else is a sourced name only), and the 3 real Boz Üy
-- photos added to assets/img/OYNO_design/culture/boz_uy/ (no write-up text
-- for Boz Üy itself yet, just an item row so the photos have somewhere to
-- attach in the UI).
insert into public.culture_items (
  id, category_id, subgroup, title, alt_names, origin, history, cultural_meaning, when_used, ingredients, traditional_method, fun_facts, accuracy_level, sources, sort_order
) values
  ('trad-birth-01', 'tradition', 'birth-and-childhood', 'Сүйүнчү', null, null, null, null, null, null, null, null, 'unverified', array['https://open.kg/ky/about-kyrgyzstan/culture/mores/34731-obryady-svyazannye-s-rozhdeniem-i-vospitaniem-rebenka-u-kirgizov-iz-obryadovoy-zhizni-kyrgyzov-nachala-xx-veka-chast-10.html'], 0),
  ('trad-birth-02', 'tradition', 'birth-and-childhood', 'Көрүндүк', null, null, null, null, null, null, null, null, 'unverified', array['https://open.kg/ky/about-kyrgyzstan/culture/mores/34731-obryady-svyazannye-s-rozhdeniem-i-vospitaniem-rebenka-u-kirgizov-iz-obryadovoy-zhizni-kyrgyzov-nachala-xx-veka-chast-10.html'], 1),
  ('trad-birth-03', 'tradition', 'birth-and-childhood', 'Жентек', null, null, null, null, null, null, null, null, 'unverified', array['https://open.kg/ky/about-kyrgyzstan/culture/mores/34731-obryady-svyazannye-s-rozhdeniem-i-vospitaniem-rebenka-u-kirgizov-iz-obryadovoy-zhizni-kyrgyzov-nachala-xx-veka-chast-10.html'], 2),
  ('trad-birth-04', 'tradition', 'birth-and-childhood', 'Ат коюу', null, null, null, null, null, null, null, null, 'unverified', array['https://open.kg/ky/about-kyrgyzstan/culture/mores/34731-obryady-svyazannye-s-rozhdeniem-i-vospitaniem-rebenka-u-kirgizov-iz-obryadovoy-zhizni-kyrgyzov-nachala-xx-veka-chast-10.html'], 3),
  ('trad-birth-05', 'tradition', 'birth-and-childhood', 'Азан чакырып ат коюу', null, null, null, null, null, null, null, null, 'unverified', array['https://open.kg/ky/about-kyrgyzstan/culture/mores/34731-obryady-svyazannye-s-rozhdeniem-i-vospitaniem-rebenka-u-kirgizov-iz-obryadovoy-zhizni-kyrgyzov-nachala-xx-veka-chast-10.html'], 4),
  ('trad-birth-06', 'tradition', 'birth-and-childhood', 'Киндик кесүү / киндик эне', null, null, null, null, null, null, null, null, 'unverified', array['https://open.kg/ky/about-kyrgyzstan/culture/mores/34731-obryady-svyazannye-s-rozhdeniem-i-vospitaniem-rebenka-u-kirgizov-iz-obryadovoy-zhizni-kyrgyzov-nachala-xx-veka-chast-10.html'], 5),
  ('trad-birth-07', 'tradition', 'birth-and-childhood', 'Бешик той', null, null, null, null, null, null, null, null, 'unverified', array['https://open.kg/ky/about-kyrgyzstan/culture/mores/34731-obryady-svyazannye-s-rozhdeniem-i-vospitaniem-rebenka-u-kirgizov-iz-obryadovoy-zhizni-kyrgyzov-nachala-xx-veka-chast-10.html'], 6),
  ('trad-birth-08', 'tradition', 'birth-and-childhood', 'Бешикке салуу', null, null, null, null, null, null, null, null, 'unverified', array['https://open.kg/ky/about-kyrgyzstan/culture/mores/34731-obryady-svyazannye-s-rozhdeniem-i-vospitaniem-rebenka-u-kirgizov-iz-obryadovoy-zhizni-kyrgyzov-nachala-xx-veka-chast-10.html'], 7),
  ('trad-birth-09', 'tradition', 'birth-and-childhood', 'Кыркын чыгаруу', null, null, null, null, null, null, null, null, 'unverified', array['https://open.kg/ky/about-kyrgyzstan/culture/mores/34731-obryady-svyazannye-s-rozhdeniem-i-vospitaniem-rebenka-u-kirgizov-iz-obryadovoy-zhizni-kyrgyzov-nachala-xx-veka-chast-10.html'], 8),
  ('trad-birth-10', 'tradition', 'birth-and-childhood', 'Карын чачын алуу', null, null, null, null, null, null, null, null, 'unverified', array['https://open.kg/ky/about-kyrgyzstan/culture/mores/34731-obryady-svyazannye-s-rozhdeniem-i-vospitaniem-rebenka-u-kirgizov-iz-obryadovoy-zhizni-kyrgyzov-nachala-xx-veka-chast-10.html'], 9),
  ('trad-birth-11', 'tradition', 'birth-and-childhood', 'Карын тырмагын алуу', null, null, null, null, null, null, null, null, 'unverified', array['https://open.kg/ky/about-kyrgyzstan/culture/mores/34731-obryady-svyazannye-s-rozhdeniem-i-vospitaniem-rebenka-u-kirgizov-iz-obryadovoy-zhizni-kyrgyzov-nachala-xx-veka-chast-10.html'], 10),
  ('trad-birth-12', 'tradition', 'birth-and-childhood', 'Тушоо кесүү', null, null, null, null, null, null, null, null, 'unverified', array['https://open.kg/ky/about-kyrgyzstan/culture/mores/34731-obryady-svyazannye-s-rozhdeniem-i-vospitaniem-rebenka-u-kirgizov-iz-obryadovoy-zhizni-kyrgyzov-nachala-xx-veka-chast-10.html'], 11),
  ('trad-birth-13', 'tradition', 'birth-and-childhood', 'Сүннөткө отургузуу', null, null, null, null, null, null, null, null, 'unverified', array['https://open.kg/ky/about-kyrgyzstan/culture/mores/34731-obryady-svyazannye-s-rozhdeniem-i-vospitaniem-rebenka-u-kirgizov-iz-obryadovoy-zhizni-kyrgyzov-nachala-xx-veka-chast-10.html'], 12),
  ('trad-birth-14', 'tradition', 'birth-and-childhood', 'Сүннөт той', null, null, null, null, null, null, null, null, 'unverified', array['https://open.kg/ky/about-kyrgyzstan/culture/mores/34731-obryady-svyazannye-s-rozhdeniem-i-vospitaniem-rebenka-u-kirgizov-iz-obryadovoy-zhizni-kyrgyzov-nachala-xx-veka-chast-10.html'], 13),
  ('trad-birth-15', 'tradition', 'birth-and-childhood', 'Бата берүү', null, null, null, null, null, null, null, null, 'unverified', array['https://open.kg/ky/about-kyrgyzstan/culture/mores/34731-obryady-svyazannye-s-rozhdeniem-i-vospitaniem-rebenka-u-kirgizov-iz-obryadovoy-zhizni-kyrgyzov-nachala-xx-veka-chast-10.html'], 14),
  ('food-meat-02', 'food', 'meat', 'Нарын', null, null, null, null, null, null, null, null, 'unverified', array['https://sputnik.kg/20171128/ehtten-zhasalgan-kyrgyzdan-ehzelki-tamaktary-1036549985.html'], 101),
  ('food-meat-03', 'food', 'meat', 'Куурдак', null, null, null, null, null, null, null, null, 'unverified', array['https://sputnik.kg/20171128/ehtten-zhasalgan-kyrgyzdan-ehzelki-tamaktary-1036549985.html'], 102),
  ('food-meat-04', 'food', 'meat', 'Шорпо / сорпо', null, null, null, null, null, null, null, null, 'unverified', array['https://sputnik.kg/20171128/ehtten-zhasalgan-kyrgyzdan-ehzelki-tamaktary-1036549985.html'], 103),
  ('food-meat-05', 'food', 'meat', 'Күлчөтай / гүлчөтай', null, null, null, null, null, null, null, null, 'unverified', array['https://sputnik.kg/20171128/ehtten-zhasalgan-kyrgyzdan-ehzelki-tamaktary-1036549985.html'], 104),
  ('food-meat-06', 'food', 'meat', 'Чучук', null, null, null, null, null, null, null, null, 'unverified', array['https://sputnik.kg/20171128/ehtten-zhasalgan-kyrgyzdan-ehzelki-tamaktary-1036549985.html'], 105),
  ('food-meat-07', 'food', 'meat', 'Казы', null, null, null, null, null, null, null, null, 'unverified', array['https://sputnik.kg/20171128/ehtten-zhasalgan-kyrgyzdan-ehzelki-tamaktary-1036549985.html'], 106),
  ('food-meat-08', 'food', 'meat', 'Карта', null, null, null, null, null, null, null, null, 'unverified', array['https://sputnik.kg/20171128/ehtten-zhasalgan-kyrgyzdan-ehzelki-tamaktary-1036549985.html'], 107),
  ('food-meat-09', 'food', 'meat', 'Жал', null, null, null, null, null, null, null, null, 'unverified', array['https://sputnik.kg/20171128/ehtten-zhasalgan-kyrgyzdan-ehzelki-tamaktary-1036549985.html'], 108),
  ('food-meat-10', 'food', 'meat', 'Жая', null, null, null, null, null, null, null, null, 'unverified', array['https://sputnik.kg/20171128/ehtten-zhasalgan-kyrgyzdan-ehzelki-tamaktary-1036549985.html'], 109),
  ('food-meat-11', 'food', 'meat', 'Быжы', null, null, null, null, null, null, null, null, 'unverified', array['https://sputnik.kg/20171128/ehtten-zhasalgan-kyrgyzdan-ehzelki-tamaktary-1036549985.html'], 110),
  ('food-meat-12', 'food', 'meat', 'Жөргөм', null, null, null, null, null, null, null, null, 'unverified', array['https://sputnik.kg/20171128/ehtten-zhasalgan-kyrgyzdan-ehzelki-tamaktary-1036549985.html'], 111),
  ('food-meat-13', 'food', 'meat', 'Олобо', null, null, null, null, null, null, null, null, 'unverified', array['https://sputnik.kg/20171128/ehtten-zhasalgan-kyrgyzdan-ehzelki-tamaktary-1036549985.html'], 112),
  ('food-meat-14', 'food', 'meat', 'Керчөө', null, null, null, null, null, null, null, null, 'unverified', array['https://sputnik.kg/20171128/ehtten-zhasalgan-kyrgyzdan-ehzelki-tamaktary-1036549985.html'], 113),
  ('food-meat-15', 'food', 'meat', 'Үлбүрчөк', null, null, null, null, null, null, null, null, 'unverified', array['https://sputnik.kg/20171128/ehtten-zhasalgan-kyrgyzdan-ehzelki-tamaktary-1036549985.html'], 114),
  ('food-meat-16', 'food', 'meat', 'Боор', null, null, null, null, null, null, null, null, 'unverified', array['https://sputnik.kg/20171128/ehtten-zhasalgan-kyrgyzdan-ehzelki-tamaktary-1036549985.html'], 115),
  ('food-meat-17', 'food', 'meat', 'Куйрук-боор', null, null, null, null, null, null, null, null, 'unverified', array['https://sputnik.kg/20171128/ehtten-zhasalgan-kyrgyzdan-ehzelki-tamaktary-1036549985.html'], 116),
  ('food-meat-18', 'food', 'meat', 'Таш кордо', null, null, null, null, null, null, null, null, 'unverified', array['https://sputnik.kg/20171128/ehtten-zhasalgan-kyrgyzdan-ehzelki-tamaktary-1036549985.html'], 117),
  ('food-meat-19', 'food', 'meat', 'Гүлазык', null, null, null, null, null, null, null, null, 'unverified', array['https://sputnik.kg/20171128/ehtten-zhasalgan-kyrgyzdan-ehzelki-tamaktary-1036549985.html'], 118),
  ('food-meat-20', 'food', 'meat', 'Устукан / бышкан эт', null, null, null, null, null, null, null, null, 'unverified', array['https://sputnik.kg/20171128/ehtten-zhasalgan-kyrgyzdan-ehzelki-tamaktary-1036549985.html'], 119),
  ('food-meat-01', 'food', 'meat', 'Бешбармак', 'Беш бармак', 'Көчмөн мал чарбачылыгынын негизинде калыптанган эт тамактарынын бири.', 'Айрым этнографиялык маалыматтарда кыргыздар адегенде этти майдалап, чык менен жеп, кийинчерээк ага кесме кошула баштаганы айтылат.', 'Конок күтүү жана эт тартуу салты менен байланыштуу.', 'Конок тосууда, тойдо, ашта, үй-бүлөлүк салтанаттарда.', 'Эт, камыр, пияз, сорпо.', 'Эт кайнатылат → камыр жука жайылып кесилет → эттин сорпосунда камыр бышырылат → эт майда тууралат → пияз жана сорподон чык даярдалат → баары кошулуп берилет.', '"Беш бармак" аталышы тамакты салт боюнча кол менен жегендикке байланыштуу түшүндүрүлөт.', 'partially_verified', array['https://open.kg/ky/about-kyrgyzstan/culture/kyrgyz-cuisine/main-dishes-of-kyrgyzstan/35414-beshbarmak-po-kirgizski.html'], 100),
  ('food-dairy-01', 'food', 'dairy', 'Сүт', null, null, null, null, null, null, null, null, 'unverified', array['https://www.kyrgyztil.taalimforum.kg/index.php/user/reader/33?id1=995&id2=996&id3=997&pc=28&pid=group&t=142'], 200),
  ('food-dairy-02', 'food', 'dairy', 'Айран', null, null, null, null, null, null, null, null, 'unverified', array['https://www.kyrgyztil.taalimforum.kg/index.php/user/reader/33?id1=995&id2=996&id3=997&pc=28&pid=group&t=142'], 201),
  ('food-dairy-03', 'food', 'dairy', 'Каймак', null, null, null, null, null, null, null, null, 'unverified', array['https://www.kyrgyztil.taalimforum.kg/index.php/user/reader/33?id1=995&id2=996&id3=997&pc=28&pid=group&t=142'], 202),
  ('food-dairy-04', 'food', 'dairy', 'Сары май', null, null, null, null, null, null, null, null, 'unverified', array['https://www.kyrgyztil.taalimforum.kg/index.php/user/reader/33?id1=995&id2=996&id3=997&pc=28&pid=group&t=142'], 203),
  ('food-dairy-05', 'food', 'dairy', 'Курут', null, null, null, null, null, null, null, null, 'unverified', array['https://www.kyrgyztil.taalimforum.kg/index.php/user/reader/33?id1=995&id2=996&id3=997&pc=28&pid=group&t=142'], 204),
  ('food-dairy-06', 'food', 'dairy', 'Сүзмө', null, null, null, null, null, null, null, null, 'unverified', array['https://www.kyrgyztil.taalimforum.kg/index.php/user/reader/33?id1=995&id2=996&id3=997&pc=28&pid=group&t=142'], 205),
  ('food-dairy-07', 'food', 'dairy', 'Быштак', null, null, null, null, null, null, null, null, 'unverified', array['https://www.kyrgyztil.taalimforum.kg/index.php/user/reader/33?id1=995&id2=996&id3=997&pc=28&pid=group&t=142'], 206),
  ('food-dairy-08', 'food', 'dairy', 'Эжигей', null, null, null, null, null, null, null, null, 'unverified', array['https://www.kyrgyztil.taalimforum.kg/index.php/user/reader/33?id1=995&id2=996&id3=997&pc=28&pid=group&t=142'], 207),
  ('food-dairy-09', 'food', 'dairy', 'Чөбөгө', null, null, null, null, null, null, null, null, 'unverified', array['https://www.kyrgyztil.taalimforum.kg/index.php/user/reader/33?id1=995&id2=996&id3=997&pc=28&pid=group&t=142'], 208),
  ('food-dairy-10', 'food', 'dairy', 'Кайнатылган сүт', null, null, null, null, null, null, null, null, 'unverified', array['https://www.kyrgyztil.taalimforum.kg/index.php/user/reader/33?id1=995&id2=996&id3=997&pc=28&pid=group&t=142'], 209),
  ('food-dairy-11', 'food', 'dairy', 'Ууз', null, null, null, null, null, null, null, null, 'unverified', array['https://www.kyrgyztil.taalimforum.kg/index.php/user/reader/33?id1=995&id2=996&id3=997&pc=28&pid=group&t=142'], 210),
  ('food-dairy-12', 'food', 'dairy', 'Ууз сүт', null, null, null, null, null, null, null, null, 'unverified', array['https://www.kyrgyztil.taalimforum.kg/index.php/user/reader/33?id1=995&id2=996&id3=997&pc=28&pid=group&t=142'], 211),
  ('food-dairy-13', 'food', 'dairy', 'Катык', null, null, null, null, null, null, null, null, 'unverified', array['https://www.kyrgyztil.taalimforum.kg/index.php/user/reader/33?id1=995&id2=996&id3=997&pc=28&pid=group&t=142'], 212),
  ('food-grain-01', 'food', 'grain', 'Боорсок', null, null, null, null, null, null, null, null, 'unverified', array['https://www.scribd.com/document/869438920/%D0%B4%D0%B0%D0%BD-%D0%B0%D0%B7%D1%8B%D0%BA%D1%82%D0%B0%D1%80%D1%8B'], 300),
  ('food-grain-02', 'food', 'grain', 'Чий боорсок', null, null, null, null, null, null, null, null, 'unverified', array['https://www.scribd.com/document/869438920/%D0%B4%D0%B0%D0%BD-%D0%B0%D0%B7%D1%8B%D0%BA%D1%82%D0%B0%D1%80%D1%8B'], 301),
  ('food-grain-03', 'food', 'grain', 'Күлчө', null, null, null, null, null, null, null, null, 'unverified', array['https://www.scribd.com/document/869438920/%D0%B4%D0%B0%D0%BD-%D0%B0%D0%B7%D1%8B%D0%BA%D1%82%D0%B0%D1%80%D1%8B'], 302),
  ('food-grain-04', 'food', 'grain', 'Калама', null, null, null, null, null, null, null, null, 'unverified', array['https://www.scribd.com/document/869438920/%D0%B4%D0%B0%D0%BD-%D0%B0%D0%B7%D1%8B%D0%BA%D1%82%D0%B0%D1%80%D1%8B'], 303),
  ('food-grain-05', 'food', 'grain', 'Каттама', null, null, null, null, null, null, null, null, 'unverified', array['https://www.scribd.com/document/869438920/%D0%B4%D0%B0%D0%BD-%D0%B0%D0%B7%D1%8B%D0%BA%D1%82%D0%B0%D1%80%D1%8B'], 304),
  ('food-grain-06', 'food', 'grain', 'Жупка', null, null, null, null, null, null, null, null, 'unverified', array['https://www.scribd.com/document/869438920/%D0%B4%D0%B0%D0%BD-%D0%B0%D0%B7%D1%8B%D0%BA%D1%82%D0%B0%D1%80%D1%8B'], 305),
  ('food-grain-07', 'food', 'grain', 'Чабаты', null, null, null, null, null, null, null, null, 'unverified', array['https://www.scribd.com/document/869438920/%D0%B4%D0%B0%D0%BD-%D0%B0%D0%B7%D1%8B%D0%BA%D1%82%D0%B0%D1%80%D1%8B'], 306),
  ('food-grain-08', 'food', 'grain', 'Токоч', null, null, null, null, null, null, null, null, 'unverified', array['https://www.scribd.com/document/869438920/%D0%B4%D0%B0%D0%BD-%D0%B0%D0%B7%D1%8B%D0%BA%D1%82%D0%B0%D1%80%D1%8B'], 307),
  ('food-grain-09', 'food', 'grain', 'Тандыр нан', null, null, null, null, null, null, null, null, 'unverified', array['https://www.scribd.com/document/869438920/%D0%B4%D0%B0%D0%BD-%D0%B0%D0%B7%D1%8B%D0%BA%D1%82%D0%B0%D1%80%D1%8B'], 308),
  ('food-grain-10', 'food', 'grain', 'Көмөч', null, null, null, null, null, null, null, null, 'unverified', array['https://www.scribd.com/document/869438920/%D0%B4%D0%B0%D0%BD-%D0%B0%D0%B7%D1%8B%D0%BA%D1%82%D0%B0%D1%80%D1%8B'], 309),
  ('food-grain-11', 'food', 'grain', 'Талкан', null, null, null, null, null, null, null, null, 'unverified', array['https://www.scribd.com/document/869438920/%D0%B4%D0%B0%D0%BD-%D0%B0%D0%B7%D1%8B%D0%BA%D1%82%D0%B0%D1%80%D1%8B'], 310),
  ('food-grain-12', 'food', 'grain', 'Атала', null, null, null, null, null, null, null, null, 'unverified', array['https://www.scribd.com/document/869438920/%D0%B4%D0%B0%D0%BD-%D0%B0%D0%B7%D1%8B%D0%BA%D1%82%D0%B0%D1%80%D1%8B'], 311),
  ('food-grain-13', 'food', 'grain', 'Ботко', null, null, null, null, null, null, null, null, 'unverified', array['https://www.scribd.com/document/869438920/%D0%B4%D0%B0%D0%BD-%D0%B0%D0%B7%D1%8B%D0%BA%D1%82%D0%B0%D1%80%D1%8B'], 312),
  ('food-grain-14', 'food', 'grain', 'Кесме', null, null, null, null, null, null, null, null, 'unverified', array['https://www.scribd.com/document/869438920/%D0%B4%D0%B0%D0%BD-%D0%B0%D0%B7%D1%8B%D0%BA%D1%82%D0%B0%D1%80%D1%8B'], 313),
  ('food-grain-15', 'food', 'grain', 'Көжө', null, null, null, null, null, null, null, null, 'unverified', array['https://www.scribd.com/document/869438920/%D0%B4%D0%B0%D0%BD-%D0%B0%D0%B7%D1%8B%D0%BA%D1%82%D0%B0%D1%80%D1%8B'], 314),
  ('food-grain-16', 'food', 'grain', 'Көчө', null, null, null, null, null, null, null, null, 'unverified', array['https://www.scribd.com/document/869438920/%D0%B4%D0%B0%D0%BD-%D0%B0%D0%B7%D1%8B%D0%BA%D1%82%D0%B0%D1%80%D1%8B'], 315),
  ('food-grain-17', 'food', 'grain', 'Май токоч', null, null, null, null, null, null, null, null, 'unverified', array['https://www.scribd.com/document/869438920/%D0%B4%D0%B0%D0%BD-%D0%B0%D0%B7%D1%8B%D0%BA%D1%82%D0%B0%D1%80%D1%8B'], 316),
  ('food-beverage-01', 'food', 'beverage', 'Кымыз', null, null, null, null, null, null, null, null, 'unverified', array['https://www.super.kg/article/show/911'], 400),
  ('food-beverage-02', 'food', 'beverage', 'Саамал', null, null, null, null, null, null, null, null, 'unverified', array['https://www.super.kg/article/show/911'], 401),
  ('food-beverage-03', 'food', 'beverage', 'Максым', null, null, null, null, null, null, null, null, 'unverified', array['https://www.super.kg/article/show/911'], 402),
  ('food-beverage-04', 'food', 'beverage', 'Жарма', null, null, null, null, null, null, null, null, 'unverified', array['https://www.super.kg/article/show/911'], 403),
  ('food-beverage-05', 'food', 'beverage', 'Бозо', null, null, null, null, null, null, null, null, 'unverified', array['https://www.super.kg/article/show/911'], 404),
  ('food-beverage-06', 'food', 'beverage', 'Чалап', null, null, null, null, null, null, null, null, 'unverified', array['https://www.super.kg/article/show/911'], 405),
  ('food-beverage-07', 'food', 'beverage', 'Кымыран', null, null, null, null, null, null, null, null, 'unverified', array['https://www.super.kg/article/show/911'], 406),
  ('food-beverage-08', 'food', 'beverage', 'Ак серке', null, null, null, null, null, null, null, null, 'unverified', array['https://www.super.kg/article/show/911'], 407),
  ('food-beverage-09', 'food', 'beverage', 'Куурума чай', null, null, null, null, null, null, null, null, 'unverified', array['https://www.super.kg/article/show/911'], 408),
  ('food-beverage-10', 'food', 'beverage', 'Сүт чай', null, null, null, null, null, null, null, null, 'unverified', array['https://www.super.kg/article/show/911'], 409),
  ('food-beverage-11', 'food', 'beverage', 'Актаган чай', null, null, null, null, null, null, null, null, 'unverified', array['https://www.super.kg/article/show/911'], 410),
  ('boz-uy-overview', 'boz-uy', null, 'Боз үй', null, null, null, null, null, null, null, null, 'unverified', null, 0)
;