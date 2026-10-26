# Pre/Post Survey Module: Plan

**Owner:** Ken Ramirez (WCRP Academy Support Unit)
**Branch:** `feat/surveys`
**Last updated:** 2026-10-26
**Mockup:** https://claude.ai/artifact/A5oSURymNzTSYQNgXhF3CE (every screen, the phone flow and the five emails; private, share it before sending the link on)

This is Ken's original implementation plan, adapted to this repo after Phase 0 (recon) and the mockup review. Where the original plan and the repo disagreed, the repo's conventions won; each change is listed under "Changes from the original plan".

---

## 1. Goal

The Academy can count events and attendees but can't show whether an event had an **impact**. This module asks participants the **same questions before and after** an event, links each person's two sets of answers, and reports the change.

Uses: evidence of impact for the Academy stocktake (outcomes, not only outputs), use cases to show IPOs, and learning which events work. Internal use only, no external survey tools.

---

## 2. Decisions

| Topic | Decision |
|---|---|
| Where it lives | A new section of the Academy dashboard: `/dashboard/academy/surveys` |
| Who runs it | The Academy team: the existing `academy_admin` role. No new login or allowlist. |
| Events | A survey attaches to an **Academy catalogue event** (`academy_events`), not to the IPO `events` table. One survey per event. Scope kept narrow while the module is new. |
| Database | Production (the only Supabase project). Migrations are written as files, reviewed, dry-run, then applied by hand in the SQL editor. |
| Matching | Personal link per participant; QR code with email entry as the fallback; the device is remembered |
| Stages | Before (`pre`) and after (`post`) only. The model allows more stages later. |
| Questions | Core questions (same in every survey, locked, versioned) + the event's own questions |
| Results | Anonymised: admins never see answers next to a name or email |
| Email sender | Sent **by the app over SMTP (Infomaniak)**, not MailerLite (section 9). Recommended: a mailbox of its own, `WCRP Academy <surveys@wcrp-academy.org>`, with replies going to `office@wcrp-academy.org`; not a no-reply address |
| Email look | The newsletter's header and footer, with a body designed for surveys |
| QR codes | Downloadable PNG and SVG on the survey's QR tab; presenters put them in their own slides. No separate slide screen. |
| Language | English only |

### Changes from the original plan

| Original | Changed to | Why |
|---|---|---|
| `/admin/surveys/**` | `/dashboard/academy/surveys/**` | Every Academy page lives there; `app/dashboard/academy/layout.tsx` and `proxy.ts` already gate it to `academy_admin` |
| Admin auth with an email allowlist | Existing `academy_admin` role + `requireAcademyAdmin()` (`lib/auth/guards.ts`) in every server action and loader | Same people, already enforced; a second admin list would drift |
| `event_id` → `events` | `academy_event_id` → `academy_events` | Ken's call: Academy events only for now |
| "Migrations apply on a dev DB" | Dry run in the SQL editor inside `begin … rollback`, then the real run | There is no dev database |
| `email citext` | `text` with a lower-case check | Avoids enabling an extension; the app normalises emails anyway |
| Windows prefilled from the event's dates | The admin types the event's start and end on the New survey page; windows are suggested from them | 308 of 309 `academy_events` rows have no dates (likely a WordPress sync bug, see Open items) |
| Vercel Cron for sending | `pg_cron` + `pg_net` calling a protected route, key from Vault | Matches the scrapers' scheduling; the Vercel cron was removed on 2026-10-24 |
| No admin log | `survey_admin_log` table | Section 11 asks for merges, deletes and sends to be logged |
| Token = 32 random bytes | Token = HMAC-SHA256 of the participant id with `SURVEYS_SECRET`; still only its SHA-256 is stored | The same personal link can be shown ("Copy link") and re-sent in every email without storing it |
| Sender `office@wcrp-academy.org` | A dedicated mailbox (e.g. `surveys@`), Reply-To `office@` | Infomaniak's limit is per address (200 or 500 per 24 h); survey emails shouldn't use up the office mailbox's quota |

