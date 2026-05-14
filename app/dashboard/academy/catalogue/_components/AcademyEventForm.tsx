'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PlusIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import RichTextEditor from '@/components/ui/rich-text-editor'
import { type AcademyEventRow, type AcademyEventInput, ACADEMY_STATUS_OPTIONS } from '@/lib/data/academy-events.types'

const CATEGORY_OPTIONS = [
  'Physical Science Basis of Climate Change',
  'Climate Change Impacts, Adaptation, and Vulnerability',
  'Mitigation of Climate Change',
]

const TRAINING_TYPE_OPTIONS = [
  'Conference',
  'MOOC',
  'Science meetings',
  'Seasonal school',
  'Short course',
  'Webinar',
  'Workshop',
]

const DELIVERY_MODE_OPTIONS = [
  'In person',
  'Online',
  'Hybrid',
]

const TARGET_AUDIENCE_OPTIONS = [
  'Undergraduate students',
  'Master\'s students',
  'PhD students',
  'Early and mid-career researchers',
  'Senior researchers',
  'Government',
  'Civil society organizations and media',
  'Business sector',
  'Marginalized groups (e.g. women, indigenous peoples)',
]

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

function normalizeToOption(value: string | null | undefined, options: string[]): string {
  if (!value) return ''
  const cleaned = value.replace(/[_-]/g, ' ').toLowerCase().trim()
  return options.find(o => o.toLowerCase() === cleaned) ?? value
}

function selectField(
  label: string,
  value: string,
  onChange: (v: string) => void,
  options: string[],
  opts?: { placeholder?: string }
) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">{opts?.placeholder ?? `— Select ${label.toLowerCase()} —`}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function boolSelect(
  label: string,
  value: boolean | null,
  onChange: (v: boolean | null) => void,
  opts?: { trueLabel?: string; falseLabel?: string }
) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <select
        value={value === null ? '' : value ? 'true' : 'false'}
        onChange={e => {
          const v = e.target.value
          onChange(v === '' ? null : v === 'true')
        }}
        className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">— Not set —</option>
        <option value="true">{opts?.trueLabel  ?? 'Yes'}</option>
        <option value="false">{opts?.falseLabel ?? 'No'}</option>
      </select>
    </div>
  )
}

