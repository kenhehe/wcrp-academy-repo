import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { must } from '@/lib/supabase/must'

export interface LighthouseOrg {
  id:        string
  name:      string          // short name / acronym
  full_name: string | null
}

// The Lighthouse Activity programmes, read from ipos (type = 'lighthouse'), so adding a
// programme takes a row in the table instead of a code change.
export const getLighthouseOrgs = cache(async (): Promise<LighthouseOrg[]> => {
  const rows = must('lighthouse orgs query', await createAdminClient()
    .from('ipos').select('id,name,full_name').eq('type', 'lighthouse').order('name'))
  return rows ?? []
})

export async function assertLighthouseId(orgId: string): Promise<void> {
  const ids = (await getLighthouseOrgs()).map(o => o.id)
  if (!ids.includes(orgId)) throw new Error(`"${orgId}" is not a Lighthouse Activity programme`)
}
