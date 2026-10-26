import { FilePen, Lock, Radio } from 'lucide-react'
import StatusBadge from '@/components/base/StatusBadge'
import { SURVEY_STATUS_LABELS, type SurveyStatus } from '@/lib/data/surveys.types'

const LOOK = {
  draft:  { tone: 'neutral', icon: FilePen },
  active: { tone: 'success', icon: Radio },
  closed: { tone: 'info',    icon: Lock },
} as const

export default function SurveyStatusBadge({ status }: { status: SurveyStatus }) {
  const look = LOOK[status]
  return <StatusBadge tone={look.tone} icon={look.icon}>{SURVEY_STATUS_LABELS[status]}</StatusBadge>
}
