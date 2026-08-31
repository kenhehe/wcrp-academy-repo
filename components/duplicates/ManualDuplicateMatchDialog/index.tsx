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

function useDebouncedSearch(query: string, excludeId?: string, excludeIpoId?: string) {
  const [results,   setResults]   = useState<CandidateResult[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!query.trim()) return
    const t = setTimeout(async () => {
      setSearching(true)
      const data = await searchDuplicateCandidates(query, excludeId, excludeIpoId)
      setResults(data)
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [query, excludeId, excludeIpoId])

  return { results, searching }
}

function SearchColumn({
  label,
  query,
  onQueryChange,
  results,
  searching,
  selected,
  onSelect,
}: {
  label:     string
  query:     string
  onQueryChange: (v: string) => void
  results:   CandidateResult[]
  searching: boolean
  selected:  CandidateResult | null
  onSelect:  (r: CandidateResult) => void
}) {
  const showNoResults = !!query.trim() && !searching && results.length === 0

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Search events…"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          className="w-full rounded-md border bg-background pl-8 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
        />
        {searching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
        {!query.trim() ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            Type to search
          </p>
        ) : showNoResults ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            No results for &ldquo;{query}&rdquo;
          </p>
        ) : (
          results.map(r => (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelect(r)}
              className={`w-full text-left px-3 py-2 transition-colors cursor-pointer ${
                selected?.id === r.id
                  ? 'bg-primary/10 border-l-2 border-l-primary'
                  : 'hover:bg-muted/50'
              }`}
            >
              <p className="text-sm font-medium leading-snug truncate">{r.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wide">
                {r.ipo_id} · {r.start_date ?? r.status ?? '—'}
              </p>
            </button>
          ))
        )}
      </div>

      {selected && (
        <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Selected: </span>
          <span className="font-medium">{selected.title}</span>
        </div>
      )}
    </div>
  )
}

export default function ManualDuplicateMatchDialog() {
  const [open, setOpen] = useState(false)

  const [queryA,    setQueryA]    = useState('')
  const [selectedA, setSelectedA] = useState<CandidateResult | null>(null)
  const [queryB,    setQueryB]    = useState('')
  const [selectedB, setSelectedB] = useState<CandidateResult | null>(null)

  const { results: resultsA, searching: searchingA } = useDebouncedSearch(queryA, selectedB?.id, selectedB?.ipo_id)
  const { results: resultsB, searching: searchingB } = useDebouncedSearch(queryB, selectedA?.id, selectedA?.ipo_id)

  const [isPending, startTransition] = useTransition()

  function handleOpen(o: boolean) {
    setOpen(o)
    if (!o) {
      setQueryA(''); setSelectedA(null)
      setQueryB(''); setSelectedB(null)
    }
  }

  function handleConfirm() {
    if (!selectedA || !selectedB) return
    startTransition(async () => {
      const fd = new FormData()
      fd.append('event_id', selectedA.id)
      fd.append('duplicate_of_event_id', selectedB.id)
      await linkDuplicate(fd)
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <LinkIcon className="h-3.5 w-3.5" />
        Link two events manually
      </Button>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Link duplicate events</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Search for both sides of a duplicate the automatic matcher missed, then link them.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SearchColumn
            label="First event"
            query={queryA}
            onQueryChange={v => { setQueryA(v); setSelectedA(null) }}
            results={resultsA}
            searching={searchingA}
            selected={selectedA}
            onSelect={setSelectedA}
          />
          <SearchColumn
            label="Second event"
            query={queryB}
            onQueryChange={v => { setQueryB(v); setSelectedB(null) }}
            results={resultsB}
            searching={searchingB}
            selected={selectedB}
            onSelect={setSelectedB}
          />
        </div>

        <DialogFooter showCloseButton>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={!selectedA || !selectedB || isPending}
          >
            {isPending
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Linking…</>
              : <><LinkIcon className="mr-1.5 h-3.5 w-3.5" />Link as same event</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
