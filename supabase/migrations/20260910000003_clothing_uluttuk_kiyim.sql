-- Fills the 'clothing' (Улуттук кийим) Culture category, which had a
-- category row but zero items, with 30 researched entries across 4
-- subgroups: headwear, outerwear, footwear, jewelry. Same research
-- standard as the horse/shyrdak migrations - a web pass over ky
-- Wikipedia, kutbilim.kg (a Ministry of Education methodical-materials
-- site already cited elsewhere in this table), and super.kg, not deep
-- ethnographic cross-verification, so accuracy_level is
-- 'partially_verified' throughout.
--
-- Photos: Wikimedia Commons, CC BY / CC BY-SA, bundled at
-- assets/img/OYNO_design/culture/clothing/ and wired via
-- cultureItemImages (src/features/culture/data.ts). Most are museum
-- display-case photos (Kyrgyz National History Museum, a 2025-03-26
-- shoot by Commons user "Incall") showing several garments/ornaments
-- together in one case - the same item's photo is legitimately reused
-- across a few rows when it depicts more than one of them, same pattern
-- as the horse-kok-boru multi-image row. Each image-bearing row's
-- sources array includes the Commons file page for attribution.
--
-- 7 of the 30 items have no bundled photo (кеп-такыя/чачкеп, кементай,
-- билерик, өтүк, маасы, чокой, кепич) - no properly-licensed photo of
-- these specific items was found on Commons at research time; better to
-- omit than mismatch with an unrelated photo, same policy as the horse
-- and shyrdak migrations.

insert into public.culture_items (
  id, category_id, subgroup, title, alt_names, type_label, origin, history, cultural_meaning,
  when_used, objects_used, traditional_method, modern_status, fun_facts,
  accuracy_level, sources, sort_order
) values

