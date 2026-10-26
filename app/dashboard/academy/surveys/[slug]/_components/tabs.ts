// The survey page's tabs, shared by the server page (which tab to render) and the client
// tab bar. A plain module on purpose: a Server Component can render a component from a
// 'use client' file but can't read its other exports (a constant there is a client
// reference on the server, and calling .find on it throws).
export const SURVEY_TABS = [
  { id: 'setup',        label: 'Setup' },
  { id: 'participants', label: 'Participants' },
  { id: 'send',         label: 'Send' },
  { id: 'qr',           label: 'QR codes' },
  { id: 'results',      label: 'Results' },
  { id: 'export',       label: 'Export' },
] as const

export type SurveyTabId = typeof SURVEY_TABS[number]['id']