---

## 3. Routes

**Admin (Academy dashboard, `academy_admin` only)**

| Route | What |
|---|---|
| `/dashboard/academy/surveys` | List: survey, Academy event, status, before / after / matched, match rate |
| `/dashboard/academy/surveys/new` | Create: pick the Academy event, name, event dates, windows (suggested), questions, emails; saves a draft |
| `/dashboard/academy/surveys/[slug]` | One survey, tabs via `?tab=`: Setup, Participants, Send, QR codes, Results (anonymised), Export |
| `/dashboard/academy/surveys/[slug]/preview?stage=pre\|post` | The survey as a participant sees it; answers not saved |
| `/dashboard/academy/surveys/[slug]/export/answers.csv`, `…/participants.csv` | The two exports (route handler, admins only) |
| `/dashboard/academy/surveys/analytics` | Core questions across every survey |

Sidebar: a new **Surveys** group in `components/layout/AcademySidebar` (Surveys, Survey analytics).

**Participant (no login)**

| Route | What |
|---|---|
| `/s/[slug]/pre`, `/s/[slug]/post` | The survey; QR codes point here. `?t=TOKEN` makes it a personal link. |
| `/s/[slug]/stop?t=TOKEN` | "Stop reminders for this survey" from an email footer (asks before switching off) |
| `POST /api/surveys/cron` | Sends due emails; called by `pg_cron` with `Authorization: Bearer SURVEYS_CRON_SECRET` |

`/s/` and the cron route get an exception in `proxy.ts` (like `/api/v1/`), because neither has a session. All reads and writes behind it run server-side with the service role after checking the token or the device cookie (section 11).

---

## 4. Identity and matching

The **email address** is the stable identity. Tokens and cookies are shortcuts to it, so people rarely type it.

### Resolution order on a survey page
1. **Token in the URL** (`?t=…`) is valid → participant known; set the device cookie; no typing.
2. **Device cookie** (signed, httpOnly, holds `person_id`) → "Continue as k•••@gmail.com?" with "Not you?", which clears the cookie.
3. **Email form** (one field) → trim, lower-case → find the person:
   - already in this survey → continue as them
   - not in this survey → add as a walk-in (`source = 'walk_in'`)
   - not known at all → create the person, then add as a walk-in
   - suggest a fix for common domain typos ("Did you mean …@gmail.com?")
   - after a **before** submission without a personal link, email the thank-you with their personal **after** link

### Duplicates and conflicts
- One accepted submission per participant per stage; **the first one locks**.
- A later submission for the same stage **with the token** replaces it, only while the window is open.
- A later submission **without the token** (email typed) is saved as a **flagged duplicate** for review and never overwrites. This stops someone overwriting another person's answers by typing their email.
- After with no before → saved and counted as "after only (unmatched)".
- A different email before and after → two people; the admin can **merge** them (Participants tab).

### Scenarios (all must pass, section 14)
| # | Scenario | Expected |
|---|---|---|
| 1 | Before via email link, after via email link | Matched automatically |
| 2 | Before via email link, after via QR, same phone | "Continue as…?" → matched |
| 3 | Before via email link, after via QR, other device | Enter email → matched |
| 4 | Before via QR, after via QR, same phone | Email once, then one tap → matched |
| 5 | Before via QR, forgets the after | Reminder with personal after link → matched |
| 6 | Before at the event, after at home on a laptop | Personal link from email, or enter email → matched |
| 7 | Walk-in (not imported) | Created on first scan, flagged walk-in → matched |
| 8 | Different email after | Two records → admin merge |
| 9 | Email typo | Domain suggestion; if still wrong → unmatched, admin can merge |
| 10 | Shared device | "Not you?" clears the cookie |
| 11 | After only | Saved, counted as unmatched |
| 12 | Submits before twice | First locks; token re-submit replaces while open; non-token re-submit flagged |

---

## 5. Questions