-- ===== HEADWEAR (баш кийимдер) =====
  (
    'clothing-ak-kalpak', 'clothing', 'headwear', 'Ак калпак', null, 'custom',
    null, null,
    'Ак калпак - кыргыз эркектеринин ак кийизден жасалган, урматтуу баш кийими; Ала-Тоо тоолорун чагылдырган символ катары каралат. Калпактын төрт кыры - тоонун карлуу чокуларын, ичиндеги жашыл түс - жайлоо менен малды билдирет.',
    'Жаз, жай, күз мезгилдеринде кийилет.',
    'Ак кийиз (сырты), ак жүн.',
    null,
    'Кыргызстандын мамлекеттик символу катары да таанылат; 2019-жылдан тартып 5-март "Дүйнөлүк калпак күнү" катары белгиленет.',
    null,
    'partially_verified',
    array[
      'https://kutbilim.kg/methodical/inner/uluttuk-bash-kiyimder/',
      'https://commons.wikimedia.org/wiki/File:Modern_Kyrgyz_traditional_clothing_(2025-03-26).jpg'
    ],
    0
  ),
  (
    'clothing-tebetey', 'clothing', 'headwear', 'Тебетей', null, 'custom',
    null, null,
    'Тебетей - кыргыздын негизги баш кийим үлгүсү, жаш жана статуска жараша аймактык өзгөрүүлөрү бар. Эркектер жана аялдар кийет; кыздар жеңилирээк үлгүлөрүн, 16-18 жаштагы бойго жеткен кыздар "үкүлүү тебетей" (үкү тагылган) кийишет.',
    'Кыш мезгилинде, суук аба ырайында.',
    'Кундуз, түлкү, тыйын чычкан (белка), кубар терилери; ички капталышы жүндөн.',
    null,
    null,
    null,
    'partially_verified',
    array[
      'https://kutbilim.kg/methodical/inner/uluttuk-bash-kiyimder/',
      'https://commons.wikimedia.org/wiki/File:Modern_Kyrgyz_traditional_clothing_(2025-03-26).jpg'
    ],
    1
  ),
  (
    'clothing-topu', 'clothing', 'headwear', 'Топу', null, 'custom',
    null, null,
    'Топу - аялдар жана кыздар үй ичинде кийген жеңил баш кийим. Сырты кара кездемеден, ичи күрөң кийизден, астары ак кебезден жасалат.',
    'Үйдө, күнүмдүк тиричиликте.',
    'Кара кездеме, күрөң кийиз, ак кебез.',
    null,
    null,
    null,
    'partially_verified',
    array[
      'https://kutbilim.kg/methodical/inner/uluttuk-bash-kiyimder/',
      'https://commons.wikimedia.org/wiki/File:Traditional_Kyrgyz_women%27s_headdresses_(2025-03-26).jpg'
    ],
    2
  ),
  (
    'clothing-malakai', 'clothing', 'headwear', 'Малакай', null, 'custom',
    null, null,
    'Малакай - улгайган эркектер кийген, иштелген кой терисинен жасалган, ичи жүн менен капталган баш кийим. Түндүк кыргыздарында көбүрөөк кездешет.',
    'Үйдө, өзгөчө уктаганда кийилет.',
    'Иштелген кой терси.',
    null,
    null,
    null,
    'partially_verified',
    array[
      'https://kutbilim.kg/methodical/inner/uluttuk-bash-kiyimder/',
      'https://commons.wikimedia.org/wiki/File:Traditional_Kyrgyz_women%27s_headdresses_(2025-03-26).jpg'
    ],
    3
  ),
  (
    'clothing-tumak', 'clothing', 'headwear', 'Тумак', null, 'custom',
    null, null,
    'Тумак - энелер өз балдары үчүн тиккен, жумшак жана ийкемдүү жаш козунун жылтылдаган жүнүнөн жасалган баш кийим.',
    'Балдарга, кышында.',
    'Жаш козунун териси.',
    null,
    null,
    null,
    'partially_verified',
    array[
      'https://kutbilim.kg/methodical/inner/uluttuk-bash-kiyimder/',
      'https://commons.wikimedia.org/wiki/File:Kyrgyz_men%27s_national_clothing_(2025-03-26).jpg'
    ],
    4
  ),
  (
    'clothing-takyya', 'clothing', 'headwear', 'Такыя (кеп такыя)', null, 'custom',
    null, null,
    '10-12 жаштагы кыздар кийген баш кийим. Сырты жашыл же кызыл жибектен, ичи кебезден жасалып, кол менен саймаланат; капталында кулак жабуучу учтары болот.',
    'Кыздарга, күнүмдүк жана майрамдарда.',
    'Жашыл же кызыл жибек, кебез.',
    null,
    null,
    null,
    'partially_verified',
    array[
      'https://kutbilim.kg/methodical/inner/uluttuk-bash-kiyimder/',
      'https://commons.wikimedia.org/wiki/File:Traditional_Kyrgyz_women%27s_headdresses_(2025-03-26).jpg'
    ],
    5
  ),
  (
    'clothing-shokulo', 'clothing', 'headwear', 'Шөкүлө', null, 'custom',
    null, null,
    'Шөкүлө - кызды апасынын үйүнөн узатып жатканда кийгизилген, эрдик турмушка өтүшүн билдирген келин таажысы. Бийиктиги 25-30 см. Маңдай жагы асыл таштар, седеп жана алтын менен кооздолуп, учу түркумдун (страус) канатынан жасалган мамык менен бүтөт.',
    'Кыз узатылганда, той-жар учурунда.',
    'Ак кийиз (негизи), кызыл жибек (сырты), кундуз же тыйын чычкан териси (жээги), асыл таш, седеп, алтын, түркум мамыгы.',
    null,
    null,
    null,
    'partially_verified',
    array[
      'https://kutbilim.kg/methodical/inner/uluttuk-bash-kiyimder/',
      'https://commons.wikimedia.org/wiki/File:Kyrgyz_women%27s_headdresses_(2025-03-26;_3).jpg'
    ],
    6
  ),
  (
    'clothing-elechek', 'clothing', 'headwear', 'Элечек', null, 'custom',
    null, null,
    'Элечек - турмушка чыккан аялдын баш кийими; жаш келиндер да, улгайган аялдар да кийишкен. Мурда күмүш жип менен кооздолуп, кенен кездеме менен оролуп жасалган. Аймакка жараша формасы ар башка болот. Ыйык кийим катары каралат: карызга берилбейт, тескери кийилбейт, таза эмес кол менен кармалбайт; атайын сандыкта сакталат. Аялдын урматын жана турмуштук абалын билдирет.',
    'Күнүмдүк жана майрамдарда, турмушка чыккандан баштап өмүр бою.',
    'Кездеме, күмүш жип (мурда).',
    null,
    null,
    null,
    'partially_verified',
    array[
      'https://kutbilim.kg/methodical/inner/uluttuk-bash-kiyimder/',
      'https://commons.wikimedia.org/wiki/File:Women%27s_headdress_of_Kyrgyz_culture_(2025-03-26).jpg'
    ],
    7
  ),
  (
    'clothing-kep-takyya', 'clothing', 'headwear', 'Кеп-такыя (чачкеп)', null, 'custom',
    null, null,
    'Элечектин астына кийилген ички баш кийим; чачты толук жаап, элечектин формасын кармап турууга жана тазалыкты сактоого жардам берет.',
    'Элечек менен чогуу, күнүмдүк.',
    'Ак кездеме, зыгыр.',
    null,
    null,
    null,
    'partially_verified',
    array['https://kutbilim.kg/methodical/inner/uluttuk-bash-kiyimder/'],
    8
  ),
  (
    'clothing-jooluk', 'clothing', 'headwear', 'Жоолук', null, 'custom',
    null, null,
    'Жаш аялдар, келиндер жана улгайган аялдар кийген жоолук. Мурда кол менен токулган жүндөн, кийинчерээк саймаланган жибек жоолуктардан жасалган. Ислам дининдеги адеп-ахлак жана аруулукту билдирет; той босогосунда бата берүү менен байланыштуу колдонулган.',
    'Күнүмдүк, тойдо, майрамдарда.',
    'Жүн (мурда), жибек.',
    null,
    'Азыр да кеңири колдонулат, заманбап үлгүлөрдө да сакталган.',
    null,
    'partially_verified',
    array[
      'https://kutbilim.kg/methodical/inner/uluttuk-bash-kiyimder/',
      'https://commons.wikimedia.org/wiki/File:A_Kyrgyz_woman.JPG'
    ],
    9
  ),

