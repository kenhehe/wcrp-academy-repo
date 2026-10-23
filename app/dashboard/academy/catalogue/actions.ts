'use server'

import { requireAcademyAdmin } from '@/lib/auth/guards'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import {
  createAcademyEvent,
  updateAcademyEvent,
  deleteAcademyEvent,
  type AcademyEventInput,
} from '@/lib/data/academy-events'

export async function createAcademyEventAction(
  data: Partial<AcademyEventInput>
): Promise<{ error?: string }> {
  await requireAcademyAdmin()
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
  await requireAcademyAdmin()
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
  await requireAcademyAdmin()
  const id = formData.get('id') as string
  if (!id) return
  await deleteAcademyEvent(id)
  revalidatePath('/dashboard/academy/catalogue')
  revalidatePath('/dashboard/academy/events')
  revalidatePath('/dashboard/academy')
}
