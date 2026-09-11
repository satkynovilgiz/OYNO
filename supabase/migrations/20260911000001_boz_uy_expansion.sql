-- Expands the 'boz-uy' Culture category beyond its single overview row
-- (boz-uy-overview, from 20260829000005) with 5 more researched entries:
-- the smoke-hole crown (tunduk), the wooden frame, the felt-covering
-- process, interior decoration, and the ceremonial "ак өргөө" white yurt.
-- Same research standard as the horse/shyrdak/clothing migrations: a web
-- pass over ky Wikipedia and kutbilim.kg (already cited elsewhere in this
-- table), not deep ethnographic cross-verification, so accuracy_level
-- stays 'partially_verified'.
--
-- Photos: Wikimedia Commons, CC BY / CC BY-SA, bundled at
-- assets/img/OYNO_design/culture/boz_uy/ and wired via cultureItemImages
-- (src/features/culture/data.ts). Each image-bearing row's sources array
-- includes the Commons file page for attribution. boz-uy-ak-orgoo has no
-- bundled photo - no Commons photo specifically depicting the larger
-- ceremonial "ак өргөө" (as opposed to an ordinary yurt) was found at
-- research time; better to omit than mismatch with a generic yurt photo.

-- boz-uy-overview: only appending a 4th image (a general yurt-camp photo)
-- and NOT touching any researched text field from 20260829000005.
update public.culture_items set
  sources = array[
    'https://ky.wikipedia.org/wiki/%D0%91%D0%BE%D0%B7_%D2%AF%D0%B9',
    'https://www.kyrgyzinfo.ru/kyrgyz-bujumdary-boz-j-tush-kijiz-kamchy/',
    'https://commons.wikimedia.org/wiki/File:Kyrgyz_yurt_camp.jpg'
  ]
where id = 'boz-uy-overview';

