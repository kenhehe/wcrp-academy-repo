import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { getSurveyBySlug } from '@/lib/data/surveys'
import { estimateMinutes, questionsForStage } from '@/lib/data/survey-setup'
import type { SubmissionStage } from '@/lib/data/surveys.types'
import SurveyPreview from './_components/SurveyPreview'

export const dynamic = 'force-dynamic'

interface PageProps {
  params:       Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function SurveyPreviewPage({ params, searchParams }: PageProps) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const stage: SubmissionStage = sp.stage === 'post' ? 'post' : 'pre'
  const detail = await getSurveyBySlug(slug)
  if (!detail) notFound()

  const questions = questionsForStage(detail.questions, stage)

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/dashboard/academy/surveys/${slug}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden="true" />
          {detail.survey.title}
        </Link>
        <nav aria-label="Preview stage" className="flex gap-2">
          {(['pre', 'post'] as const).map(s => (
            <Link
              key={s}
              href={`/dashboard/academy/surveys/${slug}/preview?stage=${s}`}
              aria-current={s === stage ? 'page' : undefined}
              className={buttonVariants({ variant: s === stage ? 'default' : 'outline', size: 'sm' })}
            >
              {s === 'pre' ? 'Before-survey' : 'After-survey'}
            </Link>
          ))}
        </nav>
      </div>

      <SurveyPreview
        key={stage}
        title={detail.survey.title}
        stage={stage}
        minutes={estimateMinutes(questions)}
        questions={questions}
      />
    </div>
  )
}
