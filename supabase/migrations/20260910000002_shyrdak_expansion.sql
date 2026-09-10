-- Expands the 'shyrdak' Culture category beyond its single overview row
-- (shyrdak-craft, added by 20260829000005) with 3 more researched entries:
-- ala-kiyiz (the sister felting technique), color/pattern symbolism, and
-- the At-Bashy regional tradition. Same research standard as the horse
-- migration (20260910000001): a web pass over ru/ky Wikipedia, super.kg,
-- and kghistory.akipress.org, not deep ethnographic cross-verification,
-- so accuracy_level stays 'partially_verified'.
--
-- Photos: Wikimedia Commons, CC BY / CC BY-SA, bundled at
-- assets/img/OYNO_design/culture/shyrdak/ and wired via cultureItemImages
-- (src/features/culture/data.ts). Each image-bearing row's sources array
-- includes the Commons file page (not the raw image URL) so the CC BY-SA
-- attribution chain stays reachable from the detail screen's source links.
--
-- shyrdak-at-bashy has no bundled photo - no properly-licensed photo of
-- At-Bashy district's shyrdak masters/festival was found on Commons at
-- research time; better to omit than mismatch with a generic felt photo.

-- shyrdak-craft: only touching alt_names + appending one more Commons
-- source. Deliberately NOT touching title/origin/history/cultural_meaning/
-- etc. - that content was already researched and written in
-- 20260829000005_boz_uy_oymo_shyrdak_content.sql and must not be clobbered.
update public.culture_items set
  alt_names = 'Шырымал, төрбөлжүн, оймо теке, ободо, түр кийиз (аймактык аталыштары)',
  sources = array[
    'https://ru.wikipedia.org/wiki/%D0%A8%D0%B8%D1%80%D0%B4%D0%B0%D0%BA',
    'https://eurasia.travel/ru/kyrgyzstan/culture/carpets/shyrdak/',
    'https://commons.wikimedia.org/wiki/File:Kyrgyz_design_felt_rugs.jpg'
  ]
where id = 'shyrdak-craft';

