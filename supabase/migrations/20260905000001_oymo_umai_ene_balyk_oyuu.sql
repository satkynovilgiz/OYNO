-- Two new culture_items rows under the existing 'oymo' category, giving
-- the Culture > Оймо list two real photo+description cards (Умай эне,
-- Балык оюу), alongside the existing 'oymo-overview' row. Content sourced
-- from reference photos + notes supplied directly by the user (not a new
-- web-research pass) - Umai Ene came with citation links, translated/
-- condensed here into Kyrgyz to match every other row in this table;
-- Balyk oyuu came already in Kyrgyz with no citation link, so it's marked
-- 'unverified' rather than 'partially_verified' like its sibling. Photos
-- themselves live in assets/img/OYNO_design/culture/oymo/ and are wired
-- via the local cultureItemImages map (src/features/culture/data.ts), the
-- same pattern boz-uy-overview already uses - not image_url, since these
-- are bundled app assets, not Storage-uploaded ones.

insert into public.culture_items (
  id, category_id, subgroup, title, type_label, origin, cultural_meaning, fun_facts, accuracy_level, sources, sort_order
) values
  (
    'oymo-umai-ene', 'oymo', null, 'Умай эне', 'custom',
    'Умай эне - түрк элдеринин байыркы диний ишенимдериндеги балдар менен төрөлүүчүлөрдүн колдоочусу катары кабыл алынган ыйык эне-кудай.',
    'Умай эненин оймосу - түрк элдеринин ыйык белгиси, байыркы кудайдын элесин чагылдырат. Кыргыздарда жана Борбордук Азиянын башка көчмөн элдеринде бул белги аялдык башталышты, энелик асылдыкты, ошондой эле балдарды жана үй-очокту коргоону билдирет.',
    'Салт боюнча бул белги балдардын кийимине жана баш кийимине (мисалы, балдардын ак калпагына) сайылып, аны ооруудан жана жаман күчтөрдөн сактайт деп ишенишкен. Баланын уйкудагы жылмайышы Умай эненин катышуусун билдирет деген ишеним да бар.',
    'partially_verified',
    array[
      'https://www.facebook.com/mozgamistudio/posts/%D1%80%D0%B0%D0%B7%D1%80%D0%B0%D0%B1%D0%BE%D1%82%D0%B0%D0%BB%D0%B8-%D0%BD%D0%BE%D0%B2%D1%8B%D0%B9-%D0%BB%D0%BE%D0%B3%D0%BE-%D0%B4%D0%BB%D1%8F-%D0%B0%D1%81%D1%81%D0%BE%D1%86%D0%B8%D0%B0%D1%86%D0%B8%D0%B8-%D0%B6%D0%B5%D0%BD%D1%81%D0%BA%D0%BE%D0%B3%D0%BE-%D1%84%D1%83%D1%82%D0%B1%D0%BE%D0%BB%D0%B0-%D0%BA%D1%80-kyzdarkurama%D0%B8%D0%B4%D0%B5%D1%8F-%D0%B7%D0%BD%D0%B0%D0%BA%D0%B0/1728933898545266/',
      'https://el.kz/ru/boginya-umay-i-ee-znachenie-dlya-tyurkskih-narodov_40722/',
      'https://www.molbulak.ru/news/chaykhana/umay-ene-pokrovitelnitsa-vsekh-materey-i-mladentsev',
      'https://24.kg/obschestvo/288268_nasledie_predkov_kakie_ornamentyi_doljnyi_byit_nanbspaknbspkalpake/',
      'https://altaycorpus.ru/Word?wordId=5467',
      'https://ru.wikipedia.org/wiki/%D0%A3%D0%BC%D0%B0%D0%B9',
      'https://www.instagram.com/p/C6OEZ9LiOXr/'
    ],
    1
  ),
  (
    'oymo-balyk-oyuu', 'oymo', null, 'Балык оюу', 'custom',
    'Балык оюу - кыргыз жана башка көчмөн элдердин улуттук оймо-чиймелеринде кеңири колдонулган, сууда сүзүүчү балыктын формасын же анын элементтерин (кабырчыгын, куйругун) элестеткен геометриялык жана зооморфтук орнамент.',
    'Салттуу түшүнүктө балык - молчулуктун, берекенин, тазалыктын жана өсүп-өнүгүүнүн символу. Суу өмүрдүн булагы болгондуктан, бул оюу жашоонун түбөлүктүүлүгүн да туюнтат.',
    'Бул оюу көбүнчө кийиз буюмдарында (шырдак, ала кийиз), туш кийиздерде, жыгач узанууда жана зергерчиликте кездешет. Кээде балыктын куйругу же кабырчыгы өзүнчө элемент катары кайталанып чийилет.',
    'unverified',
    null,
    2
  )
on conflict (id) do update set
  title = excluded.title, type_label = excluded.type_label, origin = excluded.origin,
  cultural_meaning = excluded.cultural_meaning, fun_facts = excluded.fun_facts,
  accuracy_level = excluded.accuracy_level, sources = excluded.sources, sort_order = excluded.sort_order;
