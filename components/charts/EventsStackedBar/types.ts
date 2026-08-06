export interface OrgSeries {
  id:    string
  name:  string
  color: string
}

export interface OrgEvent {
  org_id: string
  year:   number | null
  month:  number | null
}

export interface EventsStackedBarProps {
  orgs:   OrgSeries[]
  events: OrgEvent[]
  height?: number
}
