import SurveyShell from '@/components/surveys/SurveyShell'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadPublicSurvey, participantByToken } from '@/lib/surveys/respond'
import StopRemindersButton from './_components/StopRemindersButton'

export const dynamic = 'force-dynamic'

interface PageProps {
  params:       Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// "Stop reminders for this survey" from an email footer. Asks before switching them off,
// so a link scanner opening the URL doesn't do it for the person.
export default async function StopRemindersPage({ params, searchParams }: PageProps) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const token = typeof sp.t === 'string' ? sp.t : ''
  const db = createAdminClient()
  const survey = await loadPublicSurvey(db, slug, 'pre')
  const who = survey && token ? await participantByToken(db, survey.id, token) : null

  return (
    <SurveyShell title={survey?.title ?? 'WCRP Academy survey'}>
      {who ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Stop reminder emails?</h2>
          <p className="text-sm text-muted-foreground">
            You won&apos;t get more reminders about this survey. You may still get its invitations, and other WCRP Academy
            emails don&apos;t change.
          </p>
          <StopRemindersButton slug={slug} token={token} />
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">
          This link isn&apos;t valid. Use the link in your most recent survey email, or write to office@wcrp-academy.org.
        </p>
      )}
    </SurveyShell>
  )
}
