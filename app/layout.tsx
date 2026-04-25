import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'WCRP Events Repository',
  description: 'Internal operational tool for WCRP IPOs and Academy curation team',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${geist.className} h-full antialiased`}>
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  )
}
