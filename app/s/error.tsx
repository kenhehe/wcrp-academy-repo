'use client'

import { useEffect } from 'react'

// Participants never see a stack trace: a short apology and a retry
export default function SurveyError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="space-y-3 rounded-2xl border bg-background p-6 text-center">
      <p className="font-medium">Something went wrong</p>
      <p className="text-sm text-muted-foreground">Please try again. If it keeps happening, write to office@wcrp-academy.org.</p>
      <button onClick={reset} className="cursor-pointer text-sm underline underline-offset-4">Try again</button>
    </div>
  )
}
