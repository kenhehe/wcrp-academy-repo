-- Pre/post survey module: tables (docs/surveys/PLAN.md, section 6). Phase 1.
--
-- Applied 2026-10-26 by hand in the Supabase SQL editor (dry run in begin/rollback first).
-- Safe to re-run.
--
-- Every survey table is service-role only: RLS on with no policies, and privileges revoked
-- from anon/authenticated, so the browser's anon key can't reach survey data through the REST
-- API. The app reads and writes with createAdminClient() after requireAcademyAdmin() (admin
-- pages) or after checking a participant's token/cookie (the public /s/ pages).
--
-- Append-only tables (question versions, answers, email log, merges, admin log) have
-- created_at only; the rest also have updated_at, kept by a trigger.

-- ─── Helper functions ──────────────────────────────────────────────────────────

create or replace function survey_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- Pseudonyms like 'P-7F3K', shown in every result instead of an email.
-- The alphabet leaves out 0/O and 1/I so codes are easy to read.
create or replace function survey_new_pseudonym()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  code text;
begin
  loop
    code := 'P-';
    for i in 1..4 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from survey_people where pseudonym = code);
  end loop;
  return code;
end
$$;

-- ─── People ────────────────────────────────────────────────────────────────────

-- One row per email address, across every survey. The email is set to null by the
-- retention job (24 months after the event); the pseudonym and answers stay.
create table if not exists survey_people (
  id              uuid primary key default gen_random_uuid(),
  email           text unique check (email = lower(btrim(email))),
  pseudonym       text not null unique default survey_new_pseudonym(),
  email_purged_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─── Surveys ───────────────────────────────────────────────────────────────────

-- One survey per Academy catalogue event. The catalogue sync upserts on academy_id and
-- keeps row ids, so this link survives syncs; deleting a catalogue event that has a
-- survey is refused (on delete restrict).
create table if not exists survey_events (
  id               uuid primary key default gen_random_uuid(),
  academy_event_id uuid not null unique references academy_events(id) on delete restrict,
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title            text not null check (btrim(title) <> ''),
  -- Typed on the New survey page when the catalogue has no dates; used to suggest windows
  event_starts_at  timestamptz,
  event_ends_at    timestamptz,
  pre_opens_at     timestamptz,
  pre_closes_at    timestamptz,
  post_opens_at    timestamptz,
  post_closes_at   timestamptz,
  status           text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (event_starts_at is null or event_ends_at is null or event_ends_at >= event_starts_at),
  check (pre_opens_at is null or pre_closes_at is null or pre_closes_at > pre_opens_at),
  check (post_opens_at is null or post_closes_at is null or post_closes_at > post_opens_at),
  -- A survey can't go live without all four window times
  check (status = 'draft' or (pre_opens_at is not null and pre_closes_at is not null
                              and post_opens_at is not null and post_closes_at is not null))
);

-- ─── Questions ─────────────────────────────────────────────────────────────────

-- A stable question. Its wording lives in versions: changing a question adds a version,
-- so results never mix two wordings.
create table if not exists survey_questions (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique check (key ~ '^[a-z0-9_-]+(\.[a-z0-9_-]+)+$'),  -- 'core.understanding'
  is_core    boolean not null default false,
  type       text not null check (type in ('likert_5', 'single_choice', 'multi_choice', 'knowledge_mcq', 'text')),
  stage      text not null check (stage in ('pre', 'post', 'both')),
  in_bank    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists survey_question_versions (
  id              uuid primary key default gen_random_uuid(),
  question_id     uuid not null references survey_questions(id) on delete restrict,
  version         int not null check (version >= 1),
  text            text not null check (btrim(text) <> ''),
  options         jsonb check (options is null or jsonb_typeof(options) = 'array'),  -- choice labels, in order
  scale_min_label text,   -- likert_5: what 1 means
  scale_max_label text,   -- likert_5: what 5 means
  correct_option  text,   -- knowledge_mcq only
  is_required     boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (question_id, version)
);

-- Which question versions a survey asks, at which stage, in what order
create table if not exists survey_event_questions (
  survey_event_id     uuid not null references survey_events(id) on delete cascade,
  question_version_id uuid not null references survey_question_versions(id) on delete restrict,
  stage               text not null check (stage in ('pre', 'post', 'both')),
  sort_order          int not null,
  primary key (survey_event_id, question_version_id)
);

-- ─── Participants and answers ──────────────────────────────────────────────────

-- Who is in which survey. Only the SHA-256 of the personal-link token is stored; the raw
-- token exists only in the emails and links sent to the person.
create table if not exists survey_event_participants (
  id              uuid primary key default gen_random_uuid(),
  survey_event_id uuid not null references survey_events(id) on delete cascade,
  person_id       uuid not null references survey_people(id) on delete restrict,
  token_hash      text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  source          text not null check (source in ('imported', 'walk_in')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (survey_event_id, person_id)
);
create index if not exists survey_event_participants_person_idx on survey_event_participants (person_id);

-- A participant with answers can't be removed (on delete restrict), and so neither can
-- their survey: deleting a survey only cascades through participants who never answered.
create table if not exists survey_submissions (
  id                   uuid primary key default gen_random_uuid(),
  event_participant_id uuid not null references survey_event_participants(id) on delete restrict,
  stage                text not null check (stage in ('pre', 'post')),
  channel              text not null check (channel in ('email_link', 'qr_cookie', 'qr_email')),
  status               text not null default 'accepted' check (status in ('accepted', 'flagged_duplicate')),
  submitted_at         timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
-- At most one accepted submission per participant and stage; later ones are flagged
create unique index if not exists survey_submissions_one_accepted
  on survey_submissions (event_participant_id, stage)
  where status = 'accepted';

create table if not exists survey_answers (
  id                  uuid primary key default gen_random_uuid(),
  submission_id       uuid not null references survey_submissions(id) on delete cascade,
  question_version_id uuid not null references survey_question_versions(id) on delete restrict,
  value_number        numeric,
  value_text          text,
  value_choices       text[],
  created_at          timestamptz not null default now(),
  unique (submission_id, question_version_id),
  check (value_number is not null or value_text is not null or value_choices is not null)
);
create index if not exists survey_answers_question_idx on survey_answers (question_version_id);

-- ─── Email ─────────────────────────────────────────────────────────────────────

create table if not exists survey_email_jobs (
  id              uuid primary key default gen_random_uuid(),
  survey_event_id uuid not null references survey_events(id) on delete cascade,
  kind            text not null check (kind in ('invite_pre', 'reminder_pre', 'confirmation', 'invite_post', 'reminder_post')),
  rule            text,   -- the timing rule that made it, e.g. 'post_open_plus_1h'; null for "send now"
  scheduled_at    timestamptz not null,
  status          text not null default 'scheduled' check (status in ('scheduled', 'sending', 'done', 'cancelled')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists survey_email_jobs_due_idx on survey_email_jobs (scheduled_at) where status = 'scheduled';

create table if not exists survey_email_log (
  id                   uuid primary key default gen_random_uuid(),
  job_id               uuid references survey_email_jobs(id) on delete set null,  -- null: thank-you emails, one-off resends
  event_participant_id uuid not null references survey_event_participants(id) on delete cascade,
  kind                 text not null check (kind in ('invite_pre', 'reminder_pre', 'confirmation', 'invite_post', 'reminder_post')),
  status               text not null check (status in ('sent', 'failed', 'bounced')),
  error                text,
  sent_at              timestamptz not null default now()
);
create index if not exists survey_email_log_participant_idx on survey_email_log (event_participant_id);

-- ─── Audit ─────────────────────────────────────────────────────────────────────

create table if not exists survey_merges (
  id               uuid primary key default gen_random_uuid(),
  kept_person_id   uuid not null references survey_people(id) on delete restrict,
  merged_person_id uuid not null,  -- no foreign key: that person's row is deleted once merged
  merged_by        uuid references auth.users(id) on delete set null,
  merged_at        timestamptz not null default now()
);

-- Other admin actions worth a record: deleting a survey, sending now, removing a participant
create table if not exists survey_admin_log (
  id              uuid primary key default gen_random_uuid(),
  actor_id        uuid references auth.users(id) on delete set null,
  action          text not null,  -- e.g. 'survey.delete', 'email.send_now', 'participant.remove'
  survey_event_id uuid references survey_events(id) on delete set null,
  detail          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

-- ─── updated_at triggers ───────────────────────────────────────────────────────

create or replace trigger survey_people_touch_updated_at
  before update on survey_people for each row execute function survey_touch_updated_at();
create or replace trigger survey_events_touch_updated_at
  before update on survey_events for each row execute function survey_touch_updated_at();
create or replace trigger survey_questions_touch_updated_at
  before update on survey_questions for each row execute function survey_touch_updated_at();
create or replace trigger survey_event_participants_touch_updated_at
  before update on survey_event_participants for each row execute function survey_touch_updated_at();
create or replace trigger survey_submissions_touch_updated_at
  before update on survey_submissions for each row execute function survey_touch_updated_at();
create or replace trigger survey_email_jobs_touch_updated_at
  before update on survey_email_jobs for each row execute function survey_touch_updated_at();

-- ─── Lock down: service role only ──────────────────────────────────────────────
-- Written out table by table (not in a loop) so the SQL editor's RLS check can see it.

alter table survey_people             enable row level security;
alter table survey_events             enable row level security;
alter table survey_questions          enable row level security;
alter table survey_question_versions  enable row level security;
alter table survey_event_questions    enable row level security;
alter table survey_event_participants enable row level security;
alter table survey_submissions        enable row level security;
alter table survey_answers            enable row level security;
alter table survey_email_jobs         enable row level security;
alter table survey_email_log          enable row level security;
alter table survey_merges             enable row level security;
alter table survey_admin_log          enable row level security;

revoke all on table
  survey_people, survey_events, survey_questions, survey_question_versions,
  survey_event_questions, survey_event_participants, survey_submissions, survey_answers,
  survey_email_jobs, survey_email_log, survey_merges, survey_admin_log
from anon, authenticated;

grant all on table
  survey_people, survey_events, survey_questions, survey_question_versions,
  survey_event_questions, survey_event_participants, survey_submissions, survey_answers,
  survey_email_jobs, survey_email_log, survey_merges, survey_admin_log
to service_role;

-- PostgREST exposes public functions as /rpc/*; keep these two server-side
revoke execute on function survey_new_pseudonym() from public, anon, authenticated;
revoke execute on function survey_touch_updated_at() from public, anon, authenticated;
grant execute on function survey_new_pseudonym() to service_role;
grant execute on function survey_touch_updated_at() to service_role;
