'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, SearchX, Activity, Users, LogOut, BookOpen, Upload } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { AcademySidebarProps } from './types'

const NAV = [
  { href: '/dashboard/academy',           label: 'Overview',      icon: LayoutDashboard },
  { href: '/dashboard/academy/events',    label: 'Events',        icon: BookOpen },
  { href: '/dashboard/academy/import',    label: 'Import / Export', icon: Upload },
  { href: '/dashboard/academy/gaps',      label: 'Gap Analysis',  icon: SearchX },
  { href: '/dashboard/academy/health',    label: 'System Health', icon: Activity },
  { href: '/dashboard/academy/accounts',  label: 'IPO Accounts',  icon: Users },
]

export default function AcademySidebar({ userEmail }: AcademySidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    if (error) { toast.error('Sign out failed'); return }
    router.push('/login')
    router.refresh()
  }

  const initials = userEmail.slice(0, 2).toUpperCase()

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-background">
      {/* Brand */}
      <div className="px-5 py-5">
        <p className="text-sm font-semibold">WCRP Academy</p>
        <p className="text-xs text-muted-foreground">Internal Dashboard</p>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
              pathname === href
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <Separator />

      {/* User footer */}
      <div className="flex items-center gap-3 px-4 py-4">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  )
}
