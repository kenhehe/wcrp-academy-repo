// Every org dropdown groups the same way: IPOs, then Lighthouse Activities, then the
// Secretariat, each alphabetical by short name (ipos.name holds the acronym, ipos.full_name
// the long form). Plain module, safe for client components.

export const ORG_GROUP_LABELS: Record<string, string> = {
  ipo:         'IPOs',
  lighthouse:  'Lighthouse Activities',
  secretariat: 'Secretariat',
}

const GROUP_ORDER = ['ipo', 'lighthouse', 'secretariat']

export interface OrgGroup<T> {
  type:  string
  label: string
  items: T[]
}

export function groupOrgsByType<T extends { type: string; name: string }>(orgs: T[]): OrgGroup<T>[] {
  const types = [...GROUP_ORDER, ...new Set(orgs.map(o => o.type).filter(t => !GROUP_ORDER.includes(t)))]
  return types
    .map(type => ({
      type,
      label: ORG_GROUP_LABELS[type] ?? type,
      items: orgs.filter(o => o.type === type).sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter(group => group.items.length > 0)
}

// "MCR · My Climate Risk", or just the name when there's no longer form
export function orgFullLabel(org: { name: string; full_name?: string | null }): string {
  return org.full_name && org.full_name !== org.name ? `${org.name} · ${org.full_name}` : org.name
}
