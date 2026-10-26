import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import PageHeader from '@/components/base/PageHeader'
import { getCatalogueOptions, getCoreQuestions } from '@/lib/data/surveys'
import NewSurveyForm from './_components/NewSurveyForm'

export const dynamic = 'force-dynamic'

export default async function NewSurveyPage() {
  const [catalogue, core] = await Promise.all([getCatalogueOptions(), getCoreQuestions()])

  return (
    <div className="p-8 space-y-6">
      <Link href="/dashboard/academy/surveys" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Surveys
      </Link>
      <PageHeader
        title="New survey"
        description="Pick an Academy event, set when its surveys open, and add any questions of your own. Everything can change until the first answer arrives."
      />
      <NewSurveyForm catalogue={catalogue} core={core} />
    </div>
  )
}
