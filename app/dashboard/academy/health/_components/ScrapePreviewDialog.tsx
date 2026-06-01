'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, RefreshCw, AlertCircle, Info } from 'lucide-react'
import { triggerScrape } from '../actions'

interface PreviewEvent {
  title:      string
  start_date: string
  end_date?:  string | null
  status:     string
  url?:       string | null
  source?:    string
}

interface PreviewData {
  ipo:       string
  toInsert:  PreviewEvent[]
  toUpdate:  PreviewEvent[]
  invalid:   { title: string; errors: string[] }[]
  note?:     string
}

interface Props {
  ipoId:   string
  ipoName: string
  open:    boolean
  onClose: () => void
}

export default function ScrapePreviewDialog({ ipoId, ipoName, open, onClose }: Props) {
  const [loading,  setLoading]  = useState(false)
  const [preview,  setPreview]  = useState<PreviewData | null>(null)
  const [fetchErr, setFetchErr] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Trigger preview fetch whenever the dialog opens
  useEffect(() => {
    async function sync() {
      if (open) loadPreview()
      else {
        setPreview(null)
        setFetchErr(null)
        setConfirmed(false)
      }
    }
    void sync()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function loadPreview() {
    setLoading(true)
    setFetchErr(null)
    setPreview(null)
    setConfirmed(false)

    fetch(`/api/scrape/preview/${ipoId}`, { method: 'POST' })
      .then(async r => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`)
        setPreview(data as PreviewData)
      })
      .catch(err => setFetchErr(String(err)))
      .finally(() => setLoading(false))
  }

  function handleOpenChange(o: boolean) {
    if (!o) onClose()
  }

  function handleConfirm() {
    startTransition(async () => {
      await triggerScrape(ipoId, true) // force=true bypasses pre-check
      setConfirmed(true)
    })
  }

  const hasChanges = preview && (preview.toInsert.length > 0 || preview.toUpdate.length > 0)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">
            Scrape preview — {ipoName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Checking {ipoName} for new events…</p>
            </div>
          )}

          {/* Error */}
          {fetchErr && !loading && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Preview failed</p>
                  <p className="text-xs mt-0.5 text-destructive/80">{fetchErr}</p>
                </div>
              </div>
              <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Force trigger anyway?</p>
                <p>This will log the attempt as a failed run so the IPO dashboard notification is shown to the organisation.</p>
              </div>
            </div>
          )}

          {/* Confirmed */}
          {confirmed && (
            <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/20 dark:text-green-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Scrape queued — check System Health for progress.
            </div>
          )}

          {/* Preview results */}
          {preview && !confirmed && (
            <>
              {/* Summary row */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={preview.toInsert.length > 0 ? 'default' : 'outline'} className="text-xs gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {preview.toInsert.length} new
                </Badge>
                <Badge variant="secondary" className="text-xs gap-1">
                  <RefreshCw className="h-3 w-3" />
                  {preview.toUpdate.length} updates
                </Badge>
                {preview.invalid.length > 0 && (
                  <Badge variant="destructive" className="text-xs gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {preview.invalid.length} invalid
                  </Badge>
                )}
              </div>

              {preview.note && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Info className="h-3 w-3 shrink-0" />
                  {preview.note}
                </div>
              )}

              {/* New events */}
              {preview.toInsert.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    New events ({preview.toInsert.length})
                  </p>
                  <div className="rounded-md border divide-y">
                    {preview.toInsert.map((e, i) => (
                      <div key={i} className="px-3 py-2.5">
                        <p className="text-sm font-medium leading-snug line-clamp-2">
                          {e.url
                            ? <a href={e.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{e.title}</a>
                            : e.title
                          }
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                          {e.start_date}
                          {e.end_date && e.end_date !== e.start_date ? ` → ${e.end_date}` : ''}
                          <span className="ml-2 capitalize">{e.status}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Updated events */}
              {preview.toUpdate.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Updates ({preview.toUpdate.length})
                  </p>
                  <div className="rounded-md border divide-y">
                    {preview.toUpdate.map((e, i) => (
                      <div key={i} className="px-3 py-2.5">
                        <p className="text-sm font-medium leading-snug line-clamp-2">
                          {e.url
                            ? <a href={e.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{e.title}</a>
                            : e.title
                          }
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                          {e.start_date}
                          {e.end_date && e.end_date !== e.start_date ? ` → ${e.end_date}` : ''}
                          <span className="ml-2 capitalize">{e.status}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No changes */}
              {!hasChanges && preview.invalid.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No new events found — site appears up to date.
                </p>
              )}

              {/* Invalid rows */}
              {preview.invalid.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Invalid rows (will be skipped)
                  </p>
                  <div className="rounded-md border divide-y">
                    {preview.invalid.map((e, i) => (
                      <div key={i} className="px-3 py-2 text-xs">
                        <p className="font-medium text-destructive truncate">{e.title}</p>
                        <p className="text-muted-foreground">{e.errors.join(' · ')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
            {confirmed ? 'Close' : 'Cancel'}
          </Button>
          {!confirmed && fetchErr && !loading && (
            <Button size="sm" variant="destructive" onClick={handleConfirm} disabled={isPending}>
              {isPending
                ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Queuing…</>
                : 'Force trigger & log failure'
              }
            </Button>
          )}
          {!confirmed && preview && hasChanges && (
            <Button size="sm" onClick={handleConfirm} disabled={isPending}>
              {isPending
                ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Queuing…</>
                : `Confirm & save ${preview.toInsert.length + preview.toUpdate.length} events`
              }
            </Button>
          )}
          {!confirmed && preview && !hasChanges && !loading && (
            <Button size="sm" variant="outline" onClick={loadPreview}>
              Refresh
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
