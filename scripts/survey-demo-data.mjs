// Demo surveys, so the survey pages can be tried with realistic numbers before real ones exist.
// Everything this creates is marked and removable:
//   - survey slugs start with "demo-" and titles with "Demo: "
//   - participant emails are demo.<survey>.<n>@example.org (a domain reserved for examples)
//   - the demo surveys' own questions have keys starting with "demo."
//
//   node scripts/survey-demo-data.mjs seed     add the demo surveys (refuses if they exist)
//   node scripts/survey-demo-data.mjs remove   delete every demo row
//
// Run from the repo root; reads SUPABASE_SERVICE_ROLE_KEY from .env.local. Sends no email.
// Answers are random but seeded, so a re-seed gives the same numbers. Remove before go-live.
import { readFileSync } from 'node:fs'
import { createHash, createHmac, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('.env.local needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// Same personal-link token as lib/surveys/tokens.ts, so "Copy link" works for demo people too
function tokenHash(participantId) {
  if (!env.SURVEYS_SECRET || env.SURVEYS_SECRET.length < 32) throw new Error('.env.local needs SURVEYS_SECRET (32+ characters)')
  const token = createHmac('sha256', env.SURVEYS_SECRET).update(`participant:${participantId}`).digest('base64url')
  return createHash('sha256').update(token).digest('hex')
}

function must(label, { data, error }) {
  if (error) throw new Error(`${label} failed: ${error.message}`)
  return data
}

async function inChunks(label, items, size, fn) {
  for (let i = 0; i < items.length; i += size) must(label, await fn(items.slice(i, i + size)))
}

// ─── Seeded randomness ────────────────────────────────────────────────────────

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const normal = (r, mean, sd) => mean + sd * Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r())
const likert = v => Math.min(5, Math.max(1, Math.round(v)))
const pick   = (r, list) => list[Math.floor(r() * list.length)]
const weighted = (r, pairs) => {
  let x = r() * pairs.reduce((s, [, w]) => s + w, 0)
  for (const [value, w] of pairs) { if ((x -= w) <= 0) return value }
  return pairs[pairs.length - 1][0]
}
const between = (r, fromIso, toIso) => {
  const a = new Date(fromIso).getTime(), b = Math.min(new Date(toIso).getTime(), Date.now() - 60_000)
  return new Date(a + r() * Math.max(0, b - a)).toISOString()
}

// ─── What to create ───────────────────────────────────────────────────────────

const CAREERS = ['Student', 'Early career', 'Mid career', 'Senior', 'Other']
const REGIONS = ['Region I: Africa', 'Region II: Asia', 'Region III: South America', 'Region IV: North America, Central America and the Caribbean', 'Region V: South-West Pacific', 'Region VI: Europe']

const IMPACT_PRE = [
  'Heavier monsoon rains flood the area where I do fieldwork every year.',
  'I work on drought planning for farmers, so seasonal forecasts matter a lot to me.',
  'Heatwaves are getting longer in my city and affect the health clinics I support.',
  'I study coastal erosion; sea level rise is the backdrop to everything I measure.',
  'Not directly yet, but my students keep asking how projections are made.',
  'Our water utility has to plan for less snowmelt in spring.',
  'I advise local government on adaptation and need to explain uncertainty better.',
  'Typhoons are stronger and my family lives near the coast.',
]
const IMPACT_POST = [
  'I now see how model ensembles can support the flood planning I do.',
  'I want to use downscaled projections for the drought work, not just observations.',
  'I understand better where the uncertainty in heatwave projections comes from.',
  'The session helped me connect sea level projections to my erosion data.',
  'I can explain to my students how the scenarios are built and compared.',
  'I will look at the snow projections for our basin with the team.',
  'I feel more confident explaining ranges instead of single numbers to officials.',
  'It made the link between warming and typhoon intensity clearer for me.',
]
const FEEDBACK = [
  'More time for questions would help.',
  'Please share the slides and the data links.',
  'Great speakers, very clear.',
  'A hands-on session with the data would be a good follow-up.',
  'The time slot was hard for participants in the Americas.',
  'Recording would be useful for colleagues who missed it.',
]

// Counts per survey: pre/post = answered that stage, matched = answered both
const DEMOS = [
  {
    key: 'cmip4', slug: 'demo-cmip-seminar-2026-4', title: 'Demo: CMIP Seminar Series 2026 #4',
    academyEventId: '73b08534-b88d-4aa9-a148-9825ede10fd3', status: 'active',
    event: ['2026-10-13T06:00:00Z', '2026-10-13T08:00:00Z'],
    windows: ['2026-10-06T01:00:00Z', '2026-10-13T06:00:00Z', '2026-10-13T08:00:00Z', '2026-10-27T15:59:00Z'],
    imported: 142, walkIns: 9, pre: 118, post: 71, matched: 64, flagged: 2, base: 2.8, gain: 0.95,
    regions: [3, 6, 2, 3, 2, 4], careers: [3, 4, 3, 2, 0.3],
    own: [
      { key: 'demo.cmip_data_use', type: 'single_choice', stage: 'both', text: 'Have you used CMIP data in your own work?', options: ['Yes, often', 'Yes, once or twice', 'No'] },
      { key: 'demo.highresmip', type: 'likert_5', stage: 'both', text: 'How familiar are you with HighResMIP?', min: 'Not at all', max: 'Very familiar', base: 1.9, gain: 1.1 },
    ],
  },
  {
    key: 'writing', slug: 'demo-writing-for-global-impact', title: 'Demo: Writing for Global Impact',
    academyEventId: '35daf091-d973-4903-b54e-e39c2bcee7fb', status: 'active',
    event: ['2026-11-03T01:00:00Z', '2026-11-03T09:00:00Z'],
    windows: ['2026-10-19T01:00:00Z', '2026-11-03T01:00:00Z', '2026-11-03T09:00:00Z', '2026-11-17T15:59:00Z'],
    imported: 30, walkIns: 4, pre: 29, post: 0, matched: 0, flagged: 0, base: 2.7, gain: 0.8,
    regions: [1, 8, 0.5, 0.5, 1, 1], careers: [4, 4, 2, 1, 0.3],
    own: [],
  },
  {
    key: 'pacific', slug: 'demo-pacific-climate-resilience', title: 'Demo: Pacific Climate Resilience Programme',
    academyEventId: '364f17f1-e908-43c0-bcf3-fe3d87ef120b', status: 'draft',
    event: ['2026-12-08T21:00:00Z', '2026-12-11T05:00:00Z'],
    windows: ['2026-12-01T21:00:00Z', '2026-12-08T21:00:00Z', '2026-12-11T05:00:00Z', '2026-12-25T10:59:00Z'],
    imported: 0, walkIns: 0, pre: 0, post: 0, matched: 0, flagged: 0, base: 2.6, gain: 0.9,
    regions: [0, 0, 0, 0, 1, 0], careers: [1, 1, 1, 1, 0],
    own: [{ key: 'demo.pacific_adaptation', type: 'likert_5', stage: 'both', text: 'How confident are you in planning adaptation for a Pacific island community?', min: 'Not at all confident', max: 'Very confident', base: 2.3, gain: 1.0 }],
  },
  {
    key: 'bootcamp', slug: 'demo-renewable-energy-boot-camp', title: 'Demo: Renewable Energy Boot Camp 2026',
    academyEventId: '3e96e2ae-fbd2-445e-824f-2330dab41117', status: 'closed',
    event: ['2026-09-15T01:00:00Z', '2026-09-17T09:00:00Z'],
    windows: ['2026-09-08T01:00:00Z', '2026-09-15T01:00:00Z', '2026-09-17T09:00:00Z', '2026-10-01T15:59:00Z'],
    imported: 56, walkIns: 4, pre: 52, post: 41, matched: 39, flagged: 0, base: 2.9, gain: 1.05,
    regions: [2, 7, 1, 1, 1, 1], careers: [3, 5, 2, 1, 0.2],
    own: [],
  },
  {
    key: 'youth', slug: 'demo-youth-for-climate-action', title: 'Demo: Youth for Climate Action',
    academyEventId: '5a790dec-c783-41bc-a99c-dab49df5c5b0', status: 'closed',
    event: ['2026-08-20T01:00:00Z', '2026-08-21T09:00:00Z'],
    windows: ['2026-08-13T01:00:00Z', '2026-08-20T01:00:00Z', '2026-08-21T09:00:00Z', '2026-09-04T15:59:00Z'],
    imported: 88, walkIns: 8, pre: 81, post: 52, matched: 45, flagged: 1, base: 2.5, gain: 0.85,
    regions: [1, 8, 0.5, 0.5, 2, 0.5], careers: [8, 3, 0.5, 0.2, 0.5],
    own: [],
  },
  {
    key: 'caribbean', slug: 'demo-caribbean-climate-practitioners', title: 'Demo: Caribbean Climate Practitioners Programme',
    academyEventId: '37310dab-8288-45bf-8bf7-22d74e7fed90', status: 'closed',
    event: ['2026-07-09T14:00:00Z', '2026-07-09T16:00:00Z'],
    windows: ['2026-07-02T13:00:00Z', '2026-07-09T14:00:00Z', '2026-07-09T16:00:00Z', '2026-07-23T23:59:00Z'],
    imported: 50, walkIns: 5, pre: 47, post: 35, matched: 31, flagged: 0, base: 3.0, gain: 0.7,
    regions: [0.5, 0.2, 2, 8, 0.2, 0.5], careers: [1, 3, 4, 2, 0.3],
    own: [],
  },
  {
    key: 'tipping', slug: 'demo-tipping-points-discussion', title: 'Demo: Tipping Points Discussion Series',
    academyEventId: '9c5d3963-e2fe-44e1-9eea-7c38d31747af', status: 'closed',
    event: ['2026-06-18T13:00:00Z', '2026-06-18T14:30:00Z'],
    windows: ['2026-06-11T13:00:00Z', '2026-06-18T13:00:00Z', '2026-06-18T14:30:00Z', '2026-07-02T21:59:00Z'],
    imported: 72, walkIns: 6, pre: 64, post: 30, matched: 26, flagged: 0, base: 3.1, gain: 0.55,
    regions: [1, 2, 1, 3, 1, 6], careers: [2, 3, 3, 3, 0.3],
    own: [],
  },
  {
    key: 'summer', slug: 'demo-climate-modelling-summer-school', title: 'Demo: Climate Modelling Summer School',
    academyEventId: 'e5d5d527-dd46-4a43-b4a1-fa29bea1618d', status: 'closed',
    event: ['2026-06-29T08:00:00Z', '2026-07-10T15:00:00Z'],
    windows: ['2026-06-22T08:00:00Z', '2026-06-29T08:00:00Z', '2026-07-10T15:00:00Z', '2026-07-24T21:59:00Z'],
    imported: 54, walkIns: 4, pre: 50, post: 44, matched: 41, flagged: 0, base: 2.6, gain: 1.25,
    regions: [1, 2, 1, 1, 0.5, 6], careers: [6, 4, 1, 0.2, 0.2],
    own: [],
  },
]

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  const existing = must('demo survey check', await db.from('survey_events').select('slug').like('slug', 'demo-%'))
  if (existing.length > 0) throw new Error(`Demo surveys already exist (${existing.map(s => s.slug).join(', ')}). Run "remove" first.`)
  // One survey per Academy event: don't collide with a real survey on the same event
  const taken = must('surveyed events query', await db.from('survey_events')
    .select('slug,academy_event_id').in('academy_event_id', DEMOS.map(d => d.academyEventId)))
  if (taken.length > 0) throw new Error(`These Academy events already have a survey: ${taken.map(s => s.slug).join(', ')}. Delete those drafts or change DEMOS.`)

  const coreRows = must('core questions query', await db
    .from('survey_question_versions')
    .select('id,version,survey_questions!inner(key,is_core,stage)')
    .eq('survey_questions.is_core', true)
    .order('version', { ascending: false }))
  const core = new Map()
  for (const v of coreRows) if (!core.has(v.survey_questions.key)) core.set(v.survey_questions.key, { versionId: v.id, stage: v.survey_questions.stage })
  const ORDER = ['core.understanding', 'core.confidence_apply', 'core.confidence_explain', 'core.personal_impact', 'core.career_stage', 'core.region', 'core.usefulness', 'core.recommend', 'core.feedback']
  for (const k of ORDER) if (!core.has(k)) throw new Error(`Core question ${k} missing: run supabase/migrations/20261026_survey_core_questions.sql`)

  let totals = { surveys: 0, people: 0, submissions: 0, answers: 0 }
  for (const [index, d] of DEMOS.entries()) {
    const r = rng(1000 + index)
    const surveyId = randomUUID()
    must(`survey insert ${d.slug}`, await db.from('survey_events').insert({
      id: surveyId, academy_event_id: d.academyEventId, slug: d.slug, title: d.title, status: d.status,
      event_starts_at: d.event[0], event_ends_at: d.event[1],
      pre_opens_at: d.windows[0], pre_closes_at: d.windows[1], post_opens_at: d.windows[2], post_closes_at: d.windows[3],
    }))

    // Questions: core in order, then the survey's own
    const questions = ORDER.map(k => ({ key: k, versionId: core.get(k).versionId, stage: core.get(k).stage }))
    for (const q of d.own) {
      const questionId = randomUUID(), versionId = randomUUID()
      must('own question insert', await db.from('survey_questions').insert({ id: questionId, key: q.key, is_core: false, type: q.type, stage: q.stage, in_bank: false }))
      must('own question version insert', await db.from('survey_question_versions').insert({
        id: versionId, question_id: questionId, version: 1, text: q.text,
        options: q.options ?? null, scale_min_label: q.min ?? null, scale_max_label: q.max ?? null, is_required: true,
      }))
      questions.push({ ...q, versionId })
    }
    must('survey questions insert', await db.from('survey_event_questions').insert(
      questions.map((q, i) => ({ survey_event_id: surveyId, question_version_id: q.versionId, stage: q.stage, sort_order: i }))))

    // People and participants. Order: matched, before only, after only, no answer.
    const total = d.imported + d.walkIns
    const preOnly = d.pre - d.matched, postOnly = d.post - d.matched
    if (preOnly < 0 || postOnly < 0 || d.matched + preOnly + postOnly > total) throw new Error(`Inconsistent counts for ${d.slug}`)
    const people = [], participants = [], submissions = [], answers = []
    for (let n = 0; n < total; n++) {
      const personId = randomUUID(), participantId = randomUUID()
      // Walk-ins joined by scanning a QR code, so each of them answered at least once
      const answeredSomething = n < d.matched + preOnly + postOnly
      const walkIn = answeredSomething && n % Math.max(2, Math.round(total / Math.max(1, d.walkIns))) === 1
        && participants.filter(p => p.source === 'walk_in').length < d.walkIns
      people.push({ id: personId, email: `demo.${d.key}.${String(n + 1).padStart(3, '0')}@example.org` })
      participants.push({
        id: participantId, survey_event_id: surveyId, person_id: personId,
        token_hash: tokenHash(participantId),
        source: walkIn ? 'walk_in' : 'imported',
      })

      const answersPre  = n < d.matched + preOnly
      const answersPost = n < d.matched || (n >= d.matched + preOnly && n < d.matched + preOnly + postOnly)
      const career = weighted(r, CAREERS.map((c, i) => [c, d.careers[i]]))
      const region = weighted(r, REGIONS.map((g, i) => [g, d.regions[i]]))
      const level  = normal(r, d.base, 0.85)   // this person's starting point
      const preValues = new Map()

      for (const stage of ['pre', 'post']) {
        if ((stage === 'pre' && !answersPre) || (stage === 'post' && !answersPost)) continue
        const submissionId = randomUUID()
        const [from, to] = stage === 'pre' ? [d.windows[0], d.windows[1]] : [d.windows[2], d.windows[3]]
        const channel = walkIn ? (stage === 'pre' ? 'qr_email' : 'qr_cookie') : weighted(r, [['email_link', 8], ['qr_cookie', 1], ['qr_email', 1]])
        submissions.push({ id: submissionId, event_participant_id: participantId, stage, channel, status: 'accepted', submitted_at: between(r, from, to) })

        for (const q of questions.filter(x => x.stage === 'both' || x.stage === stage)) {
          let value
          switch (q.key) {
            case 'core.understanding':       value = { value_number: stage === 'pre' ? likert(normal(r, level, 0.4)) : null }; break
            case 'core.confidence_apply':    value = { value_number: stage === 'pre' ? likert(normal(r, level - 0.2, 0.5)) : null }; break
            case 'core.confidence_explain':  value = { value_number: stage === 'pre' ? likert(normal(r, level - 0.4, 0.5)) : null }; break
            case 'core.personal_impact':     value = { value_text: pick(r, stage === 'pre' ? IMPACT_PRE : IMPACT_POST) }; break
            case 'core.career_stage':        value = { value_choices: [career] }; break
            case 'core.region':              value = { value_choices: [region] }; break
            case 'core.usefulness':          value = { value_number: likert(normal(r, 3.6 + d.gain * 0.6, 0.7)) }; break
            case 'core.recommend':           value = { value_choices: [weighted(r, [['Yes', 82], ['Not sure', 15], ['No', 3]])] }; break
            case 'core.feedback':            value = r() < 0.45 ? { value_text: pick(r, FEEDBACK) } : null; break
            default:
              if (q.type === 'likert_5') value = { value_number: stage === 'pre' ? likert(normal(r, q.base, 0.7)) : null }
              else if (q.type === 'single_choice') {
                const before = preValues.get(q.key)
                const choice = before && r() < 0.85 ? before : weighted(r, q.options.map((o, i) => [o, [2, 3, 5][i] ?? 1]))
                preValues.set(q.key, choice)
                value = { value_choices: [choice] }
              }
          }
          if (!value) continue
          // After-survey scales: the person's before answer (or a fresh one) plus this event's gain
          if (value.value_number === null) {
            const prev = preValues.get(q.key) ?? likert(normal(r, q.base ?? level, 0.6))
            value.value_number = likert(prev + normal(r, q.gain ?? d.gain, 0.65))
          }
          if (stage === 'pre' && typeof value.value_number === 'number') preValues.set(q.key, value.value_number)
          answers.push({ submission_id: submissionId, question_version_id: q.versionId, ...value })
        }
      }
    }
    // A few repeat answers typed with someone's email: flagged for review, never counted
    for (let f = 0; f < d.flagged; f++) {
      submissions.push({ id: randomUUID(), event_participant_id: participants[f * 7].id, stage: 'pre', channel: 'qr_email', status: 'flagged_duplicate', submitted_at: between(r, d.windows[0], d.windows[1]) })
    }

    await inChunks('people insert', people, 500, rows => db.from('survey_people').insert(rows))
    await inChunks('participants insert', participants, 500, rows => db.from('survey_event_participants').insert(rows))
    await inChunks('submissions insert', submissions, 500, rows => db.from('survey_submissions').insert(rows))
    await inChunks('answers insert', answers, 1000, rows => db.from('survey_answers').insert(rows))
    console.log(`  ${d.slug.padEnd(40)} ${d.status.padEnd(6)} ${String(total).padStart(3)} people, ${String(submissions.length).padStart(3)} submissions, ${String(answers.length).padStart(4)} answers`)
    totals = { surveys: totals.surveys + 1, people: totals.people + total, submissions: totals.submissions + submissions.length, answers: totals.answers + answers.length }
  }
  console.log(`Seeded ${totals.surveys} demo surveys: ${totals.people} people, ${totals.submissions} submissions, ${totals.answers} answers.`)
}

