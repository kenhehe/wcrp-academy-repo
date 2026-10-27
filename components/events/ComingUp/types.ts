import type { UpcomingEvent } from '@/lib/data/climate-analytics.types'

export interface ComingUpProps {
  events:      UpcomingEvent[]   // nextUpcoming(); with their inAcademy flags, the table adds an Academy column
  upcoming:    number            // every upcoming event, for 'Next 6 of N'
  viewAllHref: string            // that dashboard's Event Registry, filtered to upcoming events
  className?:  string
}
