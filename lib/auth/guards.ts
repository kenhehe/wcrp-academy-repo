// Role checks for server actions and route handlers. A server action is a public POST
// endpoint: the page that renders its button may be gated, but the action itself can be
// called directly, so every action starts with one of these. Each throws when the check fails.
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export type AdminTeam = 'academy' | 'secretariat'

export async function requireUser(): Promise<User> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  return user
}

export function isAcademyAdmin(user: User): boolean {
  return user.app_metadata?.role === 'academy_admin'
}

export function canApprove(user: User): boolean {
  return user.app_metadata?.can_approve === true
}

// The Academy team: everything under /dashboard/academy
export async function requireAcademyAdmin(): Promise<User> {
  const user = await requireUser()
  if (!isAcademyAdmin(user)) throw new Error('Not allowed: Academy admins only')
  return user
}

// The Secretariat (Climate account): approvals, API keys, LHA accounts
export async function requireCanApprove(): Promise<User> {
  const user = await requireUser()
  if (!canApprove(user)) throw new Error('Not allowed: approvers only')
  return user
}

// Features shared by both teams (Duplicates, Event Registry editing); says which team called
export async function requireAcademyAdminOrApprover(): Promise<AdminTeam> {
  const user = await requireUser()
  if (isAcademyAdmin(user)) return 'academy'
  if (canApprove(user))     return 'secretariat'
  throw new Error('Not allowed: only the Academy team and the Secretariat can do this')
}
