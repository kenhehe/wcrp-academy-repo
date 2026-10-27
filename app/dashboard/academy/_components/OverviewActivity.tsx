import EventActivity from '@/components/charts/EventActivity'
import { getAcademyActivity } from '@/lib/data/academy-overview'

// IPO events per year and month, the Academy's share drawn as the lower part of each column
export default async function OverviewActivity() {
  const { data, total } = await getAcademyActivity()
  return (
    <EventActivity
      data={data}
      summary={`${total.toLocaleString('en-GB')} events from the ${data.orgs.length} IPOs by start date, and how many are in the Academy`}
    />
  )
}
