'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, SearchX, Activity, Users, LogOut, BookOpen, Upload, Database, Copy, Rows3 } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import SidebarDrawer from '@/components/layout/SidebarDrawer'
import type { AcademySidebarProps } from './types'

const NAV_GROUPS = [
  {
    label: undefined,
    items: [
      { href: '/dashboard/academy', label: 'Overview', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Catalogue',
    items: [
      { href: '/dashboard/academy/events',    label: 'Coverage',        icon: BookOpen },
      { href: '/dashboard/academy/catalogue', label: 'Catalogue',       icon: Database },
      { href: '/dashboard/academy/import',    label: 'Import / Export', icon: Upload },
    ],
  },
  {
    label: 'Data Quality',
    items: [
      { href: '/dashboard/academy/gaps',           label: 'Gap Analysis',   icon: SearchX },
      { href: '/dashboard/academy/duplicates',      label: 'Duplicates',    icon: Copy },
      { href: '/dashboard/academy/event-registry',  label: 'Event Registry', icon: Rows3 },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/dashboard/academy/health',   label: 'System Health', icon: Activity },
      { href: '/dashboard/academy/accounts', label: 'IPO Accounts',  icon: Users },
    ],
  },
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

  function isActive(href: string) {
    return pathname === href || (href !== '/dashboard/academy' && pathname.startsWith(href))
  }

  return (
    <SidebarDrawer
      topBar={<p className="text-sm font-medium">WCRP Academy</p>}
      header={
        <div>
          <p className="text-sm font-semibold">WCRP Academy</p>
          <p className="text-xs text-muted-foreground">Internal Dashboard</p>
        </div>
      }
      footer={
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <p className="truncate text-xs text-muted-foreground flex-1">{userEmail}</p>
          <button
            onClick={handleSignOut}
            className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      }
    >
      {NAV_GROUPS.map((group, i) => (
        <div key={group.label ?? `group-${i}`}>
          {group.label && (
            <p className="px-3 pt-4 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground first:pt-0">
              {group.label}
            </p>
          )}
          {group.items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive(href)
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          ))}
        </div>
      ))}
    </SidebarDrawer>
  )
}
