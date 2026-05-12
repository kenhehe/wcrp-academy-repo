'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PlusIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type AcademyEventRow, type AcademyEventInput, ACADEMY_STATUS_OPTIONS } from '@/lib/data/academy-events'

interface ExtraField { key: string; value: string }

interface Props {
  initialData?: AcademyEventRow
  action: (data: Partial<AcademyEventInput>) => Promise<{ error?: string } | void>
  submitLabel: string
}

function field(
  label: string,
  value: string,
  onChange: (v: string) => void,
  opts?: { type?: string; required?: boolean; placeholder?: string }
) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">
        {label}{opts?.required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input
        type={opts?.type ?? 'text'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={opts?.placeholder}
        required={opts?.required}
        className="h-8 text-sm"
      />
    </div>
  )
}

export default function AcademyEventForm({ initialData, action, submitLabel }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const toStr = (v: string | null | undefined) => v ?? ''
  const extra = Object.entries(initialData?.extra_fields ?? {}).map(([key, value]) => ({ key, value }))

  const [title,             setTitle]           = useState(toStr(initialData?.title))
  const [academyId,         setAcademyId]        = useState(toStr(initialData?.academy_id))
  const [status,            setStatus]           = useState(toStr(initialData?.status))
  const [trainingType,      setTrainingType]      = useState(toStr(initialData?.training_type))
  const [deliveryMode,      setDeliveryMode]      = useState(toStr(initialData?.delivery_mode))
  const [startDate,         setStartDate]         = useState(toStr(initialData?.start_date))
  const [endDate,           setEndDate]           = useState(toStr(initialData?.end_date))
  const [publishDate,       setPublishDate]       = useState(toStr(initialData?.publish_date))
  const [leadOrganizer,     setLeadOrganizer]     = useState(toStr(initialData?.lead_organizer))
  const [partnerOrganizer,  setPartnerOrganizer]  = useState(toStr(initialData?.partner_organizer))
  const [location,          setLocation]          = useState(toStr(initialData?.location))
  const [languages,         setLanguages]         = useState(toStr(initialData?.languages))
  const [targetAudience,    setTargetAudience]    = useState(toStr(initialData?.target_audience))
  const [level,             setLevel]             = useState(toStr(initialData?.level))
  const [cost,              setCost]              = useState(toStr(initialData?.cost))
  const [certificate,       setCertificate]       = useState(toStr(initialData?.certificate))
  const [officialLink,      setOfficialLink]      = useState(toStr(initialData?.official_link))
  const [permalink,         setPermalink]         = useState(toStr(initialData?.permalink))
  const [contactEmail,      setContactEmail]      = useState(toStr(initialData?.contact_email))
  const [categories,        setCategories]        = useState(toStr(initialData?.categories))
  const [catalogueTags,     setCatalogueTags]     = useState(toStr(initialData?.catalogue_tags))
  const [isExternal,        setIsExternal]        = useState(initialData?.is_external ?? false)
  const [extraFields,       setExtraFields]       = useState<ExtraField[]>(extra)

  const isOnDemand = status === 'On Demand'

  function addExtraField() {
    setExtraFields(f => [...f, { key: '', value: '' }])
  }

  function updateExtraField(i: number, part: Partial<ExtraField>) {
    setExtraFields(f => f.map((row, idx) => idx === i ? { ...row, ...part } : row))
  }

  function removeExtraField(i: number) {
    setExtraFields(f => f.filter((_, idx) => idx !== i))
  }

  function handleSubmit() {
    if (!title.trim()) { setError('Title is required.'); return }
    setError(null)

    const data: Partial<AcademyEventInput> = {
      academy_id:        academyId   || null,
      title:             title.trim(),
      status:            status       || null,
      training_type:     trainingType || null,
      delivery_mode:     deliveryMode || null,
      start_date:        isOnDemand ? null : (startDate  || null),
      end_date:          isOnDemand ? null : (endDate    || null),
      publish_date:      isOnDemand ? (publishDate || null) : (publishDate || null),
      lead_organizer:    leadOrganizer    || null,
      partner_organizer: partnerOrganizer || null,
      location:          location         || null,
      languages:         languages        || null,
      target_audience:   targetAudience   || null,
      level:             level            || null,
      cost:              cost             || null,
      certificate:       certificate      || null,
      official_link:     officialLink     || null,
      permalink:         permalink        || null,
      contact_email:     contactEmail     || null,
      categories:        categories       || null,
      catalogue_tags:    catalogueTags    || null,
      is_external:       isExternal,
      extra_fields:      Object.fromEntries(
        extraFields.filter(f => f.key.trim()).map(f => [f.key.trim(), f.value])
      ),
    }

    startTransition(async () => {
      const result = await action(data)
      if (result && 'error' in result && result.error) {
        setError(result.error)
      }
    })
  }

  return (
    <div className="space-y-8 max-w-4xl">

      {/* Core */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Core</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            {field('Title', title, setTitle, { required: true, placeholder: 'Event title' })}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Status</Label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— Select status —</option>
              {ACADEMY_STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          {field('Training Type', trainingType, setTrainingType, { placeholder: 'e.g. workshop, webinar' })}
          {field('Delivery Mode', deliveryMode, setDeliveryMode, { placeholder: 'e.g. in-person, online' })}
        </div>
      </section>

      {/* Dates */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dates</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {isOnDemand ? (
            field('Publish Date', publishDate, setPublishDate, { type: 'date' })
          ) : (
            <>
              {field('Start Date', startDate, setStartDate, { type: 'date' })}
              {field('End Date',   endDate,   setEndDate,   { type: 'date' })}
              {field('Publish Date (optional)', publishDate, setPublishDate, { type: 'date' })}
            </>
          )}
        </div>
        {isOnDemand && (
          <p className="text-xs text-muted-foreground">
            On Demand events use Publish Date instead of start/end dates.
          </p>
        )}
      </section>

      {/* Organizers */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Organizers</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {field('Lead Organizer',    leadOrganizer,    setLeadOrganizer)}
          {field('Partner Organizer', partnerOrganizer, setPartnerOrganizer)}
        </div>
      </section>

      {/* Details */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {field('Location',        location,       setLocation)}
          {field('Languages',       languages,      setLanguages,    { placeholder: 'e.g. English, French' })}
          {field('Target Audience', targetAudience, setTargetAudience)}
          {field('Level',           level,          setLevel,        { placeholder: 'e.g. Beginner, Advanced' })}
          {field('Cost',            cost,           setCost,         { placeholder: 'e.g. Free, 500 USD' })}
          {field('Certificate',     certificate,    setCertificate)}
        </div>
      </section>

      {/* Links */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Links</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {field('Official Link',   officialLink,  setOfficialLink,  { type: 'url', placeholder: 'https://' })}
          {field('Permalink',       permalink,     setPermalink,     { type: 'url', placeholder: 'https://' })}
          {field('Contact Email',   contactEmail,  setContactEmail,  { type: 'email' })}
        </div>
      </section>

      {/* Metadata */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Metadata</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {field('Academy ID',     academyId,     setAcademyId,     { placeholder: 'Unique ID from Academy catalogue' })}
          {field('Categories',     categories,    setCategories)}
          {field('Catalogue Tags', catalogueTags, setCatalogueTags)}
          <div className="flex items-center gap-2 pt-5">
            <input
              id="is_external"
              type="checkbox"
              checked={isExternal}
              onChange={e => setIsExternal(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="is_external" className="text-sm cursor-pointer">
              Not an IPO event (external source)
            </Label>
          </div>
        </div>
      </section>

      {/* Extra Fields */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Extra Fields</h2>
          <Button type="button" variant="outline" size="sm" onClick={addExtraField} className="h-7 text-xs gap-1">
            <PlusIcon className="h-3 w-3" /> Add field
          </Button>
        </div>
        {extraFields.length === 0 ? (
          <p className="text-xs text-muted-foreground">No extra fields. Click &quot;Add field&quot; to store additional data.</p>
        ) : (
          <div className="space-y-2">
            {extraFields.map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={f.key}
                  onChange={e => updateExtraField(i, { key: e.target.value })}
                  placeholder="Field name"
                  className="h-8 text-sm w-40 flex-shrink-0 font-mono"
                />
                <Input
                  value={f.value}
                  onChange={e => updateExtraField(i, { value: e.target.value })}
                  placeholder="Value"
                  className="h-8 text-sm flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeExtraField(i)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3 pt-2 border-t">
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? 'Saving…' : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
          Cancel
        </Button>
      </div>

    </div>
  )
}
