import type { RegistryEventRow, RegistryOrg } from '@/components/events/EventRegistryBrowser/types'

export interface AddEventButtonProps {
  orgs: RegistryOrg[]   // only IPOs and Lighthouse programmes
}

export interface RegistryRowActionsProps {
  event: RegistryEventRow
  org:   RegistryOrg | undefined
}
