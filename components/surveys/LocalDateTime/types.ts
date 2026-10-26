export interface LocalDateTimeProps {
  iso:       string | null
  dateOnly?: boolean   // '13 Oct' instead of '13 Oct, 16:00'
  withYear?: boolean
  fallback?: string    // shown when iso is null
}
