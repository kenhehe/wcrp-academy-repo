'use server'

import { must } from '@/lib/supabase/must'
import { requireAcademyAdmin } from '@/lib/auth/guards'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

// Any org in the ipos table (IPO, Lighthouse programme or the Secretariat)
async function assertOrgId(orgId: string) {
  const org = must('org lookup', await createAdminClient().from('ipos').select('id').eq('id', orgId).maybeSingle())
  if (!org) throw new Error(`Invalid org_id: ${orgId}`)
}

function buildAppMeta(orgId: string) {
  return {
    provider: 'email',
    providers: ['email'],
    role: 'ipo_user',
    org_id: orgId,
  }
}

export async function createIPOUser(formData: FormData) {
  await requireAcademyAdmin()
  const email   = formData.get('email') as string
  const password = formData.get('password') as string
  const orgId   = formData.get('org_id') as string

  if (!email || !password || !orgId) throw new Error('email, password and org_id are required')
  await assertOrgId(orgId)

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    app_metadata: buildAppMeta(orgId),
    email_confirm: true,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/academy/accounts')
}

export async function updateIPOUser(formData: FormData) {
  await requireAcademyAdmin()
  const userId  = formData.get('user_id') as string
  const email   = formData.get('email') as string | null
  const password = formData.get('password') as string | null
  const orgId   = formData.get('org_id') as string | null

  if (!userId) throw new Error('user_id is required')
  if (orgId) await assertOrgId(orgId)

  const admin = createAdminClient()
  const updates: Record<string, unknown> = {}

  if (email)    updates.email = email
  if (password) updates.password = password
  if (orgId)    updates.app_metadata = buildAppMeta(orgId)

  const { error } = await admin.auth.admin.updateUserById(userId, updates)
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/academy/accounts')
}

export async function deleteIPOUser(userId: string) {
  await requireAcademyAdmin()
  if (!userId) throw new Error('user_id is required')

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/academy/accounts')
}
