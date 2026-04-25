'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

const IPO_IDS = ['cmip', 'clivar', 'esmo', 'rifs', 'cordex', 'clic', 'gewex'] as const
type IpoId = typeof IPO_IDS[number]

function buildAppMeta(orgId: IpoId) {
  return {
    provider: 'email',
    providers: ['email'],
    role: 'ipo_user',
    org_id: orgId,
  }
}

export async function createIPOUser(formData: FormData) {
  const email   = formData.get('email') as string
  const password = formData.get('password') as string
  const orgId   = formData.get('org_id') as IpoId

  if (!email || !password || !orgId) throw new Error('email, password and org_id are required')
  if (!IPO_IDS.includes(orgId)) throw new Error(`Invalid org_id: ${orgId}`)

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
  const userId  = formData.get('user_id') as string
  const email   = formData.get('email') as string | null
  const password = formData.get('password') as string | null
  const orgId   = formData.get('org_id') as IpoId

  if (!userId) throw new Error('user_id is required')
  if (orgId && !IPO_IDS.includes(orgId)) throw new Error(`Invalid org_id: ${orgId}`)

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
  if (!userId) throw new Error('user_id is required')

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/academy/accounts')
}