-- ===== OUTERWEAR / ГАРМЕНТС (сырткы кийимдер) =====
  (
    'clothing-chapan', 'clothing', 'outerwear', 'Чапан', null, 'custom',
    null, null,
    'Эркектер жана аялдар кийген, ачык алды, кайрылган жакасы бар, топчуланган робо түрүндөгү сырткы кийим. Бачайы, сатин, баркыт сыяктуу материалдардан жасалып, жеңил жана ыңгайлуу. Байлар үчүн жибек-жүн аралашмасынан, жөнөкөй элге арзаныраак материалдан тигилген.',
    'Жыл мезгилине карабай, күнүмдүк жана майрамдарда кийилет.',
    'Бачайы, сатин, баркыт; жүк учурда кебез жалатылып шырылат.',
    null,
    'Азыр да улуттук майрамдарда, Нооруз мезгилинде кеңири кийилет.',
    null,
    'partially_verified',
    array[
      'https://kutbilim.kg/methodical/inner/syrt-zhana-zhe-il-kiyimder/',
      'https://ky.wikipedia.org/wiki/%D0%9A%D1%8B%D1%80%D0%B3%D1%8B%D0%B7%D0%B4%D1%8B%D0%BD_%D1%83%D0%BB%D1%83%D1%82%D1%82%D1%83%D0%BA_%D0%BA%D0%B8%D0%B9%D0%B8%D0%BC%D0%B4%D0%B5%D1%80%D0%B8',
      'https://commons.wikimedia.org/wiki/File:Kyrgyz_national_New_year_-_Nooruz.png'
    ],
    10
  ),
  (
    'clothing-ton', 'clothing', 'outerwear', 'Тон', null, 'custom',
    null, null,
    'Айбан терисинен жасалган жылуу сырткы кийим. Балдар жана улгайгандар үчүн чоң-энелер тигип берген - жеңил жана жылуу болот деген ишеним менен.',
    'Кыш мезгилинде.',
    'Иштелген, боёлгон кой териси; кебез жип.',
    null,
    null,
    null,
    'partially_verified',
    array[
      'https://kutbilim.kg/methodical/inner/syrt-zhana-zhe-il-kiyimder/',
      'https://commons.wikimedia.org/wiki/File:Kyrgyz_men%27s_national_clothing_(2025-03-26).jpg'
    ],
    11
  ),
  (
    'clothing-ichik', 'clothing', 'outerwear', 'Ичик', null, 'custom',
    null, null,
    'Тери менен ичтелген, кездеме тышы бар жылуу сырткы кийим. Эркектердики каш кулак, бөрү, сүлөөсүн, илбирс сыяктуу терилерден; аялдардыкы түлкү, улак же төө жүнү менен ичтелип, жашына жараша (карылар үчүн күрөң же боз, жаштар үчүн кызыл, жашыл же көз түстөр) айырмаланат.',
    'Кыш мезгилинде, сый кийим катары да.',
    'Кездеме (тышы), кундуз/түлкү/улак/төө териси (ичи).',
    null,
    null,
    null,
    'partially_verified',
    array[
      'https://kutbilim.kg/methodical/inner/syrt-zhana-zhe-il-kiyimder/',
      'https://commons.wikimedia.org/wiki/File:Kyrgyz_men%27s_and_women%27s_national_clothing_(2025-03-26).jpg'
    ],
    12
  ),
  (
    'clothing-kementai', 'clothing', 'outerwear', 'Кементай', null, 'custom',
    null, null,
    'Орто жаштан жогорку эркектер, өзгөчө жылкычылар жана малчылар кийген, кылдат уютулган кийизден жасалган чоң плащ түрүндөгү кийим. Жака-белдери, жең учтары саймаланат. Малчылар үчүн эң жылуу, жумшак жана ийкемдүү кийим катары бааланат.',
    'Мал багууда, жаандуу/суук аба ырайында.',
    'Кылдат уютулган кийиз.',
    null,
    null,
    null,
    'partially_verified',
    array['https://kutbilim.kg/methodical/inner/syrt-zhana-zhe-il-kiyimder/'],
    13
  ),
  (
    'clothing-beshmant', 'clothing', 'outerwear', 'Бешмант', null, 'custom',
    null,
    '19-кылымдан тартып кеңири колдонула баштаган, саймаланган кийим түрү.',
    'Эркектер жана аялдар кийген, кемселге окшош, бирок узунураак жана кыскараак үлгүлөрү бар кийим. Этеги төгүлүп, бели беш жерден кыналып, тизеден беш эли узун болот - ушундан аталышы келип чыккан.',
    'Күнүмдүк жана сый учурларда.',
    'Кездеме, ичтелген жүн же кебезсиз.',
    null,
    null,
    null,
    'partially_verified',
    array[
      'https://kutbilim.kg/methodical/inner/syrt-zhana-zhe-il-kiyimder/',
      'https://commons.wikimedia.org/wiki/File:Kyrgyz_men%27s_national_clothing_(2025-03-26).jpg'
    ],
    14
  ),
  (
    'clothing-kemsel', 'clothing', 'outerwear', 'Кемсел', null, 'custom',
    null, null,
    'Аялдар жана эркектер, ар кайсы жаш тобу кийген жука сырт кийими. Таар, кездеме, баркыт сыяктуу материалдардан жасалып, жука кездеме менен ичтелет. Жеңинин узундугу жашка жараша өзгөрөт.',
    'Күнүмдүк кийим катары.',
    'Таар, кездеме, баркыт.',
    null,
    null,
    null,
    'partially_verified',
    array[
      'https://kutbilim.kg/methodical/inner/syrt-zhana-zhe-il-kiyimder/',
      'https://commons.wikimedia.org/wiki/File:A_Kyrgyz_woman.JPG'
    ],
    15
  ),
  (
    'clothing-chyptama', 'clothing', 'outerwear', 'Чыптама', null, 'custom',
    null, null,
    'Аялдар, кыз-келиндер кийген, бели жабылып турган, бир кабат же жеңи иштелип тигилбеген жеңил кийим. Кош этек көйнөк менен кошо, той-тамашаларда кийилет. Мурда тери же таардан, азыр баркыт же тукабадан, кебез же жүн салынып жасалат.',
    'Той-тамашаларда, көйнөк үстүнөн.',
    'Тери, таар, кездеме, кебез же жүн.',
    null,
    null,
    null,
    'partially_verified',
    array[
      'https://kutbilim.kg/methodical/inner/syrt-zhana-zhe-il-kiyimder/',
      'https://commons.wikimedia.org/wiki/File:%D0%90%D1%81%D0%B5%D0%BB%D1%8C_%D0%9A%D0%B0%D0%BB%D0%BA%D0%B0%D0%BD%D0%BE%D0%B2%D0%B0.jpg'
    ],
    16
  ),
  (
    'clothing-chepken', 'clothing', 'outerwear', 'Чепкен', null, 'custom',
    null, null,
    'Жалпы колдонулган, көбүнчө жаз-күз айларында кийилген жеңил жана бышык кийим. Бөз, нооту, баркыт сыяктуу материалдардан жасалып, ичи сатин менен капталат. Аялдардыкынын жакасы суусар же кундуз менен жээктелет.',
    'Жаз жана күз мезгилинде.',
    'Бөз, нооту, баркыт; ичи сатин.',
    null,
    null,
    null,
    'partially_verified',
    array['https://kutbilim.kg/methodical/inner/syrt-zhana-zhe-il-kiyimder/'],
    17
  ),
  (
    'clothing-beldemchi', 'clothing', 'outerwear', 'Белдемчи', null, 'custom',
    null, null,
    'Аялдар, өзгөчө оор турмуш-тиричилик жумуштарын аткарган келиндер кийген, белге курчалып кийилүүчү этек. Баркыт кездемеден жасалып, жээктери саймаланып, кундуз менен карматылат. Белди жылуу кармагандыктан, эң ыңгайлуу кийимдердин бири катары бааланат.',
    'Жаз, күз, кыш мезгилдеринде; той-тамашаларда.',
    'Баркыт кездеме, кундуз (жээк).',
    null,
    'Азыр да улуттук кийим катары той-тамашаларда, өзгөчө улуттук майрамдарда кийилет.',
    null,
    'partially_verified',
    array[
      'https://kutbilim.kg/methodical/inner/syrt-zhana-zhe-il-kiyimder/',
      'https://commons.wikimedia.org/wiki/File:%D0%90%D1%81%D0%B5%D0%BB%D1%8C_%D0%9A%D0%B0%D0%BB%D0%BA%D0%B0%D0%BD%D0%BE%D0%B2%D0%B0.jpg'
    ],
    18
  ),

