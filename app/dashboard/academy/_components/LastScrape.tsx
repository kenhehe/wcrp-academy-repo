import Link from 'next/link'
import LocalDateTime from '@/components/surveys/LocalDateTime'
import { getLastScrape } from '@/lib/data/academy-overview'

// "Scrapers last ran 27 Oct, 09:45", in the viewer's time zone, linking to System Health
export default async function LastScrape() {
  const at = await getLastScrape()
  return (
    <Link href="/dashboard/academy/health" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
      {at ? <span>Scrapers last ran <LocalDateTime iso={at} /></span> : 'No scraper runs yet'}
    </Link>
  )
}
