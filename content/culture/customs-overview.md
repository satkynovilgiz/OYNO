# Кыргыз каада-салттары — жалпы структура

Status: **STRUCTURE ONLY** — this file records the shared taxonomy, labeling
rule, and per-item card template that apply across every customs category
file in this folder (birth-customs.md, wedding-customs.md,
hospitality-customs.md, nomadic-labor-customs.md,
festive-spiritual-customs.md, funeral-customs.md). It does not itself carry
per-item content beyond the one worked example.

## The 6 categories

1. 👶 Баланын төрөлүшү жана өсүшү — `content/culture/birth-customs.md`
2. 💍 Үйлөнүү жана үй-бүлө куруу — `content/culture/wedding-customs.md`
3. 🏠 Конок күтүү жана коомдук мамиле — `content/culture/hospitality-customs.md`
4. 🐎 Көчмөн турмуш жана эмгек — `content/culture/nomadic-labor-customs.md`
5. 🌿 Майрамдык жана руханий салттар — `content/culture/festive-spiritual-customs.md`
6. 🕯️ Акыркы сапарга узатуу — `content/culture/funeral-customs.md`

These 6 categories are a finer breakdown than the current
`culture_categories.id = 'tradition'` row — they will need their own
category IDs (or a subcategory field) when this content actually gets wired
into the schema. Not decided yet; flagging here so the schema work doesn't
default to dumping all 6 into one flat `tradition` bucket.

## Type label (apply to every individual custom/item)

Not every entry in these lists is the same *kind* of thing ethnographically —
labeling everything "salt" (custom) is imprecise. Each item should carry one
of:

- **Каада-салт** — custom/tradition (the general class)
- **Үрп-адат** — customary practice/mores
- **Ырым-жырым** — ritual/rite
- **Жөрөлгө** — ceremony/rite of passage
- **Майрам** — festival/holiday

This label is a per-item field, not a per-category one — two items in the
same category file can carry different labels (e.g. within the festive
category, Нооруз is a Майрам while Аластоо is an Ырым-жырым).

## Per-item content standard (customs)

Distinct from food.md's 15-field template — customs use this 10-field
shape:

1. Аталышы (kg) + type label (Каада-салт · Үрп-адат · Ырым-жырым · Жөрөлгө · Майрам)
2. Келип чыгышы (origin)
3. Тарыхы (history)
4. Мааниси (meaning/significance)
5. Кантип өткөрүлгөнү (how it is/was performed)
6. Кимдер катышкан (who participates)
7. Колдонулган буюмдар (objects/items used)
8. Аймактык айырмачылыктар (regional variation)
9. Бүгүнкү күндөгү көрүнүшү (how it appears today — still practiced / changed / historical only)
10. Кызыктуу факт (one interesting fact)
    + Ишенимдүү булактар (sources)

### Example: Сүйүнчү

- Type label: **Ырым-жырым**
- Келип чыгышы: көчмөн турмушта кабарды тезинен жеткирүү жана жакшы
  кабарды сыйлоо салтынан келип чыккан.
- Тарыхы: байыртадан бери сакталып келе жаткан, жакшы кабар алып келген
  адамга сый көрсөтүү салты.
- Мааниси: жакшы кабарды баалоо, кабар алып келген адамдын эмгегин
  сыйлоо; коомдук ынтымакты чагылдырган жөрөлгө.
- Кантип өткөрүлгөнү: жакшы кабар (мис. бала төрөлгөндө, узак жолдон кабар
  келгенде) алып келген адамга кабарды укан адам белек же тартуу берет.
- Кимдер катышкан: кабар алып келүүчү жана кабарды угуучу — көбүнчө
  үй-бүлө же жамаат мүчөлөрү.
- Колдонулган буюмдар: катаал белгиленген буюм жок — акча, кездеме,
  мал же башка баалуу нерсе берилиши мүмкүн.
- Аймактык айырмачылыктар: так айырмачылыктар боюнча бул сессияда
  ишенимдүү булак табылган жок — кийин тактоо керек.
- Бүгүнкү күндөгү көрүнүшү: азыр да колдонулат, айрыкча үй-бүлөлүк жакшы
  кабарларда (бала төрөлүү, ийгилик ж.б.).
- Кызыктуу факт: сүйүнчү берүү милдеттүү эмес — ыктыярдуулукка
  негизделген, бирок аны берүү сый-урмат катары каралат.

Sources: not yet provided per-field above beyond birth-customs.md's general
open.kg-family reference — needs its own citation pass before being marked
VERIFIED, same as every other item in these lists.