-- ===== FOOTWEAR (бут кийимдер) =====
  (
    'clothing-otuk', 'clothing', 'footwear', 'Өтүк', null, 'custom',
    null, null,
    'Булгаарыдан тигилген бут кийим; түрлөрү арасында "кызыл жеке өтүк" (кызыл кончук өтүк) жана "өкчөлүү өтүк" (өкчөсү бар өтүк) айырмаланат.',
    'Күнүмдүк жана сый учурларда.',
    'Булгаары.',
    null,
    null,
    null,
    'partially_verified',
    array['https://ky.wikipedia.org/wiki/%D0%9A%D1%8B%D1%80%D0%B3%D1%8B%D0%B7%D0%B4%D1%8B%D0%BD_%D1%83%D0%BB%D1%83%D1%82%D1%82%D1%83%D0%BA_%D0%BA%D0%B8%D0%B9%D0%B8%D0%BC%D0%B4%D0%B5%D1%80%D0%B8'],
    19
  ),
  (
    'clothing-maasy', 'clothing', 'footwear', 'Маасы', null, 'custom',
    null, null,
    'Өкчөсү жок, булгаарыдан тамандалган, териден тигилген жумшак ички бут кийим. Үстүнөн катуу кончу бар кепич кийилет.',
    'Кепич менен кошо, күнүмдүк.',
    'Тери, булгаары (таман).',
    null,
    null,
    null,
    'partially_verified',
    array['https://ky.wikipedia.org/wiki/%D0%9A%D0%B8%D0%B9%D0%B8%D0%B7_%D0%B1%D1%83%D1%82_%D0%BA%D0%B8%D0%B9%D0%B8%D0%BC'],
    20
  ),
  (
    'clothing-chokoy', 'clothing', 'footwear', 'Чокой', null, 'custom',
    null, null,
    'Ак же кара кийизден чабылган, кышында жылуулук үчүн жасалган бут кийим. Жүндөн уютулуп жасалып, таманына булгаарынын кесиндиси тамандалат.',
    'Кыш мезгилинде.',
    'Кой жүнү (кийиз), булгаары (таман).',
    null,
    null,
    null,
    'partially_verified',
    array['https://ky.wikipedia.org/wiki/%D0%9A%D0%B8%D0%B9%D0%B8%D0%B7_%D0%B1%D1%83%D1%82_%D0%BA%D0%B8%D0%B9%D0%B8%D0%BC'],
    21
  ),
  (
    'clothing-kepich', 'clothing', 'footwear', 'Кепич', null, 'custom',
    null, null,
    'Кончу бар, жеңил бут кийим; ичи тери менен ичтелип, булгаарыдан жасалат. Маасы менен кошо кийилет.',
    'Маасы менен кошо, күнүмдүк.',
    'Булгаары, тери.',
    null,
    null,
    null,
    'partially_verified',
    array['https://ky.wikipedia.org/wiki/%D0%9A%D1%8B%D1%80%D0%B3%D1%8B%D0%B7%D0%B4%D1%8B%D0%BD_%D1%83%D0%BB%D1%83%D1%82%D1%82%D1%83%D0%BA_%D0%BA%D0%B8%D0%B9%D0%B8%D0%BC%D0%B4%D0%B5%D1%80%D0%B8'],
    22
  ),