export default function AcademyEventForm({ initialData, action, submitLabel }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const toStr = (v: string | null | undefined) => v ?? ''

  // Core
  const [title,            setTitle]           = useState(toStr(initialData?.title))
  const [status,           setStatus]           = useState(toStr(initialData?.status))

  // Organizers
  const [leadOrganizer,    setLeadOrganizer]    = useState(toStr(initialData?.lead_organizer))
  const [partnerOrganizer, setPartnerOrganizer] = useState(toStr(initialData?.partner_organizer))

  // Dates
  const [startDate,        setStartDate]        = useState(toStr(initialData?.start_date))
  const [endDate,          setEndDate]          = useState(toStr(initialData?.end_date))
  const [publishDate,      setPublishDate]      = useState(toStr(initialData?.publish_date))

  // Classification
  const [categories,       setCategories]       = useState(normalizeToOption(initialData?.categories,    CATEGORY_OPTIONS))
  const [trainingType,     setTrainingType]     = useState(normalizeToOption(initialData?.training_type, TRAINING_TYPE_OPTIONS))
  const [deliveryMode,     setDeliveryMode]     = useState(normalizeToOption(initialData?.delivery_mode, DELIVERY_MODE_OPTIONS))

  // Location & audience
  const [location,         setLocation]         = useState(toStr(initialData?.location))
  const [languages,        setLanguages]        = useState(toStr(initialData?.languages))
  const [targetAudience,   setTargetAudience]   = useState(normalizeToOption(initialData?.target_audience, TARGET_AUDIENCE_OPTIONS))
  const [level,            setLevel]            = useState(toStr(initialData?.level))

  // Cost & certification (booleans)
  const [cost,             setCost]             = useState<boolean | null>(initialData?.cost           ?? null)
  const [fundingSupport,   setFundingSupport]   = useState<boolean | null>(initialData?.funding_support ?? null)
  const [certificate,      setCertificate]      = useState<boolean | null>(initialData?.certificate     ?? null)
  const [termOfUse,        setTermOfUse]        = useState<boolean | null>(initialData?.term_of_use     ?? null)

  // Links & contact
  const [officialLink,     setOfficialLink]     = useState(toStr(initialData?.official_link))
  const [permalink,        setPermalink]        = useState(toStr(initialData?.permalink))
  const [contactPerson,    setContactPerson]    = useState(toStr(initialData?.contact_person))
  const [contactEmail,     setContactEmail]     = useState(toStr(initialData?.contact_email))

  // Description
  const [description,      setDescription]      = useState(toStr(initialData?.description))

  // Internal metadata
  const [academyId,        setAcademyId]        = useState(toStr(initialData?.academy_id))
  const [catalogueTags,    setCatalogueTags]    = useState(toStr(initialData?.catalogue_tags))
  const [isExternal,       setIsExternal]       = useState(initialData?.is_external ?? false)

  // Generic extra fields
  const [extraFields, setExtraFields] = useState<ExtraField[]>(
    Object.entries(initialData?.extra_fields ?? {}).map(([key, value]) => ({ key, value }))
  )

  const isOnDemand = status === 'On Demand'

  function addExtraField()  { setExtraFields(f => [...f, { key: '', value: '' }]) }
  function updateExtraField(i: number, part: Partial<ExtraField>) {
    setExtraFields(f => f.map((row, idx) => idx === i ? { ...row, ...part } : row))
  }
  function removeExtraField(i: number) { setExtraFields(f => f.filter((_, idx) => idx !== i)) }

  function handleSubmit() {
    if (!title.trim()) { setError('Title is required.'); return }
    setError(null)

    const data: Partial<AcademyEventInput> = {
      title:             title.trim(),
      status:            status            || null,
      lead_organizer:    leadOrganizer     || null,
      partner_organizer: partnerOrganizer  || null,
      start_date:        isOnDemand ? null : (startDate  || null),
      end_date:          isOnDemand ? null : (endDate    || null),
      publish_date:      publishDate       || null,
      categories:        categories        || null,
      training_type:     trainingType      || null,
      delivery_mode:     deliveryMode      || null,
      location:          location          || null,
      languages:         languages         || null,
      target_audience:   targetAudience    || null,
      level:             level             || null,
      cost,
      funding_support:   fundingSupport,
      certificate,
      term_of_use:       termOfUse,
      contact_person:    contactPerson     || null,
      official_link:     officialLink      || null,
      permalink:         permalink         || null,
      contact_email:     contactEmail      || null,
      description:       description       || null,
      academy_id:        academyId         || null,
      catalogue_tags:    catalogueTags     || null,
      is_external:       isExternal,
      extra_fields:      Object.fromEntries(
        extraFields.filter(f => f.key.trim()).map(f => [f.key.trim(), f.value])
      ),
    }

    startTransition(async () => {
      const result = await action(data)
      if (result && 'error' in result && result.error) setError(result.error)
    })
  }

  return (
    <div className="space-y-8 max-w-4xl">

      {/* 1 · Core */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Core</h2>
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
        </div>
      </section>

      {/* 2 · Organizers */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Organizers</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {field('Lead Organizer',    leadOrganizer,    setLeadOrganizer,    { placeholder: 'Primary organizing body' })}
          {field('Partner Organizer', partnerOrganizer, setPartnerOrganizer, { placeholder: 'Co-organizers' })}
        </div>
      </section>

      {/* 3 · Dates */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dates</h2>
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
          <p className="text-xs text-muted-foreground">On Demand events use Publish Date instead of start/end dates.</p>
        )}
      </section>

      {/* 4 · Classification */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Classification</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {selectField('Categories',    categories,   setCategories,   CATEGORY_OPTIONS)}
          {selectField('Training Type', trainingType, setTrainingType, TRAINING_TYPE_OPTIONS)}
          {selectField('Delivery Mode', deliveryMode, setDeliveryMode, DELIVERY_MODE_OPTIONS)}
        </div>
      </section>

      {/* 5 · Location & Audience */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Location & Audience</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {field('Location / Platform', location,       setLocation,       { placeholder: 'City, country or platform name' })}
          {field('Languages',           languages,      setLanguages,      { placeholder: 'e.g. English, French' })}
          {selectField('Target Audience', targetAudience, setTargetAudience, TARGET_AUDIENCE_OPTIONS)}
          {field('Level',               level,          setLevel,          { placeholder: 'e.g. Basic, Intermediate, Advanced' })}
        </div>
      </section>

      {/* 6 · Cost & Certification */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cost & Certification</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {boolSelect('Has Cost / Fee',           cost,          setCost,          { trueLabel: 'Yes — has a fee', falseLabel: 'Free' })}
          {boolSelect('Funding Support Available', fundingSupport, setFundingSupport)}
          {boolSelect('Certificate of Completion', certificate,   setCertificate)}
          {boolSelect('Term of Use Agreed',        termOfUse,     setTermOfUse)}
        </div>
      </section>

      {/* 7 · Links & Contact */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Links & Contact</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {field('Official Link',    officialLink,  setOfficialLink,  { type: 'url',   placeholder: 'https://' })}
          {field('Application Link', permalink,     setPermalink,     { type: 'url',   placeholder: 'https://' })}
          {field('Contact Person',   contactPerson, setContactPerson, { placeholder: 'Full name or organization' })}
          {field('Contact Email',    contactEmail,  setContactEmail,  { type: 'email', placeholder: 'contact@example.com' })}
        </div>
      </section>

      {/* 8 · Description */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</h2>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Content</Label>
          <RichTextEditor
            value={description}
            onChange={setDescription}
            placeholder="Short overview of the event (200–400 words recommended)."
          />
        </div>
      </section>

      {/* 9 · Internal Metadata */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Internal Metadata</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {field('Academy ID',     academyId,     setAcademyId,     { placeholder: 'Unique ID from Academy catalogue' })}
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

      {/* 10 · Extra Fields */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Extra Fields</h2>
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