// ─── Remove ───────────────────────────────────────────────────────────────────

async function remove() {
  const surveys = must('demo surveys query', await db.from('survey_events').select('id,slug').like('slug', 'demo-%'))
  const surveyIds = surveys.map(s => s.id)

  if (surveyIds.length > 0) {
    // Questions added to demo surveys (their own, or added later in the Setup tab)
    const linked = must('demo survey questions query', await db.from('survey_event_questions')
      .select('survey_question_versions(question_id,survey_questions(id,is_core))').in('survey_event_id', surveyIds))
    const ownQuestionIds = [...new Set(linked.map(l => l.survey_question_versions?.survey_questions)
      .filter(q => q && !q.is_core).map(q => q.id))]

    const participantIds = []
    for (let from = 0; ; from += 1000) {
      const page = must('demo participants query', await db.from('survey_event_participants')
        .select('id').in('survey_event_id', surveyIds).order('id').range(from, from + 999))
      participantIds.push(...page.map(p => p.id))
      if (page.length < 1000) break
    }
    // Submissions first (answers cascade), then participants (email log cascades), then surveys
    await inChunks('demo submissions delete', participantIds, 150, ids => db.from('survey_submissions').delete().in('event_participant_id', ids))
    await inChunks('demo participants delete', participantIds, 150, ids => db.from('survey_event_participants').delete().in('id', ids))
    must('demo surveys delete', await db.from('survey_events').delete().in('id', surveyIds))

    for (const questionId of ownQuestionIds) {
      const versions = must('question versions query', await db.from('survey_question_versions').select('id').eq('question_id', questionId)).map(v => v.id)
      const used = await db.from('survey_event_questions').select('question_version_id', { count: 'exact', head: true }).in('question_version_id', versions)
      if (used.error) throw new Error(`question use query failed: ${used.error.message}`)
      if ((used.count ?? 0) > 0) continue
      must('question versions delete', await db.from('survey_question_versions').delete().in('id', versions))
      must('question delete', await db.from('survey_questions').delete().eq('id', questionId).eq('is_core', false))
    }
  }

  const people = must('demo people delete', await db.from('survey_people').delete().like('email', 'demo.%@example.org').select('id'))
  console.log(`Removed ${surveys.length} demo surveys (${surveys.map(s => s.slug).join(', ') || 'none'}) and ${people.length} demo people.`)
}

const command = process.argv[2]
if (command === 'seed') {
  try {
    await seed()
  } catch (err) {
    console.error('Seeding stopped part-way. Run "node scripts/survey-demo-data.mjs remove" to clear what was added.')
    throw err
  }
} else if (command === 'remove') await remove()
else { console.error('Usage: node scripts/survey-demo-data.mjs seed|remove'); process.exit(1) }
