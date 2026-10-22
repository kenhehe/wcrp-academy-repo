'use client'

import { useEffect, useState } from 'react'
import StatTile from '@/components/base/StatTile'
import { formatUtcMinutes, nextScheduledRun } from '@/lib/data/scrape-schedule'

interface Props {
  initialNow: number  // server time, so the first client render matches the server's
}

export default function NextRunTile({ initialNow }: Props) {
  const [now, setNow] = useState(initialNow)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const { entry, at } = nextScheduledRun(now)
  const minutes = Math.max(1, Math.ceil((at - now) / 60_000))
  const wait    = minutes >= 60 ? `in ${Math.floor(minutes / 60)}h ${minutes % 60}m` : `in ${minutes}m`
  const slot    = formatUtcMinutes(new Date(at).getUTCHours() * 60 + new Date(at).getUTCMinutes())

  return <StatTile label="Next scheduled run" value={wait} sub={`${entry.name} at ${slot} UTC`} />
}
