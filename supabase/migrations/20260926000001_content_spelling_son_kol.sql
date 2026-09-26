-- Content correction (no schema change): standard Kyrgyz spelling of
-- Son-Kol is "Соң-Көл" (with ң). The app's UI strings already use it; the
-- region row and the Naryn fact still said "Сон-Көл", so the same lake
-- appeared under two spellings. RU "Сон-Куль" / EN "Son-Köl" unchanged.
-- Idempotent: only rewrites the exact old spelling.

update public.explore_regions
set name_kg = 'Соң-Көл'
where id = 'son-kol' and name_kg = 'Сон-Көл';

update public.explore_regions
set facts = array(select replace(fact, 'Сон-Көл', 'Соң-Көл') from unnest(facts) with ordinality as t(fact, n) order by n)
where id = 'naryn' and exists (select 1 from unnest(facts) as fact where fact like '%Сон-Көл%');
