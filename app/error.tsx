'use client'

import { useEffect } from 'react'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <p className="text-sm font-medium text-destructive">Something went wrong</p>
      <p className="text-sm text-muted-foreground max-w-sm text-center">{error.message}</p>
      <button
        onClick={reset}
        className="text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground"
      >
        Try again
      </button>
    </div>
  )
}
