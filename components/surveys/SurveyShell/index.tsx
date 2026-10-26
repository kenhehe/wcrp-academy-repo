import { Clock } from 'lucide-react'
import type { SurveyShellProps } from './types'

// The participant survey's card: brand, survey name, stage and length, then the content.
// Used by the public pages (/s/…) and the admin preview, so both look the same.
export default function SurveyShell({ title, stage, minutes, children }: SurveyShellProps) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-background">
      <header className="space-y-1.5 border-b px-5 py-4">
        <p className="text-sm font-semibold text-primary">WCRP Academy</p>
        <h1 className="text-lg font-semibold leading-snug">{title}</h1>
        {stage && (
          <p className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium">
            <Clock className="size-3.5" aria-hidden="true" />
            {stage === 'pre' ? 'Before-survey' : 'After-survey'}
            {minutes !== undefined && ` · about ${minutes} minute${minutes === 1 ? '' : 's'}`}
          </p>
        )}
      </header>
      <div className="px-5 py-5">{children}</div>
    </div>
  )
}