insert into public.culture_items (
  id, category_id, subgroup, title, alt_names, type_label, origin, history, cultural_meaning,
  when_used, objects_used, traditional_method, modern_status, fun_facts,
  accuracy_level, sources, sort_order
) values
  (
    'shyrdak-ala-kiyiz', 'shyrdak', null, 'Ала кийиз', null, 'custom',
    'Шырдак менен бир тектеш, бирок башка ыкма менен жасалган кийиз түрү.',
    null,
    'Ала кийиз - түр-оюм түшүрүлүп, уютулуп жасалган кийиз, ал эми шырдак - кабатталган кош кийизге түс-оюм түшүрүлүп, шырылган кийиз. Башкача айтканда: ала кийизде оюм жүн уютулуп жатканда эле кийиздин ичине сиңирилет, ал эми шырдакта даяр кийизден бычак менен кесилип, кайра тигилет. Ушундан улам ала кийиздин четтери жумшак, оюму бүдөмүктөр, ал эми шырдактыкы курч жана так болот.',
    'Боз үйдүн ичине төшөлүп, дубалына илинип колдонулган; азыр да үй ичин жасалгалоодо колдонулат.',
    'Кылчыксыз жүн, ысык суу, чий (ноон таякчадан токулган төшөнчү), аркан.',
    'Сабалган жүн белгилүү өлчөмдө чийдин үстүнө жайылат, түстүү жүн менен оюм түзүлөт, анан баары ысык суу куюлуп чийге ороло консилдирилип тепселет же тебетилет - бул көп жолу кайталанат, жүн бекем кийизге айланганча. Бул процесс бир нече адамдын биргелешкен күчүн талап кылат.',
    '2012-жылы ЮНЕСКОнун Материалдык эмес маданий мурас тизмесине шырдак менен катар ала кийиз да кирген; ушундан кийин өнөргө болгон көз караш өзгөрүп, жаштар арасында кайра кызыгуу артты.',
    'Ала кийиз жасоо шырдактан да байыркы деп эсептелет - анткени кесип-тигүү үчүн темир курал (бычак, ийне) керек, ал эми уютуу ыкмасы андай курал болбогон мезгилден бери белгилүү.',
    'partially_verified',
    array[
      'https://ky.wikipedia.org/wiki/%D0%9A%D0%B8%D0%B9%D0%B8%D0%B7',
      'https://www.super.kg/article/show/32619',
      'https://commons.wikimedia.org/wiki/File:Ala-kiyiz_in_making.jpg'
    ],
    1
  ),
  (
    'shyrdak-tustor', 'shyrdak', null, 'Шырдактагы түстөрдүн мааниси', null, 'custom',
    null, null,
    'Ак - тазалыктын, ыйыктыктын жана бактылуулуктун белгиси; наристе жана карыялар менен байланышат. Кызыл - кан, күч, бакыт, тагдыр, сүйүү жана оттун белгиси; жашоонун гүлдөгөн мезгилин (болжол менен 40 жаш курагын) билдирет, көбүнчө жашыл менен айкалышып жайдын молчулугун туюнтат. Көк - Теңирдин ыйык түсү, асман менен космосту билдирет. Сары - байлык, бийлик жана алыскы талааны билдирет, бирок жалгыз колдонулбайт - оорулуу жана соолгон түшүнүгү менен да байланышкандыктан, көбүнчө оюмдун четин белгилөөгө колдонулат. Жашыл - жаштык жана жайды билдирет, жалбырак-бутак оюмдарында көрүнөт. Кара - жерди, күчтү жана намысты билдирет, бирок салттуу түшүнүктө көбүнчө терс маани (кайгы, кемчилик, жакырчылык) менен байланышкан; оң мааниде көз, чач сыяктуу сулуулукту сүрөттөөдө гана колдонулган.',
    null, null, null, null,
    'Чеберлер шырдак үчүн түс тандаганда кокусунан эмес, символдук ой жүгүртүү менен тандашкан - ар бир түстүн айкалышы белгилүү бир мезгилди же турмуш баскычын чагылдырган.',
    'partially_verified',
    array[
      'https://kghistory.akipress.org/unews/un_post:1716',
      'https://commons.wikimedia.org/wiki/File:Shyrdak_on_floor.jpg'
    ],
    2
  ),
  (
    'shyrdak-at-bashy', 'shyrdak', null, 'Ат-Башы - шырдактын мекени', null, 'custom',
    'Нарын облусундагы Ат-Башы району шырдак өнөрүнүн мекени катары таанылат.',
    'Мурда унутула баштаган бул өнөр 2012-жылы ЮНЕСКОнун таанышынан кийин кайра жанданган. Ат-Башыда "Алтын казан" (Golden Cauldron Herders) бирикмеси түзүлүп, анда 60-70дөй тажрыйбалуу чебер аял иштейт.',
    'Ат-Башылык чебер Жаңыйылдын шырдагы Улуу Британиянын борбордук музейинде көргөзмөгө коюлган - бул кыргыз шырдагынын эл аралык деңгээлде таанылганынын мисалы.',
    null, null, null, null,
    'Ар жылы Ат-Башыда өткөрүлгөн фестивалда 1500дөн ашык шырдак жана 500дөн ашык чебер катышкан; жеңген чыгармалар акчалай сыйлык алып, улуттук музейлерге тапшырылат.',
    'partially_verified',
    array['https://www.super.kg/article/show/32619'],
    3
  )
on conflict (id) do update set
  title = excluded.title, alt_names = excluded.alt_names, type_label = excluded.type_label,
  origin = excluded.origin, history = excluded.history,
  cultural_meaning = excluded.cultural_meaning, when_used = excluded.when_used,
  objects_used = excluded.objects_used, traditional_method = excluded.traditional_method,
  modern_status = excluded.modern_status, fun_facts = excluded.fun_facts,
  accuracy_level = excluded.accuracy_level, sources = excluded.sources, sort_order = excluded.sort_order;
