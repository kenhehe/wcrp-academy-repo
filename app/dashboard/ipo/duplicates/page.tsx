import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import PageInfo from '@/components/base/PageInfo'
import DuplicateFiltersBar from '@/components/duplicates/DuplicateFiltersBar'
import DuplicatesReview from '@/components/duplicates/DuplicatesReview'
import DuplicatesReviewSkeleton from '@/components/duplicates/DuplicatesReviewSkeleton'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function IPODuplicatesPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.app_metadata?.can_approve) redirect('/dashboard/ipo')

  const sp   = await searchParams
  const ipoFilter = typeof sp.ipo  === 'string' ? sp.ipo  : undefined
  const page       = Math.max(1, parseInt(typeof sp.page === 'string' ? sp.page : '1'))

  // Admin client — pending events span multiple orgs, same reasoning as Approvals
  const db = createAdminClient()
  const { data: ipos } = await db
    .from('ipos').select('id,name').eq('type', 'ipo').order('name')

  return (
    <div className="p-8 space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Duplicates</h1>
          <PageInfo>
            The same real-world event sometimes gets scraped from two different IPO websites
            (e.g. a jointly organised conference). This page suggests likely cross-IPO duplicates
            by title and date similarity. Confirming a match links the two records together — both
            are kept for attribution, but they&rsquo;re treated as one event for Academy coverage tracking.
          </PageInfo>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Cross-IPO duplicate events awaiting review
        </p>
      </div>

      <div className="flex items-center justify-end">
        <DuplicateFiltersBar ipos={ipos ?? []} activeIpo={ipoFilter} />
      </div>

      <Suspense key={`${ipoFilter ?? ''}-${page}`} fallback={<DuplicatesReviewSkeleton />}>
        <DuplicatesReview ipoFilter={ipoFilter} page={page} ipos={ipos ?? []} sp={sp} />
      </Suspense>
    </div>
  )
}
