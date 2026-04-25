'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { LoginFormState } from './types'

export default function LoginForm() {
  const router = useRouter()
  const [state, setState] = useState<LoginFormState>({
    email: '',
    password: '',
    loading: false,
    error: null,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setState(s => ({ ...s, loading: true, error: null }))

    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: state.email,
      password: state.password,
    })

    if (error) {
      setState(s => ({ ...s, loading: false, error: error.message }))
      toast.error(error.message)
      return
    }

    const role = data.user?.app_metadata?.role
    const target = role === 'academy_admin' ? '/dashboard/academy' : '/dashboard/ipo'

    router.push(target)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@organisation.org"
          autoComplete="email"
          required
          value={state.email}
          onChange={e => setState(s => ({ ...s, email: e.target.value }))}
          disabled={state.loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={state.password}
          onChange={e => setState(s => ({ ...s, password: e.target.value }))}
          disabled={state.loading}
        />
      </div>

      <Button type="submit" className="w-full" disabled={state.loading}>
        {state.loading ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}
