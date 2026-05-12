'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { LayoutDashboard, SearchX, Activity, Users, LogOut, BookOpen, Upload, Database, ChevronLeft, ChevronRight } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { AcademySidebarProps } from './types'

const NAV = [
  { href: '/dashboard/academy',           label: 'Overview',        icon: LayoutDashboard },
  { href: '/dashboard/academy/events',     label: 'Coverage',        icon: BookOpen },
  { href: '/dashboard/academy/catalogue', label: 'Catalogue',       icon: Database },
  { href: '/dashboard/academy/import',    label: 'Import / Export', icon: Upload },
  { href: '/dashboard/academy/gaps',      label: 'Gap Analysis',    icon: SearchX },
  { href: '/dashboard/academy/health',    label: 'System Health',   icon: Activity },
  { href: '/dashboard/academy/accounts',  label: 'IPO Accounts',    icon: Users },
]

export default function AcademySidebar({ userEmail }: AcademySidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
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
    <aside className={cn(
      'flex h-screen flex-col border-r bg-background transition-all duration-200',
      collapsed ? 'w-14' : 'w-60'
    )}>
      {/* Brand + toggle */}
      <div className={cn('flex items-center py-4 overflow-hidden', collapsed ? 'justify-center px-2' : 'px-4')}>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold whitespace-nowrap">WCRP Academy</p>
            <p className="text-xs text-muted-foreground">Internal Dashboard</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-4">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            title={collapsed ? label : undefined}
            className={cn(
              'flex items-center rounded-md py-2 text-sm transition-colors',
              collapsed ? 'justify-center px-2' : 'gap-3 px-3',
              (pathname === href || (href !== '/dashboard/academy' && pathname.startsWith(href)))
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </Link>
        ))}
      </nav>

      <Separator />

      {/* User footer */}
      <div className={cn(
        'flex items-center gap-3 py-4',
        collapsed ? 'justify-center px-2 flex-col' : 'px-4'
      )}>
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        {!collapsed && (
          <p className="truncate text-xs text-muted-foreground flex-1">{userEmail}</p>
        )}
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
