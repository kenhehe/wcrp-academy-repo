import { Download, FileText } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Export tab: the two CSV files (route: ../export/[file]/route.ts). They share no key, so
// nobody can join them to put an email next to an answer.
export default function ExportTab({ slug }: { slug: string }) {
  const href = (file: string) => `/dashboard/academy/surveys/${slug}/export/${file}`
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Answers (CSV)</CardTitle>
          <CardDescription>One row per answer, with pseudonyms like P-7F3K. No names or emails. Accepted answers only.</CardDescription>
        </CardHeader>
        <CardContent>
          <a href={href('answers.csv')} className={buttonVariants({ variant: 'outline' })}>
            <Download data-icon="inline-start" aria-hidden="true" />
            Download
          </a>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Participants and status (CSV)</CardTitle>
          <CardDescription>Emails with how far each person got. No answers.</CardDescription>
        </CardHeader>
        <CardContent>
          <a href={href('participants.csv')} className={buttonVariants({ variant: 'outline' })}>
            <Download data-icon="inline-start" aria-hidden="true" />
            Download
          </a>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="size-4 text-muted-foreground" aria-hidden="true" /> One-page report (PDF)</CardTitle>
          <CardDescription>Headline numbers, the before/after chart and quotes you pick. Comes in Phase 9.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
