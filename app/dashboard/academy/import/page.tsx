import { createClient } from '@/lib/supabase/server'
import { must } from '@/lib/supabase/must'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PageHeader from '@/components/base/PageHeader'
import { RefreshCw } from 'lucide-react'
import SyncAcademyButton from '@/components/academy/SyncAcademyButton'
import AcademyExportPanel from '@/components/academy/AcademyExportPanel'

export const dynamic = 'force-dynamic'

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default async function AcademyImportPage() {
  const supabase = await createClient()

  const [
    metaRes,
    syncMetaRes,
  ] = await Promise.all([
    supabase.from('academy_events').select('start_date,training_type,status'),
    supabase
      .from('academy_events')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  const meta     = must('catalogue query', metaRes)
  const syncMeta = must('last sync query', syncMetaRes)   // null before the first sync

  const availableYears = [...new Set(
    (meta ?? [])
      .map(r => r.start_date ? new Date(r.start_date + 'T00:00:00').getFullYear() : null)
      .filter((y): y is number => y !== null)
  )].sort((a, b) => b - a)

  const trainingTypes = [...new Set(
    (meta ?? []).map(r => r.training_type).filter((t): t is string => !!t)
  )].sort()

  const statusOptions = [...new Set(
    (meta ?? []).map(r => r.status).filter((s): s is string => !!s)
  )].sort()

  const lastSync    = syncMeta?.updated_at ?? null
  const totalSynced = meta?.length ?? 0

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Sync and export"
        info="The Academy catalogue is edited on WordPress (wcrp-academy.org) and copied here by a daily sync. Sync now to pull a change straight away, or export the catalogue to CSV or Excel."
        description="Academy events come from WordPress. Export them to a spreadsheet for offline review."
      />

      {/* WordPress sync status */}
      <Card className="border-border bg-muted/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-start gap-3">
            <RefreshCw className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Synced from WordPress every day at 10:00 (UTC+8)</p>
              <p className="text-xs text-muted-foreground mt-1">
                To add or change an Academy event, edit it on{' '}
                <a href="https://wcrp-academy.org/wp-admin/edit.php?post_type=catalogues" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
                  wcrp-academy.org
                </a>
                . The dashboard&apos;s copy is replaced on every sync.
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                <span>
                  Last synced:{' '}
                  <span className="font-medium text-foreground">
                    {lastSync ? fmt(lastSync) : 'Not yet synced'}
                  </span>
                </span>
                <span>
                  Events in database:{' '}
                  <span className="font-medium text-foreground tabular-nums">{totalSynced}</span>
                </span>
              </div>
            </div>
            <SyncAcademyButton label="Sync now" />
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base font-medium">Export academy events</CardTitle>
        </CardHeader>
        <CardContent>
          <AcademyExportPanel
            availableYears={availableYears}
            trainingTypes={trainingTypes}
            statusOptions={statusOptions}
          />
        </CardContent>
      </Card>
    </div>
  )
}