-- ===== JEWELRY (зер буюмдар) =====
  (
    'clothing-solkobay', 'clothing', 'jewelry', 'Сөлкөбай', null, 'custom',
    null, null,
    'Чач учтугунун учуна күмүш тыйындарды кошуп тагылган чач кооздугу; ушундан "сөлкөбай" деп аталган. Тыйындардын саны ээсинин байлык деңгээлин билдирген.',
    '18ден 40 жашка чейинки аялдар кийишкен.',
    'Күмүш тыйындар.',
    null,
    null,
    null,
    'partially_verified',
    array[
      'https://www.super.kg/article/show/61351',
      'https://commons.wikimedia.org/wiki/File:Kyrgyz_women%27s_traditional_jewellery_(2025-03-26).jpg'
    ],
    23
  ),
  (
    'clothing-boy-tumar', 'clothing', 'jewelry', 'Бой тумар', null, 'custom',
    null, null,
    'Бойго жеткен кыздын же келиндин көркүнө көз тийбесин деген мааниде жасалган, күмүштөн куюлган тегерек калкан сымал көкүрөк кооздугу. Ошондой эле дене турушун туура сактоого жардам берет.',
    '18 жаштан баштап кыздар, келиндер тагынышкан.',
    'Күмүш.',
    null,
    null,
    null,
    'partially_verified',
    array[
      'https://www.super.kg/article/show/61351',
      'https://commons.wikimedia.org/wiki/File:Women%27s_Kyrgyz_jewellery_(2025-03-26).jpg'
    ],
    24
  ),
  (
    'clothing-ala-tamak', 'clothing', 'jewelry', 'Ала тамак', null, 'custom',
    null, null,
    'Шурудан жасалып, моюнду жапкан кооздук. Өсүп келе жаткан кыздын моюнун коргоп, туура турушун калыптандыруу максатында тагылган.',
    '10дон 13 жашка чейинки кыздар тагынышкан.',
    'Шуру.',
    null,
    null,
    null,
    'partially_verified',
    array[
      'https://www.super.kg/article/show/61351',
      'https://commons.wikimedia.org/wiki/File:Women%27s_Kyrgyz_jewellery_(2025-03-26).jpg'
    ],
    25
  ),
  (
    'clothing-soyko', 'clothing', 'jewelry', 'Сөйкө', null, 'custom',
    null, null,
    'Кулакка тагылган, ичке моюну бар, түрдүү тегерек формадагы шыралгы кооздук. Кичине курактан баштап тагынышкан; күмүш түрү аялдын энергиясын тазалайт деген ишеним да бар.',
    'Балалык курактан баштап, өмүр бою.',
    'Күмүш, коргошун, асыл таштар.',
    null,
    null,
    null,
    'partially_verified',
    array[
      'https://ky.wikipedia.org/wiki/%D0%A1%D3%A9%D0%B9%D0%BA%D3%A9',
      'https://www.super.kg/article/show/61351',
      'https://commons.wikimedia.org/wiki/File:Women%27s_Kyrgyz_jewellery_(2025-03-26).jpg'
    ],
    26
  ),
  (
    'clothing-chachpak', 'clothing', 'jewelry', 'Чачпак', 'Чач учтук', 'custom',
    null,
    null,
    'Улгайган аялдар кийген чач кооздугу; үлгүсү жашын, коомдук абалын жана уруулук таандыктыгын билдирген. Оор чач учтук дене турушун туура кармоого жардам берип, курак өткөн сайын жеңилирээк болуп калган.',
    'Чач өрүмүнүн учуна тагынат, күнүмдүк жана майрамдарда.',
    'Күмүш, коралл шуру.',
    null,
    null,
    null,
    'partially_verified',
    array[
      'https://www.super.kg/article/show/61351',
      'https://commons.wikimedia.org/wiki/File:Women%27s_headdress_of_Kyrgyz_culture_(2025-03-26).jpg'
    ],
    27
  ),
  (
    'clothing-bilerik', 'clothing', 'jewelry', 'Билерик', null, 'custom',
    null, null,
    'Колго тагынган күмүш билерик; көз тийүүдөн коргойт деген ишеним менен тагынылган.',
    'Күнүмдүк жана майрамдарда.',
    'Күмүш.',
    null,
    null,
    null,
    'partially_verified',
    array['https://www.super.kg/article/show/61351'],
    28
  ),
  (
    'clothing-monchok', 'clothing', 'jewelry', 'Мончок', null, 'custom',
    null, null,
    'Коралл же башка шуруларынан тизилген, бир нече катар кылып моюнга тагынылган алкым кооздугу. Аялдын кооздугунун негизги бир бөлүгү катары кеңири колдонулган.',
    'Күнүмдүк жана майрамдарда.',
    'Коралл шуру, күмүш аралашмасы.',
    null,
    null,
    null,
    'partially_verified',
    array['https://commons.wikimedia.org/wiki/File:Women%27s_Kyrgyz_jewellery_(2025-03-26).jpg'],
    29
  )
on conflict (id) do update set
  title = excluded.title, alt_names = excluded.alt_names, type_label = excluded.type_label,
  origin = excluded.origin, history = excluded.history,
  cultural_meaning = excluded.cultural_meaning, when_used = excluded.when_used,
  objects_used = excluded.objects_used, traditional_method = excluded.traditional_method,
  modern_status = excluded.modern_status, fun_facts = excluded.fun_facts,
  accuracy_level = excluded.accuracy_level, sources = excluded.sources, sort_order = excluded.sort_order;
