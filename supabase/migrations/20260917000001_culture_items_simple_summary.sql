-- Age-aware content presentation (spec "Build age-aware content
-- presentation... same cultural topic explainable at different depths...
-- Age variants must come from verified/localized content fields or
-- deterministic summaries already stored in OYNO, never AI-generated at
-- runtime"). Adds one new nullable column instead of a new table: a short,
-- pre-authored "simple" depth variant, distilled only from facts already
-- present in this same row's own history/cultural_meaning/etc fields (no
-- new claims). Existing rows keep rendering their full field breakdown as
-- today (that already serves the 'standard'/'advanced' depths) - a row
-- with no simple_summary yet just falls back to that same full view, per
-- the same spec's fallback rule.
alter table public.culture_items add column simple_summary text;

update public.culture_items set
  simple_summary = 'Боз үй - кыргыздардын байыркы көчмөн турак жайы. Жыгач каркасын кийиз менен жабышат, ошондуктан аны оңой куруп, бузса болот.'
where id = 'boz-uy-overview';

update public.culture_items set
  simple_summary = 'Түндүк - боз үйдүн жогорку жагындагы тегерек тешик, ошол жерден түтүн чыгат. Ал Кыргызстандын желегинде да тартылган.'
where id = 'boz-uy-tunduk';

update public.culture_items set
  simple_summary = 'Жыгач каркас керегеден (дубал), уктардан (чатыр таякчалары) жана түндүктөн турат. Усталар жыгачты ийип, так өлчөп курушат.'
where id = 'boz-uy-karkas';

update public.culture_items set
  simple_summary = 'Жыгач каркас даяр болгондон кийин, ага кой жүнүнөн жасалган кийиз жабуулар жабылат. Бул ишти көбүнчө бир нече аял чогуу аткарган.'
where id = 'boz-uy-kiyiz-jabuu';

update public.culture_items set
  simple_summary = 'Боз үйдүн ичи белгилүү тартип менен бөлүнөт: сол жагы эркектердики, оң жагы аялдардыкы, ортодо очок турат. Эң урматтуу орун "төр" деп аталат.'
where id = 'boz-uy-ichki-jasalga';

update public.culture_items set
  simple_summary = 'Ак өргөө - майрамдарда жана кадырлуу коноктор үчүн тигилген чоң, кооз боз үй. Ал жөнөкөй үйдөн көлөмү жана көркү менен айырмаланат.'
where id = 'boz-uy-ak-orgoo';
