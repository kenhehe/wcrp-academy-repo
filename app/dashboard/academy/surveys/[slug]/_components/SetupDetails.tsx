'use client'

// Setup tab: the name participants see and the survey windows. The event's dates come from the
// Academy catalogue (edited on WordPress) and show read-only; a stand-alone survey has none. The
// slug (and so every link and QR code) stays the same when the name changes.
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { checkSurveyTimes, checkTitle, eventFromCatalogue, resolveSurveyTimes, toLocalInput, type LocalTimes } from '@/lib/data/survey-setup'
import type { SurveyEventRow } from '@/lib/data/surveys.types'
import { updateSurveyDetails } from '../../actions'
import SurveyTimesFields from '../../_components/SurveyTimesFields'

const local = (iso: string | null) => (iso ? toLocalInput(new Date(iso)) : '')

export interface SetupEvent {
  title: string
  start: string | null   // catalogue days, '2027-01-11'
  end:   string | null
}

// Saved windows as the admin's local inputs; they count as typed, so they stay put until
// "Use suggested times"
function savedTimes(s: SurveyEventRow, event: SetupEvent | null): LocalTimes {
  return {
    ...eventFromCatalogue(event?.start ?? null, event?.end ?? null),
    windows: {
      preOpensAt:   local(s.pre_opens_at),
      preClosesAt:  local(s.pre_closes_at),
      postOpensAt:  local(s.post_opens_at),
      postClosesAt: local(s.post_closes_at),
    },
  }
}

export default function SetupDetails({ survey, event }: { survey: SurveyEventRow; event: SetupEvent | null }) {
  const [title, setTitle] = useState(survey.title)
  // Computed again in the browser on hydration, so the inputs show the admin's local time
  const [initial] = useState(() => savedTimes(survey, event))
  const [times, setTimes] = useState<LocalTimes>(initial)
  const [pending, startTransition] = useTransition()

  const resolved = resolveSurveyTimes(times)
  const before   = resolveSurveyTimes(initial)
  const dirty    = title.trim() !== survey.title || JSON.stringify(resolved.iso) !== JSON.stringify(before.iso)
  const problem  = checkTitle(title) ?? checkSurveyTimes(resolved.iso)

  function handleSave() {
    startTransition(async () => {
      try {
        const result = await updateSurveyDetails(survey.id, { title, ...resolved.iso })
        if (!result.ok) { toast.error(result.error); return }
        toast.success('Saved')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not save the survey')
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Name and survey windows</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="s-title">Name participants see</Label>
          <Input id="s-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={200} />
          {event && title.trim() !== event.title && (
            <p className="text-xs text-muted-foreground">Catalogue title: {event.title}</p>
          )}
        </div>
        <SurveyTimesFields value={times} onChange={setTimes} noEvent={survey.academy_event_id === null} />
        <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
          {dirty && problem && <p role="alert" className="mr-auto text-sm text-danger">{problem}</p>}
          <Button type="button" variant="outline" disabled={!dirty || pending} onClick={() => { setTitle(survey.title); setTimes(initial) }}>
            Undo changes
          </Button>
          <Button type="button" disabled={!dirty || Boolean(problem) || pending} onClick={handleSave}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
