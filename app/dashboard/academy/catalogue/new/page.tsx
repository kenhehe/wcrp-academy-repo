import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createAcademyEventAction } from '../actions'
import AcademyEventForm from '../_components/AcademyEventForm'

export const dynamic = 'force-dynamic'

export default function NewAcademyEventPage() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/academy/catalogue"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1')}
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">New Event</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Add a new event to the Academy catalogue</p>
        </div>
      </div>

      <AcademyEventForm
        action={createAcademyEventAction}
        submitLabel="Create event"
      />
    </div>
  )
}
