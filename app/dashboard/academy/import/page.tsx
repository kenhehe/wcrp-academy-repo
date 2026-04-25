import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import AcademyImportWizard from '@/components/academy/AcademyImportWizard'
import AcademyExportPanel from '@/components/academy/AcademyExportPanel'

export const dynamic = 'force-dynamic'

export default async function AcademyImportPage() {
  const supabase = await createClient()

  const { data: meta } = await supabase
    .from('academy_events')
    .select('start_date,training_type,status')

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

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Import / Export</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bulk-import the Academy Events catalogue or export it as a spreadsheet
        </p>
      </div>

      <Tabs defaultValue="import">
        <TabsList>
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="mt-6">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="text-base font-medium">Import academy events</CardTitle>
            </CardHeader>
            <CardContent>
              <AcademyImportWizard />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="mt-6">
          <Card className="max-w-2xl">
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
      </Tabs>
    </div>
  )
}
