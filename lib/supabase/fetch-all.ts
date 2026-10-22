// PostgREST caps every response at 1000 rows and truncates silently, so any read that can
// return more must page through. `page` builds the query for one range; give it a stable
// order that ends in a unique column (e.g. .order('start_date').order('id')).
const PAGE_SIZE = 1000

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

export async function fetchAllRows<T>(label: string, page: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`${label} failed: ${error.message}`)
    rows.push(...(data ?? []))
    if ((data ?? []).length < PAGE_SIZE) return rows
  }
}