insert into public.culture_items (
  id, category_id, subgroup, title, alt_names, type_label, origin, history, cultural_meaning,
  when_used, objects_used, traditional_method, modern_status, fun_facts,
  accuracy_level, sources, sort_order
) values
  (
    'boz-uy-tunduk', 'boz-uy', null, 'Түндүк', null, 'custom',
    null, null,
    'Боз үйдүн чатырынын жогорку бөлүгүндөгү, түтүн чыгуучу тегерек тешик - үйдүн эң ыйык бөлүгү. Эки бөлүктөн турат: алкак (сырткы шакек) жана чамгарак (алкактын ичиндеги айкалышкан тор). Алкакта үйдүн чоңдугуна жараша 60, 70 же 80 көзөнөк болот, ошол көзөнөктөргө уктардын учтары такалып бекитилет.',
    null, null,
    'Алкак жоон талдан же кайыңдан корго алынып (бууланып), ийилип, ченелип жасалат; экөө бирин-бирине аштап курулат.',
    'Кыргызстандын мамлекеттик желегинин борборунда түндүктүн сүрөтү чагылдырылган - улуттук идентификациянын эң таанымал символдорунун бири.',
    'Түндүккө байланыштуу каргыш жана бата сөздөр сакталып калган: жаман тилек катары "түндүгүң түшсүн" (сенин үйүң-бүлөң тарасын) айтылса, жакшы тилек катары "түндүгүңдөн түтүн үзүлбөсүн" (үй-бүлөң түбөлүк уланысын) деп бата беришкен.',
    'partially_verified',
    array[
      'https://ky.wikipedia.org/wiki/%D0%91%D0%BE%D0%B7_%D2%AF%D0%B9',
      'https://commons.wikimedia.org/wiki/File:Kyrgyz_flag_yurt_Tengri_symbol.jpg'
    ],
    1
  ),
  (
    'boz-uy-karkas', 'boz-uy', null, 'Жыгач каркас', 'Кереге, уук', 'custom',
    null, null,
    'Боз үйдүн жыгач каркасы үч негизги бөлүктөн турат: кереге (дубал катары кызмат кылган тор-каркас), уук (керегeден түндүккө чейин созулган чатыр таякчалары) жана түндүк. Кереге курулушу татаалыраак: жыгач корго алынып ийилет, бөлүктөрү 18-20 см аралыкта жайгаштырылып, иштетилген тери тилкелери (көк) менен тор сымал байланат; бөлүктөрдү бириктирген түйүндөр "саканак" деп аталат. Уук дагы корго алынып, узундугу так өлчөнүп, учу түндүктүн көзөнөгүнө так келгидей учталат.',
    null,
    'Кереге (дубал каркасы), уук (чатыр таякчалары), түндүк, бозого (эшик каркасы).',
    'Тажрыйбалуу усталар бул жыгач каркасты болжол менен 25 күндө куруп бүтүшкөн; даяр каркас дайыма көчүп-конууга карабастан 25 жылдай кызмат кыла алат.',
    null,
    null,
    'partially_verified',
    array[
      'https://ky.wikipedia.org/wiki/%D0%91%D0%BE%D0%B7_%D2%AF%D0%B9',
      'https://kutbilim.kg/methodical/inner/boz-yd-n-ichki-zhasalgalary/',
      'https://commons.wikimedia.org/wiki/File:Dismantled_Yurt_at_Lake_Tuz-Kol_at_Kyzyl-Tuu.jpg'
    ],
    2
  ),
  (
    'boz-uy-kiyiz-jabuu', 'boz-uy', null, 'Кийиз жабуулар', 'Туурдук, үзүк', 'custom',
    null, null,
    'Жыгач каркас даяр болгон соң, ага кийиз жабуулар жабылат: туурдук (керегeни каптаган кийиз, "жабык башы" ичке карай багытталат), үзүк (алдыңкы-арткы чоң бөлүктөр - түндүккө жакын жери "кууш" болуп муздак сакталса, этек жагы "жазы" болуп жаз-жай ысыгына ыңгайлашкан), жана эшик жабуу, түндүк жабуу. Бул кийиздердин четтери сайма менен кооздолот.',
    'Көчүп-конууда, ар бир конушта кайрадан курулганда.',
    'Кой жүнүнөн уютулган кийиз, чий (ноон таякчадан токулган дубал каптоочу).',
    'Кийиз жабуу иши бир нече адамдын биргелешкен күчүн талап кылат - көбүнчө аялдар аткарган.',
    null,
    null,
    'partially_verified',
    array[
      'https://ky.wikipedia.org/wiki/%D0%91%D0%BE%D0%B7_%D2%AF%D0%B9',
      'https://commons.wikimedia.org/wiki/File:Kirgizische_vrouwen_plaatsen_bedekking_op_een_joert,_-20_mei_2010_a.jpg'
    ],
    3
  ),
  (
    'boz-uy-ichki-jasalga', 'boz-uy', null, 'Ички жасалга', null, 'custom',
    null, null,
    'Боз үйдүн ичи так эрежелер боюнча бөлүнөт: сол жагы (эркектер тарабы) - ээр-токум, аңчылык куралдары сакталган жер; оң жагы (аялдар тарабы) - ашкана жана аялдардын иш аймагы; борбордо - очок жана жанындагы сандыктар; ал эми очоктун арт жагындагы эң урматтуу орун "төр" деп аталып, үй-бүлөнүн башчысына же кадырлуу конокко арналат.',
    null,
    'Туш кийиз (эшик жана дубалга илинген кооздолгон кийиз), килемдер (кочкор мүйүз оюмдуу), шырдак жана ала кийиз (полго төшөлүүчү), сайма менен кооздолгон илмелер.',
    null,
    'Ар бир боз үйдүн ички жасалгасы каркасы бирдей болсо да кайталангыс - ар бир үй-бүлөнүн өз чеберчилиги жана табити чагылдырылат.',
    null,
    'partially_verified',
    array[
      'https://kutbilim.kg/methodical/inner/boz-yd-n-ichki-zhasalgalary/',
      'https://commons.wikimedia.org/wiki/File:Jurte_von_innen.jpg'
    ],
    4
  ),
  (
    'boz-uy-ak-orgoo', 'boz-uy', null, 'Ак өргөө', null, 'custom',
    null, null,
    'Ак өргөө - жасалгалуу, көлөмдүү боз үй; жөнөкөй турак-жайдан агы, чоңдугу жана көркү менен айырмаланат. Эң кичинеси "алты канат", чоңу "он эки канат" болот (канат - керегeнин бир бөлүгү). Курулушунда от жагуучу материал жана айрым кийиз тилкелери колдонулбайт. Ичинде тегерек тирөөч "тегирич" болот, сырты "кылдыраач" деп аталган кооздук менен жасалгаланат; эң оймо-чиймелүү бөлүгү "ак сарай" деп аталат.',
    'Майрамдарда, "Койчулар күнү" сыяктуу иш-чараларда, эс алуу жайларында жана кадырлуу конокторду тосууда; башка турак-жайлардан бөлүнүп, бийик, өзүнчө жерге тигилген.',
    null,
    'Чебер усталар жана адистер чогуу иштешип курат.',
    'Кыргыз боз үйлөрү Германия, Индия, Канада, Сирия, Түркия, Алжир, Швейцария жана Монголиядагы эл аралык көргөзмөлөрдө көрсөтүлгөн.',
    null,
    'partially_verified',
    array['https://ky.wikipedia.org/wiki/%D0%90%D0%BA_%D3%A9%D1%80%D0%B3%D3%A9%D3%A9'],
    5
  )
on conflict (id) do update set
  title = excluded.title, alt_names = excluded.alt_names, type_label = excluded.type_label,
  origin = excluded.origin, history = excluded.history,
  cultural_meaning = excluded.cultural_meaning, when_used = excluded.when_used,
  objects_used = excluded.objects_used, traditional_method = excluded.traditional_method,
  modern_status = excluded.modern_status, fun_facts = excluded.fun_facts,
  accuracy_level = excluded.accuracy_level, sources = excluded.sources, sort_order = excluded.sort_order;
