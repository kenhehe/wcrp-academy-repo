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

const SCRAPE_STAGES = [
  { label: 'Connecting to website'  },
  { label: 'Fetching events page'   },
  { label: 'Parsing results'        },
  { label: 'Comparing with database'},
]

export default function ScrapePreviewDialog({ ipoId, ipoName, open, onClose }: Props) {
  const [loading,      setLoading]      = useState(false)
  const [loadingStep,  setLoadingStep]  = useState(0)
  const [preview,      setPreview]      = useState<PreviewData | null>(null)
  const [fetchErr,     setFetchErr]     = useState<string | null>(null)
  const [confirmed,    setConfirmed]    = useState(false)
  const [isPending,    startTransition] = useTransition()

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
    setLoadingStep(0)
    setFetchErr(null)
    setPreview(null)
    setConfirmed(false)

    ;(async () => {
      try {
        const r = await fetch(`/api/scrape/preview/${ipoId}`, { method: 'POST' })
        if (!r.ok) {
          const data = await r.json().catch(() => ({})) as { error?: string }
          throw new Error(data.error ?? `HTTP ${r.status}`)
        }

        const reader  = r.body!.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        let lastStageAt = Date.now()
        const MIN_STAGE_MS = 500

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.trim()) continue
            const msg = JSON.parse(line) as Record<string, unknown>
            if (typeof msg.stage === 'number') {
              // Ensure each stage is visible for at least MIN_STAGE_MS
              const elapsed = Date.now() - lastStageAt
              if (elapsed < MIN_STAGE_MS) {
                await new Promise(r => setTimeout(r, MIN_STAGE_MS - elapsed))
              }
              setLoadingStep(msg.stage as number)
              lastStageAt = Date.now()
            } else if (msg.done) {
              await new Promise(r => setTimeout(r, MIN_STAGE_MS))
              const { done: _d, ...rest } = msg
              setPreview(rest as unknown as PreviewData)
            } else if (msg.error) {
              await new Promise(r => setTimeout(r, MIN_STAGE_MS))
              throw new Error(msg.error as string)
            }
          }
        }
      } catch (err) {
        setFetchErr(String(err))
      } finally {
        setLoading(false)
      }
    })()
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

          {/* Loading / stage list — shown while loading OR after a failure so the user sees where it broke */}
          {(loading || fetchErr) && !confirmed && (
            <div className="py-8 px-2 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
                {fetchErr ? 'Preview failed' : 'Running preview'}
              </p>
              {SCRAPE_STAGES.map((stage, i) => {
                const isDone   = fetchErr ? i < loadingStep : i < loadingStep
                const isActive = i === loadingStep
                const isFailed = fetchErr && isActive
                return (
                  <div key={stage.label} className="flex items-center gap-3">
                    <span className="w-4 h-4 flex items-center justify-center shrink-0">
                      {isFailed
                        ? <AlertCircle className="h-4 w-4 text-destructive" />
                        : isDone
                          ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                          : isActive
                            ? <Loader2 className="h-4 w-4 animate-spin text-foreground" />
                            : <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 mx-auto" />
                      }
                    </span>
                    <span className={`text-sm ${
                      isFailed  ? 'text-destructive font-medium' :
                      isDone    ? 'text-muted-foreground line-through' :
                      isActive  ? 'text-foreground font-medium' :
                                  'text-muted-foreground/40'
                    }`}>
                      {stage.label}
                    </span>
                  </div>
                )
              })}

              {fetchErr && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs text-destructive/80 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2">
                    {fetchErr}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You can still trigger the scraper directly — the actual run may succeed even if the preview failed.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Confirmed */}
          {confirmed && (
            <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/20 dark:text-green-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Scrape is running in the background — refresh System Health to see the result.
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
                  {preview.toUpdate.length} already in database
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

              {/* Already-in-DB events */}
              {preview.toUpdate.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Already in database ({preview.toUpdate.length})
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
            <Button size="sm" onClick={handleConfirm} disabled={isPending}>
              {isPending
                ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Queuing…</>
                : 'Trigger anyway'
              }
            </Button>
          )}
          {!confirmed && preview && hasChanges && (
            <Button size="sm" onClick={handleConfirm} disabled={isPending}>
              {isPending
                ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Queuing…</>
                : `Confirm & save ${preview.toInsert.length} new event${preview.toInsert.length !== 1 ? 's' : ''}`
              }
            </Button>
          )}
          {!confirmed && preview && !hasChanges && !loading && (
            <>
              <Button size="sm" variant="outline" onClick={loadPreview}>
                Refresh
              </Button>
              <Button size="sm" variant="outline" onClick={handleConfirm} disabled={isPending}>
                {isPending
                  ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Queuing…</>
                  : 'Force trigger'
                }
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
