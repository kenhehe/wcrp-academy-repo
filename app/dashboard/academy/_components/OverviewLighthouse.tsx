import LighthouseSummary from '@/components/events/LighthouseSummary'
import { getAcademyLighthouse } from '@/lib/data/academy-overview'

// Climate Analytics' Lighthouse card, with each programme's events in the Academy; programmes
// link to their events in the Academy's Event Registry
export default async function OverviewLighthouse() {
  return (
    <LighthouseSummary
      programmes={await getAcademyLighthouse()}
      footer={{ href: '/dashboard/academy/event-registry', label: 'Open Event Registry' }}
      registryHref="/dashboard/academy/event-registry"
    />
  )
}