- **Core questions:** added to every survey automatically; wording and scale locked. Changing one creates a **new version**; reports never mix versions.
- **Event questions:** added per survey; can be saved to the bank for reuse.
- Types: `likert_5`, `single_choice`, `multi_choice`, `knowledge_mcq` (has a correct option), `text`.
- Stage: `pre`, `post`, or `both` (the paired ones that measure change).
- Questions lock once the first answer arrives.

### Core set v1 (draft, for Laura to confirm before go-live)
| Key | Stage | Type | Wording |
|---|---|---|---|
| `core.understanding` | both | likert_5 | How would you rate your understanding of today's topic? |
| `core.confidence_apply` | both | likert_5 | How confident are you in applying this topic in your work or studies? |
| `core.confidence_explain` | both | likert_5 | How confident are you in explaining this topic to others? |
| `core.personal_impact` | both | text | In one or two sentences, how does climate change affect you or your work? |
| `core.career_stage` | pre | single_choice | Career stage: Student / Early career / Mid career / Senior / Other |
| `core.region` | pre | single_choice | Region (WMO Regions I–VI) |
| `core.usefulness` | post | likert_5 | How useful was this event for you? |
| `core.recommend` | post | single_choice | Would you recommend this event to a colleague? Yes / No / Not sure |
| `core.feedback` | post | text | Any other feedback? (optional) |

Seeded by `supabase/migrations/20261026_survey_core_questions.sql`. Keep demographic questions few: fewer identifying details protects anonymity.

**Changing core questions:** on the **Core questions** page (`/dashboard/academy/core-questions`, logic in `lib/surveys/core-questions.ts`):
- edit wording, choices, scale labels, required: a version nobody has answered is edited in place; once answered, saving creates the next version, and surveys nobody has answered yet move to it while answered surveys keep theirs
- answer type and stage stay fixed (retire the question and add a new one instead)
- add a core question (new surveys ask it), retire / restore (new surveys stop / start asking it), reorder
- the order and retiring are columns on `survey_questions` (`core_order`, `retired_at`; `20261027_core_question_order.sql`)

---

## 6. Data model

Files: `supabase/migrations/20261026_survey_module.sql` (tables) and `20261026_survey_core_questions.sql` (seed). TypeScript mirror: `lib/data/surveys.types.ts`.

| Table | Holds |
|---|---|
| `survey_people` | One row per email (lower-case, unique; null after the retention purge) and a pseudonym like `P-7F3K` used in every result |
| `survey_events` | A survey: `academy_event_id` (unique), slug, title, event start/end, the four window times, status `draft` / `active` / `closed` |
| `survey_questions` + `survey_question_versions` | Stable question (`key`, type, stage, core or not, in the bank) and its versioned wording, options, scale labels, correct option |
| `survey_event_questions` | Which question versions a survey asks, in what order and at which stage |
| `survey_event_participants` | Who is in which survey: `token_hash` (SHA-256; the raw token only ever lives in emails and links), `source` imported / walk-in |
| `survey_submissions` | One per participant per stage and channel; status accepted / flagged duplicate; at most one accepted per participant and stage (partial unique index) |
| `survey_answers` | Number, text or choices per question version |
| `survey_email_jobs` | Scheduled sends: kind (invite_pre, reminder_pre, confirmation, invite_post, reminder_post), rule, time, status |
| `survey_email_log` | Every email sent, failed or bounced |
| `survey_merges` | Audit of person merges |
| `survey_admin_log` | Audit of other admin actions (delete, send, close) |

Rules:
- **RLS on every table with no policies, and `revoke all` from `anon` and `authenticated`.** Only the service role (`createAdminClient()`) reads or writes them. Loaders call `requireAcademyAdmin()` first, since the admin client skips RLS.
- Tokens: 32 random bytes, URL-safe; only the hash is stored.
- All times are `timestamptz` (exact instants).

---

## 7. Admin screens (as in the mockup)

