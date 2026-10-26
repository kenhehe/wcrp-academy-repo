import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import SurveyShell from '@/components/surveys/SurveyShell'
import LocalDateTime from '@/components/surveys/LocalDateTime'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchSurveyQuestions } from '@/lib/data/surveys'
import { estimateMinutes, questionsForStage } from '@/lib/data/survey-setup'
import { maskEmail } from '@/lib/data/survey-participants'
import { PERSON_COOKIE, verifyPerson } from '@/lib/surveys/tokens'
import { acceptedSubmission, findParticipant, loadPublicSurvey, participantByToken, personEmail } from '@/lib/surveys/respond'
import SurveyRunner, { type RunnerIdentity } from './_components/SurveyRunner'

export const dynamic = 'force-dynamic'

interface PageProps {
  params:       Promise<{ slug: string; stage: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <SurveyShell title={title}>
      <div className="space-y-2 py-4 text-center text-sm text-muted-foreground">{children}</div>
    </SurveyShell>
  )
}

export default async function SurveyStagePage({ params, searchParams }: PageProps) {
  const [{ slug, stage }, sp] = await Promise.all([params, searchParams])
  if (stage !== 'pre' && stage !== 'post') notFound()
  const db = createAdminClient()
  const survey = await loadPublicSurvey(db, slug, stage)
  const label = stage === 'pre' ? 'before-survey' : 'after-survey'

  if (!survey) {
    return <Notice title="Survey not available"><p>This survey doesn&apos;t exist or isn&apos;t open. Check the link, or ask the event organisers.</p></Notice>
  }
  if (survey.window === 'not_open') {
    return (
      <Notice title={survey.title}>
        <p className="text-base font-medium text-foreground">The {label} isn&apos;t open yet</p>
        {survey.opensAt && (
          <p>
            It opens on <LocalDateTime iso={survey.opensAt} withYear />, your time{stage === 'post' ? ', when the event ends' : ''}.
            Come back then, or use the link we email you.
          </p>
        )}
      </Notice>
    )
  }
  if (survey.window === 'closed') {
    return (
      <Notice title={survey.title}>
        <p className="text-base font-medium text-foreground">This {label} has closed</p>
        {survey.closesAt && <p>It closed on <LocalDateTime iso={survey.closesAt} withYear />, your time.</p>}
        <p>Questions? Write to office@wcrp-academy.org</p>
      </Notice>
    )
  }

  const questions = questionsForStage(await fetchSurveyQuestions(db, survey.id), stage)
    .map(({ versionId, type, text, options, scaleMinLabel, scaleMaxLabel, isRequired }) => ({ versionId, type, text, options, scaleMinLabel, scaleMaxLabel, isRequired }))

  // Who this is: their own link first, then a device that answered before
  const token = typeof sp.t === 'string' ? sp.t : null
  let identity: RunnerIdentity = { via: 'none' }
  let participantId: string | null = null
  const byToken = token ? await participantByToken(db, survey.id, token) : null
  if (byToken) {
    identity = { via: 'token', masked: byToken.email ? maskEmail(byToken.email) : 'your address' }
    participantId = byToken.participantId
  } else {
    const personId = verifyPerson((await cookies()).get(PERSON_COOKIE)?.value)
    const email = personId ? await personEmail(db, personId) : null
    if (personId && email) {
      identity = { via: 'cookie', masked: maskEmail(email) }
      participantId = await findParticipant(db, survey.id, personId)
    }
  }
  const already = participantId ? await acceptedSubmission(db, participantId, stage) : null

  return (
    <SurveyRunner
      slug={survey.slug}
      stage={stage}
      title={survey.title}
      minutes={estimateMinutes(questions)}
      questions={questions}
      identity={identity}
      token={byToken ? token : null}
      badToken={Boolean(token) && !byToken}
      answeredAt={already?.submitted_at ?? null}
    />
  )
}
