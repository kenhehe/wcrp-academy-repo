'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  createAcademyEvent,
  updateAcademyEvent,
  deleteAcademyEvent,
  type AcademyEventInput,
} from '@/lib/data/academy-events'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  if (user.app_metadata?.role !== 'academy_admin') throw new Error('Unauthorized')
}

export async function createAcademyEventAction(
  data: Partial<AcademyEventInput>
): Promise<{ error?: string }> {
  await requireAdmin()
  const { error } = await createAcademyEvent(data)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/academy/catalogue')
  revalidatePath('/dashboard/academy/events')
  revalidatePath('/dashboard/academy')
  redirect('/dashboard/academy/catalogue')
}

export async function updateAcademyEventAction(
  id: string,
  data: Partial<AcademyEventInput>
): Promise<{ error?: string }> {
  await requireAdmin()
  const { error } = await updateAcademyEvent(id, data)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/academy/catalogue')
  revalidatePath('/dashboard/academy/events')
  revalidatePath('/dashboard/academy')
  redirect('/dashboard/academy/catalogue')
}

export async function deleteAcademyEventAction(
  formData: FormData
): Promise<void> {
  await requireAdmin()
  const id = formData.get('id') as string
  if (!id) return
  await deleteAcademyEvent(id)
  revalidatePath('/dashboard/academy/catalogue')
  revalidatePath('/dashboard/academy/events')
  revalidatePath('/dashboard/academy')
}
