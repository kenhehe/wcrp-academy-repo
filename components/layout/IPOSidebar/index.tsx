'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, CalendarDays, Upload, LogOut } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { IPOSidebarProps } from './types'

const NAV = [
  { href: '/dashboard/ipo',         label: 'Overview',       icon: LayoutDashboard },
  { href: '/dashboard/ipo/events',  label: 'Events',         icon: CalendarDays },
  { href: '/dashboard/ipo/import',  label: 'Import / Export', icon: Upload },
]

export default function IPOSidebar({ ipoName, ipoId, colorHex, userEmail }: IPOSidebarProps) {
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
      {/* Brand + IPO identity */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div
          className="h-3 w-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: colorHex }}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{ipoName}</p>
          <p className="truncate text-xs text-muted-foreground uppercase tracking-wide">{ipoId}</p>
        </div>
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
