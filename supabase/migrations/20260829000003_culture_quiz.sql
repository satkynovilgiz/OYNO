-- Culture home's "Билимиңди сына!" (QuizTeaserCard) has always been a
-- console.log placeholder - no quiz engine existed at all. Questions are a
-- direct comprehension check on facts already stored (and already
-- cited/verified) in explore_regions - not new or invented claims, same
-- "don't invent, only use sourced content" rule this project has followed
-- throughout (see culture_items/explore_regions seed comments).
--
-- correct_index is never exposed to the client: culture_quiz_questions has
-- RLS enabled with no select policy at all, so anon/authenticated get zero
-- rows via PostgREST directly. The only way to read a question is through
-- get_quiz_questions() below (id/question/choices only), and the only way
-- to find out if an answer was right is through claim_daily_quiz(), which
-- scores server-side - same "never trust the client with the answer key"
-- shape as discover_explore_item's hardcoded XP lookup.

create table public.culture_quiz_questions (
  id text primary key,
  question text not null,
  choices text[] not null check (array_length(choices, 1) = 4),
  correct_index int not null check (correct_index between 0 and 3),
  source_region_id text references public.explore_regions(id),
  sort_order int not null
);

alter table public.culture_quiz_questions enable row level security;
-- Deliberately no select policy - see comment above.

insert into public.culture_quiz_questions (id, question, choices, correct_index, source_region_id, sort_order) values
  ('depth-ysyk-kol', 'Ысык-Көлдүн тереңдиги канча метр?',
    array['502 метр', '702 метр', '902 метр', '1200 метр'], 1, 'ysyk-kol', 0),
  ('altitude-son-kol', 'Сон-Көл деңиз деңгээлинен канча метр бийикте жайгашкан?',
    array['1016 метр', '2016 метр', '3016 метр', '4016 метр'], 2, 'son-kol', 1),
  ('peak-lenin', 'Ленин чокусунун бийиктиги канча метр?',
    array['6137 метр', '7137 метр', '8137 метр', '5137 метр'], 1, 'alay', 2),
  ('unesco-sary-chelek', 'Сары-Челек кайсы жылы ЮНЕСКОнун биосфералык коруктар тизмесине кирген?',
    array['1969-жылы', '1979-жылы', '1989-жылы', '1999-жылы'], 1, 'sary-chelek', 3),
  ('epic-manas', '"Манас" эпосу Гиннестин рекорддор китебине эмне катары кирген?',
    array['Эң кыска эпос', 'Эң узун эпос', 'Эң эски жомок', 'Эң популярдуу ыр'], 1, 'talas', 4),
  ('batken-founded', 'Баткен облусу качан түзүлгөн?',
    array['1991-жылдын 13-октябрында', '1999-жылдын 13-октябрында', '2003-жылдын 13-октябрында', '1999-жылдын 13-майында'], 1, 'batken', 5),
  ('ala-too-length', 'Ала-Тоо кырка тоосунун узундугу канча км?',
    array['354 км', '454 км', '554 км', '254 км'], 1, 'ala-too', 6),
  ('bishkek-frunze', 'Бишкек шаары 1926-жылы кандай деп аталган?',
    array['Ош', 'Фрунзе', 'Пишпек', 'Талас'], 1, 'bishkek', 7);

-- One claim per calendar day, same shape as claim_daily_play/claim_daily_gift.
alter table public.user_progress add column quiz_claimed_date date;

create function public.get_quiz_questions()
returns table (id text, question text, choices text[])
language sql
security definer set search_path = public
stable
as $$
  select id, question, choices from public.culture_quiz_questions order by sort_order;
$$;
grant execute on function public.get_quiz_questions() to authenticated, anon;

-- QUIZ_PASS_RATIO must match src/features/culture/quiz.ts's own copy of
-- this constant (client only uses it to decide what UI copy to show after
-- a below-threshold attempt; the actual pass/fail gate for the reward is
-- enforced here, not trusted from the client).
create function public.claim_daily_quiz(p_answers jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_row public.user_progress;
  v_total int;
  v_correct int := 0;
  v_rewarded boolean := false;
  v_answer record;
begin
  if v_user_id is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select * into v_row from public.user_progress where user_id = v_user_id for update;
  if v_row.quiz_claimed_date = v_today then raise exception 'ALREADY_CLAIMED'; end if;

  select count(*) into v_total from public.culture_quiz_questions;

  for v_answer in select * from jsonb_to_recordset(p_answers) as x(question_id text, choice_index int)
  loop
    if exists (
      select 1 from public.culture_quiz_questions
      where id = v_answer.question_id and correct_index = v_answer.choice_index
    ) then
      v_correct := v_correct + 1;
    end if;
  end loop;

  update public.user_progress set quiz_claimed_date = v_today, updated_at = now() where user_id = v_user_id;

  -- 70%+ correct required for the reward - below that, still marks today's
  -- attempt used (matches every other daily action's once-per-day shape)
  -- but pays nothing, rather than pro-rating partial credit.
  if v_total > 0 and v_correct::float / v_total >= 0.7 then
    perform public.apply_reward(v_user_id, 40, 25, 'daily_quiz', null);
    v_rewarded := true;
  end if;

  select * into v_row from public.user_progress where user_id = v_user_id;
  return jsonb_build_object('progress', to_jsonb(v_row), 'correct', v_correct, 'total', v_total, 'rewarded', v_rewarded);
end;
$$;
grant execute on function public.claim_daily_quiz(jsonb) to authenticated;
