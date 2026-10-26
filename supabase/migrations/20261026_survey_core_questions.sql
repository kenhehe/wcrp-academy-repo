-- Core survey questions, version 1 (docs/surveys/PLAN.md, section 5).
--
-- Applied 2026-10-26 by hand in the Supabase SQL editor, after 20261026_survey_module.sql.
-- Safe to re-run.
-- DRAFT wording: Laura to confirm before the first survey goes live. To change a question
-- after any survey has used it, insert version 2; never edit version 1, or old results
-- would silently mix two wordings.

insert into survey_questions (key, is_core, type, stage, in_bank) values
  ('core.understanding',       true, 'likert_5',      'both', false),
  ('core.confidence_apply',    true, 'likert_5',      'both', false),
  ('core.confidence_explain',  true, 'likert_5',      'both', false),
  ('core.personal_impact',     true, 'text',          'both', false),
  ('core.career_stage',        true, 'single_choice', 'pre',  false),
  ('core.region',              true, 'single_choice', 'pre',  false),
  ('core.usefulness',          true, 'likert_5',      'post', false),
  ('core.recommend',           true, 'single_choice', 'post', false),
  ('core.feedback',            true, 'text',          'post', false)
on conflict (key) do nothing;

insert into survey_question_versions (question_id, version, text, options, scale_min_label, scale_max_label, is_required)
select q.id, 1, v.text, v.options, v.min_label, v.max_label, v.required
from (values
  ('core.understanding',      'How would you rate your understanding of today''s topic?',
     null::jsonb, 'Very low', 'Very high', true),
  ('core.confidence_apply',   'How confident are you in applying this topic in your work or studies?',
     null, 'Not at all confident', 'Very confident', true),
  ('core.confidence_explain', 'How confident are you in explaining this topic to others?',
     null, 'Not at all confident', 'Very confident', true),
  ('core.personal_impact',    'In one or two sentences, how does climate change affect you or your work?',
     null, null, null, true),
  ('core.career_stage',       'What is your career stage?',
     '["Student", "Early career", "Mid career", "Senior", "Other"]', null, null, true),
  ('core.region',             'Which WMO region are you based in?',
     '["Region I: Africa", "Region II: Asia", "Region III: South America", "Region IV: North America, Central America and the Caribbean", "Region V: South-West Pacific", "Region VI: Europe"]',
     null, null, true),
  ('core.usefulness',         'How useful was this event for you?',
     null, 'Not useful', 'Very useful', true),
  ('core.recommend',          'Would you recommend this event to a colleague?',
     '["Yes", "No", "Not sure"]', null, null, true),
  ('core.feedback',           'Any other feedback?',
     null, null, null, false)
) as v(key, text, options, min_label, max_label, required)
join survey_questions q on q.key = v.key
on conflict (question_id, version) do nothing;
