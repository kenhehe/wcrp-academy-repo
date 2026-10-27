import ComingUp from '@/components/events/ComingUp'
import { getAcademyComingUp } from '@/lib/data/academy-overview'

// Climate Analytics' Coming up table, with whether each event is in the Academy
export default async function OverviewComingUp() {
  const { next, upcoming } = await getAcademyComingUp()
  return (
    <ComingUp
      className="xl:col-span-2"
      events={next}
      upcoming={upcoming}
      viewAllHref="/dashboard/academy/event-registry?status=Upcoming"
    />
  )
}