- **Surveys list:** headline tiles (active, matched, average match rate, needs review), status filter, table with a match-rate meter.
- **New survey:** (1) search the Academy catalogue; an event that already has a survey is disabled; name prefilled from the event; (2) event start and end (prefilled when the catalogue has them), windows suggested (before: a week ahead until the event starts; after: from the end, open 2 weeks), editable, with a timeline; (3) core questions listed, the event's own questions added inline; (4) the five emails with their timing. A checklist on the right; **Create draft** only once the event and dates are set. Nothing is sent from a draft.
- **Survey page tabs:**
  - **Setup:** the Academy event, windows, questions (locked banner once answers exist), preview before / after.
  - **Participants:** import (paste or CSV, e.g. a Zoom export: dedupe, validate, report bad rows); email + status only, never answers; resend, remove, merge.
  - **Send:** send now; reminder rules on/off; email log.
  - **QR codes:** before and after codes, download PNG / SVG, copy link.
  - **Export:** answers CSV (pseudonyms only), participants and status CSV (no answers), one-page PDF.
- **Results** and **Analytics:** section 10.

---

## 8. Participant pages

- `/s/[slug]/pre` and `/s/[slug]/post`, mobile first, accessible (labels, keyboard, contrast), no third-party scripts.
- Flow: resolve identity → check the window ("not open yet" / "closed") → consent → questions → submit → thank you (before: "We'll email you the link to the after-survey").
- Consent (draft): "Your answers help the WCRP Academy understand the impact of its events. Answers are analysed anonymously and used only by the Academy. Your email is used only to send you survey links and is deleted 24 months after the event."
- Times on the page are shown in the participant's own local time.

---

## 9. Emails

**Transport:** SMTP through Infomaniak with `nodemailer` (`lib/surveys/email/send.ts`), settings in env vars (section 12a).

