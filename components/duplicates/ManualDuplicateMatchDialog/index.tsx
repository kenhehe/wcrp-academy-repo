'use client'

import { useState, useEffect, useTransition } from 'react'
import { LinkIcon, Search, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { searchDuplicateCandidates, linkDuplicate } from '@/lib/actions/event-duplicates'

interface CandidateResult {
  id:         string
  ipo_id:     string
  title:      string
  start_date: string | null
  status:     string | null
}

interface Props {
  eventId:    string
  eventTitle: string
  ipoId:      string
}

export default function ManualDuplicateMatchDialog({ eventId, eventTitle, ipoId }: Props) {
  const [open,      setOpen]      = useState(false)
  const [query,     setQuery]     = useState('')
  const [results,   setResults]   = useState<CandidateResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected,  setSelected]  = useState<CandidateResult | null>(null)
  const [isPending, startTransition] = useTransition()

  // Debounced search. Nothing to clear when query is empty — the render below
  // already skips `results` entirely in that case (shows the "type to search" hint).
  useEffect(() => {
    if (!query.trim()) return
    const t = setTimeout(async () => {
      setSearching(true)
      const data = await searchDuplicateCandidates(query, eventId, ipoId)
      setResults(data)
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [query, eventId, ipoId])

  function handleOpen(o: boolean) {
    setOpen(o)
    if (!o) {
      setQuery('')
      setResults([])
      setSelected(null)
    }
  }

  function handleConfirm() {
    if (!selected) return
    startTransition(async () => {
      const fd = new FormData()
      fd.append('event_id', eventId)
      fd.append('duplicate_of_event_id', selected.id)
      await linkDuplicate(fd)
      setOpen(false)
    })
  }

  const showNoResults = !!query.trim() && !searching && results.length === 0

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <Button
        variant="outline"
        size="sm"
        className="text-xs gap-1.5"
        onClick={() => setOpen(true)}
      >
        <LinkIcon className="h-3 w-3" />
        Link manually
      </Button>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link duplicate event</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            Finding a match for: <span className="font-medium text-foreground">{eventTitle}</span>
          </p>
        </DialogHeader>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search other IPOs' events…"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(null) }}
            className="w-full rounded-md border bg-background pl-8 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            autoFocus
          />
          {searching && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Results */}
        <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
          {!query.trim() ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              Type to search other IPOs&rsquo; events
            </p>
          ) : showNoResults ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              No results for &ldquo;{query}&rdquo;
            </p>
          ) : (
            results.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r)}
                className={`w-full text-left px-3 py-2.5 transition-colors cursor-pointer ${
                  selected?.id === r.id
                    ? 'bg-primary/10 border-l-2 border-l-primary'
                    : 'hover:bg-muted/50'
                }`}
              >
                <p className="text-sm font-medium leading-snug">{r.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wide">
                  {r.ipo_id} · {r.start_date ?? r.status ?? '—'}
                </p>
              </button>
            ))
          )}
        </div>

        {/* Selected preview */}
        {selected && (
          <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Selected: </span>
            <span className="font-medium">{selected.title}</span>
          </div>
        )}

        <DialogFooter showCloseButton>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={!selected || isPending}
          >
            {isPending
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Linking…</>
              : <><LinkIcon className="mr-1.5 h-3.5 w-3.5" />Confirm duplicate</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
