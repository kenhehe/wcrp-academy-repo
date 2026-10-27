import EventActivity from '@/components/charts/EventActivity'
import { getAcademyActivity } from '@/lib/data/academy-overview'

// IPO and Lighthouse events per year and month, the Academy's share drawn as the lower part of each column
export default async function OverviewActivity() {
  const { data, total } = await getAcademyActivity()
  const ipos       = data.orgs.filter(o => o.type === 'ipo').length
  const lighthouse = data.orgs.length - ipos
  return (
    <EventActivity
      data={data}
      summary={`${total.toLocaleString('en-GB')} events from the ${ipos} IPOs and ${lighthouse} Lighthouse programmes by start date, and how many are in the Academy`}
    />
  )
}
