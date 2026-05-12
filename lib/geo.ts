export type GeoCategory = 'North' | 'South' | 'Other'

const VIRTUAL = new Set([
  'Global', 'Online', 'N/A', 'TBA', 'Europe',
  'Italy / India', 'France; USA; Australia; China',
])

const NORTH = new Set([
  'USA', 'Germany', 'UK', 'United Kingdom', 'Scotland', 'Scotland (UK)',
  'France', 'Italy', 'Australia', 'Switzerland', 'Netherlands', 'Japan',
  'Norway', 'Austria', 'Canada', 'Spain', 'South Korea', 'Korea',
  'New Zealand', 'Belgium', 'Denmark', 'Sweden', 'Greece', 'Poland',
  'Portugal', 'Singapore', 'Czech Republic', 'Hungary', 'Russia',
  'Ireland', 'Lithuania', 'Estonia', 'Slovenia', 'Croatia', 'Israel',
])

const SOUTH = new Set([
  'China', 'South Africa', 'Brazil', 'India', 'Indonesia', 'Chile',
  'Mexico', 'Ecuador', 'Argentina', 'Thailand', 'Nepal', 'Vietnam',
  'Philippines', 'Malaysia', 'Senegal', 'Mozambique', 'Uzbekistan',
  'Turkey', 'Uganda', 'Bhutan', 'Uruguay', 'Bangladesh', 'Guatemala',
  'New Caledonia', 'Dominican Republic', 'Peru', 'Rwanda', 'Colombia',
  'Bolivia', 'Tajikistan', 'Tanzania',
])

// Merge variant spellings into a canonical display name
export const COUNTRY_NORMALIZE: Record<string, string> = {
  'United Kingdom':  'UK',
  'Scotland':        'UK',
  'Scotland (UK)':   'UK',
  'Korea':           'South Korea',
}

export function classifyCountry(country: string | null): GeoCategory {
  if (!country || VIRTUAL.has(country)) return 'Other'
  if (NORTH.has(country)) return 'North'
  if (SOUTH.has(country)) return 'South'
  return 'Other'
}
