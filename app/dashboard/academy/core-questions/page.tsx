import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import PageHeader from '@/components/base/PageHeader'
import { requireAcademyAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadCoreQuestions } from '@/lib/surveys/core-questions'
import CoreQuestionsList from './_components/CoreQuestionsList'

export const dynamic = 'force-dynamic'

export default async function CoreQuestionsPage() {
  await requireAcademyAdmin()
  const questions = await loadCoreQuestions(createAdminClient())

  return (
    <div className="p-8 space-y-6">
      <Link href="/dashboard/academy/surveys" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Surveys
      </Link>
      <PageHeader
        title="Core questions"
        info={
          <>
            Every survey asks these, so results compare across events. A change to wording nobody has answered yet
            applies everywhere. Once people have answered, saving makes a new version: new surveys and surveys nobody
            has answered yet use it, and answered surveys keep the wording people saw.
          </>
        }
        description="The questions every survey asks"
      />
      <CoreQuestionsList questions={questions} />
    </div>
  )
}
