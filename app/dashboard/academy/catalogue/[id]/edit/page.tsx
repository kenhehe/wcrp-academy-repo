import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getAcademyEvent } from '@/lib/data/academy-events'
import { updateAcademyEventAction } from '../../actions'
import AcademyEventForm from '../../_components/AcademyEventForm'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditAcademyEventPage({ params }: PageProps) {
  const { id } = await params
  const { data, error } = await getAcademyEvent(id)

  if (error || !data) notFound()

  const action = async (input: Parameters<typeof updateAcademyEventAction>[1]) => {
    'use server'
    return updateAcademyEventAction(id, input)
  }

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
          <h1 className="text-2xl font-semibold">Edit Event</h1>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-xs truncate">{data.title}</p>
        </div>
      </div>

      <AcademyEventForm
        initialData={data}
        action={action}
        submitLabel="Save changes"
      />
    </div>
  )
}
