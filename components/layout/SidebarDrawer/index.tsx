'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface Props {
  topBar:        React.ReactNode  // shown next to the hamburger in the always-visible bar
  triggerBadge?: React.ReactNode  // small badge overlaid on the trigger button (e.g. pending count)
  header:        React.ReactNode  // brand/identity block at the top of the drawer panel
  footer:        React.ReactNode  // user email + sign-out, bottom of the drawer panel
  children:      React.ReactNode  // the grouped nav content
}

export default function SidebarDrawer({ topBar, triggerBadge, header, footer, children }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Auto-close on navigation — adjusted during render (React's recommended
  // pattern for "reset state when a prop changes"), not in an effect, so it
  // takes effect before paint instead of causing an extra render pass.
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setOpen(false)
  }

  // Auto-close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      {/* Always-visible top bar — normal document flow, not part of the overlay */}
      <header className="flex flex-shrink-0 items-center gap-3 h-14 px-4 border-b bg-background">
        <button
          onClick={() => setOpen(true)}
          className="relative cursor-pointer flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
          {triggerBadge && (
            <span className="absolute -top-1 -right-1">{triggerBadge}</span>
          )}
        </button>
        {topBar}
      </header>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer panel */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-background transition-transform duration-200 ease-in-out',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center justify-between px-4 py-4">
          {header}
          <button
            onClick={() => setOpen(false)}
            className="cursor-pointer flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <Separator />
        <nav className="flex-1 overflow-y-auto space-y-1 px-2 py-4">
          {children}
        </nav>
        <Separator />
        <div className="px-4 py-4">{footer}</div>
      </aside>
    </>
  )
}