**Infomaniak limits** (checked 2026-10-26, [their FAQ](https://www.infomaniak.com/en/support/faq/2065/understanding-the-24-hour-outgoing-email-limit)): 200 emails per 24 h on Mail Service Starter, 500 on Premium, **per address**, over a rolling 24 h window, and every recipient counts (one email to 42 people = 42). Bulk mail is meant for their Newsletter tool; a paid address can get a higher limit on a written, justified request. So:
- send from a **mailbox of its own** (e.g. `surveys@wcrp-academy.org`), so surveys don't eat the office mailbox's quota and vice versa;
- the app counts what it sent in the last 24 h and never goes past `SURVEYS_EMAIL_DAILY_LIMIT` (default 180); what's left waits for the next 10-minute run;
- one run sends at most 50 (keeps it inside the function time limit);
- a survey of ~150 people needs ~150 invites plus reminders on the busiest day: fine on Premium, tight on Starter. Ask Infomaniak for a higher limit if surveys grow.

**Not a no-reply address:** replies (questions, "please remove me", out-of-office) should reach a person, and mailbox providers treat reply-able mail as more trustworthy. `SURVEYS_EMAIL_REPLY_TO=office@wcrp-academy.org` sends replies to the team.

**DNS (checked 2026-10-26):** MX → Infomaniak; SPF `v=spf1 include:_spf.mlsend.com include:spf.infomaniak.ch -all` already covers Infomaniak; DMARC `p=reject` with **strict** alignment (`adkim=s; aspf=s`). Mail must therefore come from an `@wcrp-academy.org` address, sent through Infomaniak's SMTP as that same mailbox. Check in the Infomaniak manager that DKIM signing is on for the domain, then use the Send tab's "Send me a test" to Gmail and Outlook and look at the headers (SPF, DKIM, DMARC all "pass").

**Why not MailerLite** (decided 2026-10-26):
- An unsubscribe in MailerLite removes the person from every group by default, so stopping survey reminders would also drop them from the newsletter, and newsletter leavers couldn't receive their survey link. MailerLite also can't put unsubscribed people back through its API.
- Every email carries a personal link, and reminders go only to people who haven't answered; MailerLite would need each person's link and status copied in before every send.
- Every participant would become a newsletter subscriber without signing up for it, count toward the plan, and need deleting there too after 24 months.
- Possible later: an "also send me the newsletter" tick box that adds only those people to MailerLite.

**The five emails** (mockup boards 6a–6e):

| Kind | When | To |
|---|---|---|
| `invite_pre` | When the before-survey opens | Everyone imported |
| `reminder_pre` | 24 h before the before-survey closes | Not answered before |
| `confirmation` | Right after a before-survey answered without a personal link (QR) | That person; includes their personal after link |
| `invite_post` | When the after-survey opens | Everyone in the survey |
| `reminder_post` | 1 h and 24 h after the after-survey opens, and 24 h before it closes | Answered before, not after |

**Look:** the newsletter's dark header with the logo and its dark footer (logo, social icons, website, why you got this). The body is our own: event name, a plain headline, a two-step before/after tracker, a details box (time needed, opens/closes, privacy), a button in the survey page's blue, a backup link, privacy line. The footer link is **"Stop reminders for this survey"**, never a newsletter unsubscribe.

**Times in emails:** UTC first, then Manila, as the newsletter does: "27 Oct 2026, 15:59 UTC (23:59 PHT / UTC+8)". Emails can't know the reader's time zone; the survey page shows their local time.

**Colours:** email apps ignore CSS variables, so email templates use fixed colour codes, kept in one file (an exception to the "no hardcoded hex" rule). Needed from the newsletter: the logo image (white version for the dark band), the exact colours, the social links.

---

## 10. Results and analytics

- **Matched participant:** an accepted before **and** an accepted after.
- **Match rate:** matched ÷ participants who answered before. Always shown.
- **Likert paired questions (matched only):** mean before, mean after, change, % higher / same / lower, n. Shown as a dumbbell chart (before = hollow ring, after = filled) and a 1–5 distribution shift.
- **Knowledge questions:** % correct before vs after (matched only).
- **Text paired questions:** side by side per pseudonym; after-only feedback listed.
- **Small groups:** any breakdown with n < 5 is hidden.
- Wording: "participants reported…", never causal claims.
- **Analytics:** core questions only (same version) across surveys; trend over time; breakdowns by training type (`academy_events.training_type`), WMO region and career stage; filters for year and training type. Headline sentence like "Across 18 events in 2027, average understanding rose from 2.9 to 3.9 (n = 640 matched, 61% match rate)."
- **PDF report:** one page per survey: headline numbers, dumbbell chart, 3–5 quotes the admin picks, match rate and n.

---

## 11. Security and privacy

- RLS on, no policies, privileges revoked from `anon` / `authenticated` on every survey table; participant requests validated server-side (token or cookie) on every call.
- Device cookie: signed, httpOnly, `SameSite=Lax`, holds only `person_id` + signature (secret in an env var).
- Rate limits on the email-entry and submit endpoints (simple per-IP).
- Emails never appear next to answers in the UI or exports.
- Retention job: delete emails 24 months after the event ends (config value); keep pseudonyms and answers.
- Admin actions (merge, delete, send) logged.
- Accepted risk: a forwarded personal link identifies the recipient as the original person (documented, test checklist).

---

## 12. Build notes required by the repo

### Skeleton strategy
- Every new route gets a `loading.tsx` built from `@/components/ui/skeleton` in the shape of the real page: list (tiles + table rows), survey page (header, funnel, tab bar, the active tab's cards), results (tiles + chart blocks), analytics (filters + tiles + chart blocks).
- Heavy parts (results charts, analytics) load inside `<Suspense>` with their own skeletons so the page header renders immediately.
- Participant pages: a light skeleton of the question list; the page is small and server-rendered.

### Caching logic
- Admin pages: `export const dynamic = 'force-dynamic'` (private data, like every dashboard page); loaders wrapped in React `cache()` to dedupe within a request.
- Participant pages: dynamic, `no-store` (token- and cookie-dependent).
- Mutations (server actions in each route's `actions.ts`, starting with `requireAcademyAdmin()`): `revalidatePath('/dashboard/academy/surveys', 'layout')` after every change.
- Sending and reminders run from a protected route called by `pg_cron`; it never caches.

### shadcn / UI components
- Already installed: `button`, `card`, `input`, `label`, `textarea`, `select`, `checkbox`, `tabs`, `table`, `badge`, `dialog`, `alert-dialog`, `dropdown-menu`, `popover`, `progress`, `separator`, `skeleton`, `sonner`.
- No new shadcn components: participant answers and the event picker use native radio/checkbox inputs styled with tokens (large tap targets, fieldset + legend); the Send tab's on/off control is a small `role="switch"` button.
- New dependencies: `nodemailer` 10.1.7 (ships its own types) and `qrcode` 1.5.4 (+ `@types/qrcode`). Production `npm audit`: 0 vulnerabilities.
- Results charts are plain HTML on theme tokens; the 1–5 answer scale uses new `--scale-1…5` tokens (one blue hue, validated with the dataviz validator against the card colour in light and dark).
- Project pieces reused: `PageHeader`, `StatTile`, `StatusBadge`, charts in `components/charts/`.
- New dependencies, decided per phase: `nodemailer` (Phase 6), a QR generator such as `qrcode` (Phase 5), a CSV parser if the import needs more than a split (Phase 3), a PDF approach (Phase 9).

---

## 12a. Setup before the module goes live

**Env vars** (`.env.local` for development, Vercel Production + Preview for deployments):

| Variable | What | Status |
|---|---|---|
| `SURVEYS_SECRET` | Signs personal links and the device cookie (32+ random characters). Must be **the same everywhere**, or links made in one place fail in another | In `.env.local` and on Vercel (2026-10-26) |
| `SURVEYS_BASE_URL` | `https://wcrp-academy-repo.vercel.app`: the address in links, QR codes and emails | Set on Vercel (optional locally) |
| `SURVEYS_SMTP_HOST` / `_PORT` / `_USER` / `_PASS` | Infomaniak SMTP (`mail.infomaniak.com`, 587) and the mailbox's login | Waiting for the mailbox |
| `SURVEYS_EMAIL_FROM` | `WCRP Academy <surveys@wcrp-academy.org>` | Waiting for the mailbox |
| `SURVEYS_EMAIL_REPLY_TO` | `office@wcrp-academy.org` | Optional |
| `SURVEYS_EMAIL_DAILY_LIMIT` | The mailbox's 24-h limit minus headroom (180 for Starter, 450 for Premium) | Optional, default 180 |
| `SURVEYS_EMAIL_LOGO_URL` | The newsletter logo (white, for the dark band) as an image URL | Optional, text wordmark until set |
| `SURVEYS_CRON_SECRET` | Bearer token for `/api/surveys/cron`; same value in Supabase Vault as `surveys_cron_secret` | In `.env.local` and on Vercel (2026-10-26); Vault still to do |

**Migrations:** `20261026_survey_email.sql` (the "stop reminders" column) was applied on 2026-10-26. Still to apply: `20261026_survey_email_cron.sql`, the 10-minute sending job, only after the code is deployed to production with the email env vars and the Vault secret is in place.

## 13. Build order

Each phase: build → run its checks (`npx tsc --noEmit`, `npm run lint`, `npm test`) → summarise → **wait for Ken's go-ahead**.

| Phase | Scope | Done when | Status |
|---|---|---|---|
| 0. Recon | Read the repo, adapt the plan, mockup | Ken approves | Done 2026-10-26 |
| 1. Schema | Migration files, core question seed, types | Dry run passes, Ken applies, anon key gets no access | Done 2026-10-26: applied; 12 tables, 9 core questions; anon key refused on every table and function |
| 2. Survey setup | List, New survey, Setup tab, preview, sidebar link | A survey with core + own questions can be created and previewed | Built 2026-10-26 (build, lint, 42 tests, queries checked on the live database); waiting for Ken's click-through |
| 3. Participants | Paste / CSV import, dedupe, validate, tokens, status list, remove, merge, copy personal link | 50 test emails imported; bad rows reported | Built 2026-10-26; import / merge / remove checked on the live database |
| 4. Public survey | `/s/[slug]/[stage]`, identity, cookie, walk-ins, windows, consent, duplicates, `proxy.ts` exception, open / close a survey | Scenarios 1–12 pass by hand | Built 2026-10-26; link, typed email, walk-in, duplicate and replace rules checked on the live database, pages checked over HTTP. Scenarios on real phones still to do |
| 5. QR | Before / after codes, PNG and SVG download | Scanning opens the right stage on a phone | Built 2026-10-26; phone scan still to do |
| 6. Email | SMTP, send now, log, thank-you email, scheduled jobs and reminders via `pg_cron`, stop-reminders page, test email | A test survey sends invites, a thank-you, and a reminder only to non-finishers | Built 2026-10-26, not sent for real yet: needs the mailbox, env vars and the two migrations (12a) |
| 7. Results | Results tab (before/after dumbbell, answer shifts, after-only, breakdowns with small groups hidden, who answered, quotes), CSV exports | Numbers checked by hand against seeded answers | Built 2026-10-26; demo results match the seeded figures (e.g. understanding 2.77 → 3.63, n = 64) |
| 8. Analytics | Cross-survey core dashboard, filters | Two seeded surveys aggregate correctly | |
| 9. Report, retention, polish | PDF, retention job, accessibility pass, rate limits | Report generated; retention tested | |

---

## 14. Test checklist

- [ ] All 12 scenarios on iOS Safari, Android Chrome and desktop
- [ ] QR scanned from the phone camera and from a messaging app's in-app browser
- [ ] Forwarded personal link: recognised as the original person (accepted risk)
- [ ] Outside its window the survey shows the right message
- [ ] Questions locked after the first answer
- [ ] Emails never next to answers (UI and exports)
- [ ] Small-group suppression works
- [ ] Deliverability: Gmail, Outlook and an `observatory.ph` address, not in spam
- [ ] Reminders only reach people with before done and after not done
- [ ] Merge moves submissions correctly and is logged
- [ ] Retention purges emails, keeps pseudonymous answers
- [ ] The anon key can't read any survey table

---

## 15. Open items

- **Demo data is in production** (seeded 2026-10-26 with `node scripts/survey-demo-data.mjs seed`): 8 surveys with slugs `demo-*` and titles "Demo: …", 532 people at `demo.*@example.org`, 717 submissions, 4,782 answers. **Remove before go-live** with `node scripts/survey-demo-data.mjs remove`; it also drops questions added to demo surveys. Re-seeding gives the same numbers.

- Core question wording: Laura to confirm before go-live.
- Infomaniak: create the survey mailbox, put its SMTP login in the env vars, confirm DKIM signing is on (section 9).
- `nodemailer` is pinned at 10.1.7, released 8 days before it was added: the two-week rule gave way to a security fix (10.1.0–10.1.3 have address-parsing advisories).
- A wrong stage in a participant URL (`/s/x/middle`) shows the 404 page with HTTP 200 (the page streams behind its loading screen). Harmless; noted.
- Newsletter assets: logo image for the dark band, exact colours, social links.
- `academy_events` dates: 308 of 309 rows have no `start_date` / `end_date`; `lib/wordpress/mapper.ts` (`parseDate(acf.event_start_date)`) probably reads the wrong field. Fixing it would let the New survey page prefill event dates.
- Deleting a catalogue event that has a survey is refused by the database (`on delete restrict`). The dashboard has no delete button today (`catalogue/_components/DeleteEventButton.tsx` and `deleteAcademyEventAction` are unused, and the action ignores the delete's error); `/api/academy/events/[id]` returns the database error. Clean up or wire up those leftovers separately.

## 16. Out of scope (for now)

Mid-point surveys, other languages, view-only roles, IPO self-service, surveys on IPO events, AI theme summaries, MailerLite or other external survey and email tools.
