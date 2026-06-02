export type SourceType = 'html' | 'third_party' | 'blocked'

export interface IpoSource {
  type:      SourceType
  label:     string     // human-readable method, e.g. "Official website"
  platform?: string     // third-party name, e.g. "Elfsight"
  url:       string     // the actual source URL
}

export const IPO_SOURCES: Record<string, IpoSource> = {
  gewex:  { type: 'html',        label: 'Official website', url: 'https://www.gewexevents.org/all-events/' },
  cordex: { type: 'html',        label: 'Official website', url: 'https://cordex.org/news-events/meetings/' },
  esmo:   { type: 'html',        label: 'Official website', url: 'https://www.wcrp-esmo.org/calendar/' },
  rifs:   { type: 'html',        label: 'Official website', url: 'https://www.wcrp-rifs.org/news-and-events/workshops/' },
  cmip:   { type: 'blocked',     label: 'Cloudflare protected', url: 'https://wcrp-cmip.org/science-and-seminars/cmip-seminars/' },
  clic:   { type: 'third_party', label: 'Elfsight Calendar', platform: 'Elfsight', url: 'https://climate-cryosphere.org/events/' },
  clivar: { type: 'html',        label: 'Official website', url: 'https://www.clivar.org/events' },
}
