import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PageHeader from '@/components/base/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ImportWizard from '@/components/import/ImportWizard'
import ExportPanel from '@/components/import/ExportPanel'

export const dynamic = 'force-dynamic'

export default async function ImportExportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const orgId = user?.app_metadata?.org_id as string

  const { data: yearsRaw } = await supabase
    .from('events')
    .select('year')
    .eq('ipo_id', orgId)
    .order('year', { ascending: false })

  const availableYears = [...new Set((yearsRaw ?? []).map(r => r.year).filter(Boolean))] as number[]

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Import / Export"
        info="Bulk-import events from a spreadsheet using the provided template, or export your current catalogue as a CSV for offline review or sharing with your team."
        description="Bulk-import events from a spreadsheet or export your catalogue"
      />

      <Tabs defaultValue="import">
        <TabsList>
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="mt-6">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="text-base font-medium">Import events</CardTitle>
            </CardHeader>
            <CardContent>
              <ImportWizard />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="mt-6">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="text-base font-medium">Export events</CardTitle>
            </CardHeader>
            <CardContent>
              <ExportPanel availableYears={availableYears} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
