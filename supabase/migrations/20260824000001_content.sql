-- Phase 6c: move genuinely real, static content (culture categories,
-- culture learning materials, Explore regions with cited facts, the
-- current quest's definition) out of hardcoded TS arrays into the
-- database, so it's editable without an app release (master prompt §19,
-- §96-98) and screens fetch it instead of importing local data.
--
-- Deliberately NOT ported: the `current`/`total` counts on culture
-- categories, `discoveredPercent` on explore locations, and the whole of
-- `exploreProgress`. Every one of those is explicitly commented in the
-- source TS files as mock/placeholder numbers, not real per-user or
-- per-content counts - there is no real "12 boz-uy items" collection to
-- count yet. Copying a fake number into Postgres doesn't make it real,
-- it just moves the fakeness (master prompt §90 cultural quality
-- control, §118 real data rule) - those stay client-side mock constants,
-- unchanged, until a real collection-items content system exists to
-- back them for real.
--
-- Images stay out of this table entirely: they're bundled local assets
-- (RN `require()`, which needs a static literal path at bundle time and
-- can't resolve a DB-supplied string) - Storage-backed images are Phase
-- 6g, not this phase. The client keeps a small id -> imageSource lookup
-- map alongside the fetch.

create table public.culture_categories (
  id text primary key,
  title text not null,
  sort_order int not null
);

create table public.culture_materials (
  id text primary key,
  kind text not null check (kind in ('today_discovery', 'reading', 'video', 'game')),
  title text not null,
  description text,
  duration_minutes int,
  sort_order int not null
);

create table public.explore_regions (
  id text primary key,
  kind text not null check (kind in ('region', 'nature')),
  name_kg text not null,
  name_ru text not null,
  name_en text not null,
  tagline text not null,
  facts text[] not null,
  status text not null check (status in ('verified', 'partially_verified', 'unverified')),
  sort_order int not null
);

create table public.quests (
  id text primary key,
  character_id text not null,
  title text not null,
  subtitle text not null,
  total_count int not null,
  cta_label text not null
);

-- Published static content, same for every visitor - public read, no
-- user_id, no owner. No insert/update/delete policy for any client role:
-- content changes go through the SQL Editor for now (same workflow as
-- every other migration in this project) until a real admin panel
-- (Phase 6d) exists to write these safely with an audit log.
alter table public.culture_categories enable row level security;
create policy "public read culture categories" on public.culture_categories for select using (true);

alter table public.culture_materials enable row level security;
create policy "public read culture materials" on public.culture_materials for select using (true);

alter table public.explore_regions enable row level security;
create policy "public read explore regions" on public.explore_regions for select using (true);

alter table public.quests enable row level security;
create policy "public read quests" on public.quests for select using (true);

-- Seed: a faithful 1:1 port of src/features/culture/data.ts and
-- src/features/explore/data.ts's real content (titles, facts, taglines),
-- not new/invented content.

insert into public.culture_categories (id, title, sort_order) values
  ('boz-uy', 'Боз үй', 0),
  ('oymo', 'Оймо', 1),
  ('shyrdak', 'Шырдак', 2),
  ('komuz', 'Комуз', 3),
  ('music', 'Музыка', 4),
  ('clothing', 'Улуттук кийим', 5),
  ('horse', 'Ат маданияты', 6),
  ('food', 'Ашкана', 7),
  ('games', 'Улуттук оюндар', 8),
  ('tradition', 'Каада-салт', 9);

insert into public.culture_materials (id, kind, title, description, duration_minutes, sort_order) values
  ('komuz-discovery', 'today_discovery', 'Комуз', 'Кыргыздын улуттук музыкалык аспабы жөнүндө жаңы нерсе үйрөн.', null, 0),
  ('kalpak-history', 'reading', 'Калпактын тарыхы', null, 5, 1),
  ('boorsok-cooking', 'video', 'Боорсок жасоо', null, 7, 2),
  ('kyz-kuumai-game', 'game', 'Кыз куумай оюну', null, 3, 3);

insert into public.explore_regions (id, kind, name_kg, name_ru, name_en, tagline, facts, status, sort_order) values
  ('bishkek', 'region', 'Бишкек', 'Бишкек', 'Bishkek', 'Кыргызстандын борбор шаары',
    array['1878-жылы "Пишпек" деп негизделген, 1926-жылы Фрунзе, 1991-жылы көз каранды эмес Кыргызстандын борбор шаары катары Бишкек деп аталды.', 'Азыркы учурда калкы 1 миллионго жакын.'],
    'verified', 0),
  ('chuy', 'region', 'Чүй', 'Чуй', 'Chüy', 'Түндүк аймак, Кыргыз Ала-Тоонун этегинде',
    array['Ири шаарлары: Токмок, Кант, Кара-Балта.', 'Бишкек шаары өзүнчө республикалык мааниге ээ болгондуктан, облустун курамына кирбейт.'],
    'verified', 1),
  ('ysyk-kol', 'region', 'Ысык-Көл', 'Иссык-Куль', 'Issyk-Kul', 'Кыргызстандын бермети',
    array['Дүйнөдөгү эң тунук көлдөрдүн бири (Байкалдан кийин 2-орунда), эч качан тоңбойт.', 'Тереңдиги 702 метр, деңиз деңгээлинен 1608 метр бийикте жайгашкан.', 'Аянты 6236 км² — дүйнөдөгү 30 чоң көлдүн бири.'],
    'verified', 2),
  ('naryn', 'region', 'Нарын', 'Нарын', 'Naryn', 'Кыргызстандын эң бийик тоолуу облусу',
    array['Аймагынын 95%и деңиз деңгээлинен 1000 метрден бийик жайгашкан.', 'Сон-Көл, Кол-Суу, Чатыр-Көл сыяктуу бийик тоо көлдөрүнүн мекени.'],
    'verified', 3),
  ('talas', 'region', 'Талас', 'Талас', 'Talas', '"Манас" эпосунун ыйык жери',
    array['"Манас" эпосунун экинчи бөлүгүндө Семетей Таласка кайтып келет.', '"Манас" дүйнөдөгү эң узун эпос катары Гиннестин рекорддор китебине кирген.'],
    'partially_verified', 4),
  ('osh', 'region', 'Ош', 'Ош', 'Osh', 'Борбор Азиядагы эң байыркы шаарлардын бири',
    array['Фергана өрөөнүнүн чыгыш бөлүгүндө, Алай тоолорунун этегинде жайгашкан.', 'Кыргызстандагы экинчи чоң шаар.'],
    'partially_verified', 5),
  ('jalal-abad', 'region', 'Жалал-Абад', 'Джалал-Абад', 'Jalal-Abad', 'Дарыгер булактардын аймагы',
    array['Минералдык суу булактарынын негизинде курорттор өнүккөн.', 'Арсланбоб жаңгак токою жана Сары-Челек биосфералык коругу ушул облуста жайгашкан.'],
    'verified', 6),
  ('batken', 'region', 'Баткен', 'Баткен', 'Batken', 'Кыргызстандын эң жаш облусу',
    array['1999-жылдын 13-октябрында түзүлгөн — Кыргызстандын эң жаш облусу.', 'Тажикстан жана Өзбекстан менен чектешет.'],
    'verified', 7),
  ('son-kol', 'nature', 'Сон-Көл', 'Сон-Куль', 'Son-Köl', 'Мөңгүлөрдөн пайда болгон бийик тоо көлү',
    array['Деңиз деңгээлинен 3016 метр бийикте, Нарын облусунда жайгашкан.', 'Кыргызстандагы эң чоң таза суулуу көл. Сентябрдын аягынан майга чейин тоңуп турат.'],
    'verified', 8),
  ('suusamyr', 'nature', 'Суусамыр', 'Суусамыр', 'Suusamyr', 'Кеңири жайлоо өрөөнү',
    array['Кыргыз Ала-Тоо менен Суусамыр, Жумгал тоолорунун ортосунда, 2000–3200 метр бийикте.', 'Чүй, Талас, Кетмен-Төбө өрөөндөрүнөн келген малдын негизги жайыты.'],
    'verified', 9),
  ('alay', 'nature', 'Алай', 'Алай', 'Alay', 'Ленин чокусунун мекени',
    array['Чоң Алай кырка тоосунун эң бийик чокусу — Ленин чокусу, 7137 метр.', 'Ачыкташ альплагери ушул жерде жайгашкан, альпинизм үчүн ыңгайлуу.'],
    'verified', 10),
  ('sary-chelek', 'nature', 'Сары-Челек', 'Сары-Челек', 'Sary-Chelek', 'ЮНЕСКОнун бүткүл дүйнөлүк мурасы',
    array['Тереңдиги 244 метр — Ысык-Көлдөн кийинки Кыргызстандагы эң терең көл.', '1979-жылы ЮНЕСКОнун биосфералык коруктар тизмесине, 2016-жылы Бүткүл дүйнөлүк мурас тизмесине кирген.'],
    'verified', 11),
  ('arslanbob', 'nature', 'Арсланбоб', 'Арсланбоб', 'Arslanbob', 'Дүйнөдөгү эң чоң жаңгак токою',
    array['Жалал-Абад облусунда, Арстанбап өрөөнүндө жайгашкан.', 'Айрым жаңгак дарактарынын жашы миң жылдан ашык.'],
    'partially_verified', 12),
  ('ala-too', 'nature', 'Ала-Тоо', 'Ала-Тоо', 'Ala-Too', 'Түндүк Тянь-Шандын улуу кырка тоосу',
    array['Узундугу 454 км, эң бийик чокусу — Аламүдүн чокусу, 4895 метр.', 'Чүй өрөөнүн Талас, Суусамыр, Кочкор өрөөндөрүнөн бөлүп турат.'],
    'verified', 13);

insert into public.quests (id, character_id, title, subtitle, total_count, cta_label) values
  ('lost-shyrdak', 'boru', 'Жоголгон шырдакты тап', 'Бөрү сага жардамга муктаж!', 5, 'Квестти улантуу');
