import type { Metadata } from 'next'

// Participant pages: no login, no dashboard chrome, phone first
export const metadata: Metadata = {
  title: 'Survey · WCRP Academy',
  robots: { index: false, follow: false },
}

export default function SurveyLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-canvas px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-md">{children}</div>
    </main>
  )
}
