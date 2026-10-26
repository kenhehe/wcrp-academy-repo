import { NextResponse, type NextRequest } from 'next/server'
import { requireAcademyAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { must } from '@/lib/supabase/must'
import { fetchAcceptedAnswers, fetchPseudonyms, fetchSurveyQuestions, getSurveyParticipants } from '@/lib/data/surveys'
import { PARTICIPANT_STATE_LABELS } from '@/lib/data/survey-participants'
import { toCsv } from '@/lib/data/csv'

// Export tab downloads (Academy admins only):
//   answers.csv       one row per answer, pseudonyms only (no names, no emails)
//   participants.csv  emails and statuses, no answers
// The two files share no key, so they can't be joined to put an email next to an answer.
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string; file: string }> }) {
  try {
    await requireAcademyAdmin()
  } catch {
    return NextResponse.json({ error: 'Academy admins only' }, { status: 403 })
  }
  const { slug, file } = await params
  if (file !== 'answers.csv' && file !== 'participants.csv') return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const db = createAdminClient()
  const survey = must('survey query', await db.from('survey_events').select('id,slug').eq('slug', slug).maybeSingle()) as { id: string; slug: string } | null
  if (!survey) return NextResponse.json({ error: 'Survey not found' }, { status: 404 })

  let rows: (string | number | null)[][]
  if (file === 'answers.csv') {
    const [questions, pseudonyms, answers, submitted] = await Promise.all([
      fetchSurveyQuestions(db, survey.id),
      fetchPseudonyms(db, survey.id),
      fetchAcceptedAnswers(db, survey.id),
      fetchAllRows<{ event_participant_id: string; stage: string; submitted_at: string }>('submission times query', (from, to) => db
        .from('survey_submissions').select('event_participant_id,stage,submitted_at,survey_event_participants!inner(survey_event_id)')
        .eq('survey_event_participants.survey_event_id', survey.id).eq('status', 'accepted').order('id').range(from, to)),
    ])
    const question = new Map(questions.map(q => [q.versionId, q]))
    const when = new Map(submitted.map(s => [`${s.event_participant_id}:${s.stage}`, s.submitted_at]))
    rows = [['pseudonym', 'stage', 'submitted_at', 'question_key', 'question_version', 'question', 'answer'],
      ...answers
        .map(a => {
          const q = question.get(a.versionId)
          return [
            pseudonyms.get(a.participantId) ?? '?', a.stage === 'pre' ? 'before' : 'after', when.get(`${a.participantId}:${a.stage}`) ?? null,
            q?.key ?? a.versionId, q?.version ?? null, q?.text ?? null,
            a.number ?? a.text ?? (a.choices ?? []).join('; '),
          ]
        })
        .sort((x, y) => String(x[0]).localeCompare(String(y[0])) || String(y[1]).localeCompare(String(x[1])))]
  } else {
    const people = await getSurveyParticipants(survey.id)
    rows = [['email', 'source', 'status', 'repeat_answers', 'email_failed'],
      ...people.map(p => [p.email, p.source === 'walk_in' ? 'walk-in' : 'imported', PARTICIPANT_STATE_LABELS[p.status.state], p.status.flagged, p.status.bounced ? 'yes' : ''])]
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${survey.slug}-${file}"`,
      'Cache-Control': 'no-store',
    },
  })
}
