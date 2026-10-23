'use server'

import { requireCanApprove } from '@/lib/auth/guards'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertLighthouseId } from '@/lib/data/lighthouses'

function buildAppMeta(orgId: string) {
  return {
    provider:  'email',
    providers: ['email'],
    role:      'ipo_user',
    org_id:    orgId,
  }
}

export async function createLighthouseUser(formData: FormData) {
  await requireCanApprove()

  const email    = formData.get('email')    as string
  const password = formData.get('password') as string
  const orgId    = formData.get('org_id')   as string

  if (!email || !password || !orgId) throw new Error('email, password and org_id are required')
  await assertLighthouseId(orgId)

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
  await requireCanApprove()

  const userId   = formData.get('user_id')  as string
  const email    = formData.get('email')    as string | null
  const password = formData.get('password') as string | null
  const orgId    = formData.get('org_id')   as string | null

  if (!userId) throw new Error('user_id is required')
  if (orgId) await assertLighthouseId(orgId)

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
  await requireCanApprove()
  if (!userId) throw new Error('user_id is required')

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/ipo/accounts')
}
