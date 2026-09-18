-- Expands age-aware content depth (spec "Expand the existing simple/
-- standard/advanced system beyond the current Boz Uy example") to the
-- next-priority Culture categories: Оймо, Шырдак, Комуз, Улуттук кийим,
-- Кыргыз тамактары, Ат маданияты. Same rule as
-- 20260917000001_culture_items_simple_summary.sql: every simple_summary
-- here is a short, pre-authored distillation of facts already present in
-- that same row's own history/cultural_meaning/etc fields - no new claims,
-- nothing generated at runtime. A row with no simple_summary keeps
-- rendering its full field breakdown exactly as before.
--
-- One flagship row per category was chosen (the most fully-researched
-- item, same standard as "Бешбармак is the one fully-researched food
-- example" per 20260826000001's own comment) rather than every row in
-- every category - most rows in food/clothing are still "sourced name
-- only" with no history/cultural_meaning to distill a summary from yet.
--
-- Улуттук оюндар (games, category id 'games') is NOT included here: no
-- culture_items row exists for Ordo/Chuko/Toguz Korgool yet (checked -
-- only the category label itself was ever seeded), so there is nothing
-- verified to summarize. Per the spec's own rule ("do not fake
-- translations/content if verified text does not exist"), this is left
-- alone rather than inventing a first pass of "history" text here.

update public.culture_items set
  simple_summary_kg = 'Оймо - кыргыздардын кийиз, тери жана жыгач буюмдарында колдонулган кооздук оюулары. Ар бир оюмдун (мисалы, мүйүз, гүл) өзүнүн символдук мааниси бар.'
where id = 'oymo-overview';

update public.culture_items set
  simple_summary_kg = 'Шырдак - эки түстүү кийизден кесилип, кайра тигилип жасалган кыргыз килеми. Бул өнөр 2012-жылы ЮНЕСКОнун маданий мурас тизмесине кирген.'
where id = 'shyrdak-craft';

update public.culture_items set
  simple_summary_kg = 'Комуз - кыргыздын эң байыркы үч кылдуу чертме аспабы, XI кылымдагы жазма булактарда эле эскерилет. Ал баш, моюн, корпус жана үч кылдан турат.'
where id = 'komuz-overview';

update public.culture_items set
  simple_summary_kg = 'Ак калпак - кыргыз эркектеринин ак кийизден жасалган урматтуу баш кийими. Анын төрт кыры Ала-Тоонун карлуу чокуларын билдирет.'
where id = 'clothing-ak-kalpak';

update public.culture_items set
  simple_summary_kg = 'Элечек - турмушка чыккан кыргыз аялынын баш кийими, ыйык буюм катары каралат. Ал карызга берилбейт жана атайын сандыкта сакталат.'
where id = 'clothing-elechek';

update public.culture_items set
  simple_summary_kg = 'Бешбармак - эт, камыр жана пияздан жасалган, конок күтүүдө берилүүчү кыргыздын салттуу тамагы. Аты тамакты кол менен жегенге байланыштуу коюлган.'
where id = 'food-meat-01';

update public.culture_items set
  simple_summary_kg = 'Көк бөрү - ат үстүндө улакты атаандаштардан тартып алып, өз командасынын дарбазасына салуу оюну. Ал 2017-жылы ЮНЕСКОнун Материалдык эмес маданий мурас тизмесине кирген.'
where id = 'horse-kok-boru';

update public.culture_items set
  simple_summary_kg = 'Кыз куумай - кыз менен жигиттин ат чабуу оюну: кыз алдыда чабат, жигит аны кууп жетүүгө аракет кылат. Байыртан жаштардын таанышуу салтынан келип чыккан.'
where id = 'horse-kyz-kuumai';

update public.culture_items set
  simple_summary_kg = 'Ат чабыш - тойдо жана ашта өткөрүлүүчү, аттын күчүн жана чыдамдуулугун сынаган байыркы жарыш. Чабандестер көбүнчө 8-14 жаштагы балдар болушат.'
where id = 'horse-at-chabysh';
