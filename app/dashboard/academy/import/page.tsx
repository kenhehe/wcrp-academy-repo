import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, AlertCircle } from 'lucide-react'
import AcademyImportWizard from '@/components/academy/AcademyImportWizard'
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
    { data: meta },
    { data: syncMeta },
  ] = await Promise.all([
    supabase.from('academy_events').select('start_date,training_type,status'),
    supabase
      .from('academy_events')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single(),
  ])

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
      <div>
        <h1 className="text-2xl font-semibold">Import / Export</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage Academy event data — sync from WordPress or export to spreadsheet
        </p>
      </div>

      {/* WordPress sync status banner */}
      <Card className="border-border bg-muted/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <RefreshCw className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium">WordPress sync is the primary data source</p>
                <Badge variant="secondary" className="text-xs">Auto · every 12 h</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Academy events are synced automatically from{' '}
                <a href="https://wcrp-academy.org" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
                  wcrp-academy.org
                </a>{' '}
                via the WordPress REST API. Any changes on the Academy site appear here within 12 hours.
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
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
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="export">
        <TabsList>
          <TabsTrigger value="export">Export</TabsTrigger>
          <TabsTrigger value="import">Manual import</TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="mt-6">
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
        </TabsContent>

        <TabsContent value="import" className="mt-6 space-y-4">
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/20">
            <AlertCircle className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-amber-800 dark:text-amber-300">
              <span className="font-medium">Manual import is a fallback only.</span>{' '}
              For events managed on the Academy WordPress site, use the automatic sync instead.
              This import is useful for one-off additions or events not on the Academy site.
            </p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Import from spreadsheet</CardTitle>
            </CardHeader>
            <CardContent>
              <AcademyImportWizard />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
