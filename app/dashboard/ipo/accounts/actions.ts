'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const LIGHTHOUSE_IDS = ['de', 'epesc', 'gpex', 'mcr', 'rci', 'slc'] as const
type LighthouseId = typeof LIGHTHOUSE_IDS[number]

async function assertCanApprove() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  if (!user.app_metadata?.can_approve) throw new Error('Not authorised to manage lighthouse accounts')
}

function buildAppMeta(orgId: LighthouseId) {
  return {
    provider:  'email',
    providers: ['email'],
    role:      'ipo_user',
    org_id:    orgId,
  }
}

export async function createLighthouseUser(formData: FormData) {
  await assertCanApprove()

  const email    = formData.get('email')    as string
  const password = formData.get('password') as string
  const orgId    = formData.get('org_id')   as LighthouseId

  if (!email || !password || !orgId) throw new Error('email, password and org_id are required')
  if (!LIGHTHOUSE_IDS.includes(orgId))  throw new Error(`Invalid org_id: ${orgId}`)

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    app_metadata:  buildAppMeta(orgId),
    email_confirm: true,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/ipo/accounts')
}

export async function updateLighthouseUser(formData: FormData) {
  await assertCanApprove()

  const userId   = formData.get('user_id')  as string
  const email    = formData.get('email')    as string | null
  const password = formData.get('password') as string | null
  const orgId    = formData.get('org_id')   as LighthouseId

  if (!userId) throw new Error('user_id is required')
  if (orgId && !LIGHTHOUSE_IDS.includes(orgId)) throw new Error(`Invalid org_id: ${orgId}`)

  const admin = createAdminClient()
  const updates: Record<string, unknown> = {}

  if (email)    updates.email    = email
  if (password) updates.password = password
  if (orgId)    updates.app_metadata = buildAppMeta(orgId)

  const { error } = await admin.auth.admin.updateUserById(userId, updates)
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/ipo/accounts')
}

export async function deleteLighthouseUser(userId: string) {
  await assertCanApprove()
  if (!userId) throw new Error('user_id is required')

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/ipo/accounts')
}
