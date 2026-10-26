'use client'

// The survey page's tab bar. Tabs are the same page with ?tab=, which Next.js doesn't cover
// with loading.tsx, so the clicked tab shows a spinner (useLinkStatus) until the server
// answers; the tab's own skeleton then shows while its data loads (Suspense in page.tsx).
import Link, { useLinkStatus } from 'next/link'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export const SURVEY_TABS = [
  { id: 'setup',        label: 'Setup' },
  { id: 'participants', label: 'Participants' },
  { id: 'send',         label: 'Send' },
  { id: 'qr',           label: 'QR codes' },
  { id: 'results',      label: 'Results' },
  { id: 'export',       label: 'Export' },
] as const
export type SurveyTabId = typeof SURVEY_TABS[number]['id']

// Always rendered at a fixed size, so the label doesn't jump when it appears
function PendingHint() {
  const { pending } = useLinkStatus()
  return <Loader2 aria-hidden="true" className={cn('size-3.5 animate-spin transition-opacity', pending ? 'opacity-100' : 'opacity-0')} />
}

export default function SurveyTabs({ slug, active }: { slug: string; active: SurveyTabId }) {
  return (
    <nav aria-label="Survey sections" className="flex flex-wrap gap-1 border-b">
      {SURVEY_TABS.map(t => (
        <Link
          key={t.id}
          href={t.id === 'setup' ? `/dashboard/academy/surveys/${slug}` : `/dashboard/academy/surveys/${slug}?tab=${t.id}`}
          aria-current={t.id === active ? 'page' : undefined}
          scroll={false}
          className={cn(
            '-mb-px inline-flex items-center gap-1.5 border-b-2 py-2 pr-2 pl-3 text-sm transition-colors',
            t.id === active ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t.label}
          <PendingHint />
        </Link>
      ))}
    </nav>
  )
}
