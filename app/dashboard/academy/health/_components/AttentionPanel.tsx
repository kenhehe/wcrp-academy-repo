import Link from 'next/link'
import { TriangleAlert } from 'lucide-react'
import type { AttentionItem } from '@/lib/data/health'

export default function AttentionPanel({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null

  return (
    <section aria-labelledby="attention-title" className="space-y-3 rounded-xl border border-warning/30 bg-warning-soft p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning">
          <TriangleAlert className="size-4" aria-hidden="true" />
        </span>
        <h2 id="attention-title" className="text-base font-semibold">
          {items.length === 1 ? '1 scraper needs attention' : `${items.length} scrapers need attention`}
        </h2>
      </div>
      <ul className="space-y-3">
        {items.map(item => (
          <li key={item.ipo.id} className="flex items-start gap-3 text-sm">
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full"
              style={{ backgroundColor: item.ipo.color_hex ?? 'var(--muted-foreground)' }}
            />
            <p className="min-w-0 flex-1 leading-relaxed">
              <span className="font-semibold">{item.ipo.name}</span>: {item.message}
            </p>
            {item.href && (
              <Link href={item.href} className="shrink-0 font-medium text-primary hover:underline">
                View runs
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
