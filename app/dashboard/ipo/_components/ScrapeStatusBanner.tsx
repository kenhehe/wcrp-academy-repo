'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, ChevronDown, ChevronUp, X, Zap, Globe, FileSpreadsheet, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

const CONTACT_EMAIL = 'wcrp-academy@wcrp-climate.org'

const SOLUTIONS = [
  {
    label:       'Quick Fix',
    labelColor:  'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    icon:        Zap,
    title:       'Whitelist our scraper bot',
    description: 'Ask your web admin to add a firewall rule allowing our bot by User-Agent. Takes ~2 minutes and fully restores automatic sync — no ongoing effort needed.',
  },
  {
    label:       'Best Long-Term',
    labelColor:  'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    icon:        Globe,
    title:       'Connect via REST API',
    description: 'Expose a simple API endpoint from your website so we can pull event data directly. Fully automated, real-time, and no bot-detection risk.',
  },
  {
    label:       'Alternative',
    labelColor:  'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    icon:        FileSpreadsheet,
    title:       'Send us a CSV / spreadsheet',
    description: 'Email us your events as a spreadsheet and we\'ll import them on your behalf. No technical knowledge required — just send us the file whenever you have new events.',
  },
  {
    label:       'Stop-Gap',
    labelColor:  'bg-muted text-muted-foreground',
    icon:        Upload,
    title:       'Manual import via Import page',
    description: 'Use the Import page to upload events yourself. Note: this needs to be repeated whenever new events are added to your website — it does not sync automatically.',
  },
]

function friendlyReason(errorMessage: string | null): string {
  if (!errorMessage) return 'We encountered an issue reading your events page.'
  const msg = errorMessage.toLowerCase()
  if (msg.includes('403') || msg.includes('forbidden') || msg.includes('cloudflare') || msg.includes('turnstile') || msg.includes('bot protection'))
    return 'Your website has security settings (bot protection) that are blocking our automated fetch.'
  if (msg.includes('404') || msg.includes('not found'))
    return 'The events page on your website could not be found — the URL may have changed.'
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('etimedout'))
    return 'Your website was temporarily unreachable (connection timed out).'
  if (msg.includes('econnrefused') || msg.includes('network') || msg.includes('socket'))
    return 'Your website was temporarily unreachable (network error).'
  return 'We encountered an issue reading your events page.'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

interface Props {
  runId:        string
  startedAt:    string
  errorMessage: string | null
  ipoName:      string
}

export default function ScrapeStatusBanner({ runId, startedAt, errorMessage, ipoName }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const [expanded,  setExpanded]  = useState(false)

  useEffect(() => {
    async function check() {
      if (localStorage.getItem(`scrape_banner_dismissed_${runId}`)) setDismissed(true)
    }
    void check()
  }, [runId])

  if (dismissed) return null

  function handleDismiss() {
    localStorage.setItem(`scrape_banner_dismissed_${runId}`, '1')
    setDismissed(true)
  }

  const reason  = friendlyReason(errorMessage)
  const subject = encodeURIComponent(`Events sync issue — ${ipoName}`)
  const body    = encodeURIComponent(
    `Hi WCRP Academy team,\n\nWe noticed our events couldn't be synced automatically on ${fmtDate(startedAt)}.\n\nCould you help us resolve this?\n\nBest regards,\n${ipoName}`,
  )

  return (
    <div className="mx-6 mt-6 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
      {/* Main row */}
      <div className="flex items-start gap-3 p-4">
        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Your events couldn&apos;t be synced automatically
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
            {reason} Last attempted {fmtDate(startedAt)}.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a href={`mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`}>
            <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/30">
              Contact us
            </Button>
          </a>
          <button
            onClick={handleDismiss}
            className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 p-0.5 rounded"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Solutions toggle */}
      <div className="border-t border-amber-200 dark:border-amber-800">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex w-full items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 transition-colors"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {expanded ? 'Hide solutions' : 'How to resolve this'}
        </button>

        {expanded && (
          <div className="px-4 pb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SOLUTIONS.map(({ label, labelColor, icon: Icon, title, description }) => (
              <div key={title} className="rounded-md border bg-white dark:bg-background p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${labelColor}`}>
                    <Icon className="h-2.5 w-2.5" />
                    {label}
                  </span>
                </div>
                <p className="text-sm font-medium leading-snug">{title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
