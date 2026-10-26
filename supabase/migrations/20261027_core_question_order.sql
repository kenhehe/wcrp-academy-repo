-- Core questions page (Academy dashboard → Core questions): the order new surveys ask core
-- questions in, and retiring a core question so new surveys stop asking it (surveys that
-- already have it keep it). Until now the order lived in code (CORE_QUESTION_ORDER).
--
-- Applied 2026-10-27 by hand in the Supabase SQL editor, before the Core questions page was
-- deployed (the New survey page reads these columns). Safe to re-run.

alter table survey_questions add column if not exists core_order int;
alter table survey_questions add column if not exists retired_at timestamptz;

comment on column survey_questions.core_order is 'Core questions: position in a new survey (lowest first)';
comment on column survey_questions.retired_at is 'Core questions: set when retired; new surveys stop asking it';

-- The order the code used so far
update survey_questions q
set core_order = o.n
from (values
  ('core.understanding', 1), ('core.confidence_apply', 2), ('core.confidence_explain', 3),
  ('core.personal_impact', 4), ('core.career_stage', 5), ('core.region', 6),
  ('core.usefulness', 7), ('core.recommend', 8), ('core.feedback', 9)
) as o(key, n)
where q.key = o.key and q.core_order is null;
