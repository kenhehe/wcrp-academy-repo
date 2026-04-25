import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { STATUS_OPTIONS } from './types'
import type { EventRow, RegistryField } from './types'

interface EventFormProps {
  event?: EventRow
  registryFields: RegistryField[]
}

export default function EventForm({ event, registryFields }: EventFormProps) {
  return (
    <div className="space-y-4">
      {event && <input type="hidden" name="event_id" value={event.id} />}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-2">
          <Label htmlFor="f-title">Title <span className="text-destructive">*</span></Label>
          <Input
            id="f-title"
            name="title"
            required
            defaultValue={event?.title}
            placeholder="Event title"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="f-start">Start date <span className="text-destructive">*</span></Label>
          <Input
            id="f-start"
            name="start_date"
            type="date"
            required
            defaultValue={event?.start_date}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="f-end">End date</Label>
          <Input
            id="f-end"
            name="end_date"
            type="date"
            defaultValue={event?.end_date ?? undefined}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="f-status">Status <span className="text-destructive">*</span></Label>
          <Select name="status" defaultValue={event?.status ?? 'Upcoming'} required>
            <SelectTrigger id="f-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="f-country">Country</Label>
          <Input
            id="f-country"
            name="country"
            defaultValue={event?.country ?? undefined}
            placeholder="e.g. France"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="f-location">Location</Label>
          <Input
            id="f-location"
            name="location"
            defaultValue={event?.location ?? undefined}
            placeholder="City or venue"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="f-url">URL</Label>
          <Input
            id="f-url"
            name="url"
            type="url"
            defaultValue={event?.url ?? undefined}
            placeholder="https://…"
          />
        </div>
      </div>

      {/* Dynamic extra fields from ipo_field_registry */}
      {registryFields.length > 0 && (
        <>
          <Separator />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Additional fields
          </p>
          <div className="grid grid-cols-2 gap-4">
            {registryFields.map(field => {
              const currentVal = event?.extra_fields?.[field.field_key] ?? undefined
              const label = field.label ?? field.field_key.replace(/_/g, ' ')

              return (
                <div key={field.field_key} className="space-y-2">
                  <Label htmlFor={`ef-${field.field_key}`}>{label}</Label>
                  {field.values && field.values.length > 0 ? (
                    <Select name={`ef__${field.field_key}`} defaultValue={currentVal}>
                      <SelectTrigger id={`ef-${field.field_key}`}>
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent>
                        {field.values.map(v => (
                          <SelectItem key={v} value={v}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={`ef-${field.field_key}`}
                      name={`ef__${field.field_key}`}
                      defaultValue={currentVal}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
