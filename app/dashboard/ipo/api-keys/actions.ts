'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function assertCanApprove() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  if (!user.app_metadata?.can_approve) throw new Error('Not authorised to manage API keys')
  return user
}

async function sha256(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Returns the raw token once — it is never stored and cannot be retrieved again
export async function generateApiToken(formData: FormData): Promise<{ rawToken: string }> {
  const user = await assertCanApprove()
  const name = (formData.get('name') as string)?.trim()
  if (!name) throw new Error('Token name is required')

  // 32 random bytes → hex string (64 chars), prefixed with wcrp_
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const raw   = 'wcrp_' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  const hash  = await sha256(raw)

  const db = createAdminClient()
  const { error } = await db.from('api_tokens').insert({
    name,
    token_hash:   hash,
    token_prefix: raw.slice(0, 12),
    created_by:   user.id,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/ipo/api-keys')
  return { rawToken: raw }
}

export async function revokeApiToken(tokenId: string) {
  await assertCanApprove()
  if (!tokenId) throw new Error('token id is required')

  const db = createAdminClient()
  const { error } = await db.from('api_tokens').delete().eq('id', tokenId)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard/ipo/api-keys')
}
