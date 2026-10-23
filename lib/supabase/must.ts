// Unwraps a Supabase result and throws on error, so a failed query reaches the route's
// error boundary (or the action's caller) instead of rendering as "no data".
// For a result with a count, unwrap the data with must() and read .count off the result.
interface QueryResult<T> {
  data:  T
  error: { message: string } | null
}

export function must<T>(label: string, result: QueryResult<T>): T {
  if (result.error) throw new Error(`${label} failed: ${result.error.message}`)
  return result.data
}
