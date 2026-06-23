# Supabase Edge Functions — Scraper Guide

These run on **Deno**, not Node.js. Import syntax is different from regular TypeScript.

## Runtime Differences from Node.js

```typescript
// CDN import (Deno style)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// npm package
import { parse } from 'npm:node-html-parser'

// Local file (must include .ts extension)
import { parseDateRange } from '../_shared/utils.ts'
```

No `package.json` for edge functions. Dependencies are imported directly by URL or npm: prefix.

## Anatomy of a Scraper

Every scraper (`scrape-*/index.ts`) follows the same structure. Use `scrape-gewex/index.ts` as the canonical template.

```
1. Constants       IPO_ID, BASE url, LIST path
2. parseEvents()   Pure function: HTML string → ScrapedEvent[]
3. scrapeSection() Paginates through the listing, calls parseEvents() per page
4. Deno.serve()    Entry point — handles dry_run vs real run
```

### Entry point logic

```typescript
Deno.serve(async (req) => {
  const body = await req.json().catch(() => ({}))

  // Preview mode — returns NDJSON stream, no DB writes
  if (body.dry_run) return dryRunStream(supabase, IPO_ID, listUrl, parseEvents, 'optional note')

  // Real run
  const runId = await startRun(supabase, IPO_ID, body.runId, body.source)
  try {
    // Freshness check — skip if top event is already in DB (unless forced)
    if (!body.force) {
      const peek = await peekFirstTitle(listUrl, parseEvents)
      if (peek && await isFreshScrape(supabase, IPO_ID, peek)) {
        await recordSkippedRun(supabase, runId, startedAt)
        return Response.json({ skipped: true })
      }
    }
    const events = await scrapeAllPages()
    const { inserted, updated, errors } = await upsertEvents(supabase, events)
    await finishRun(supabase, runId, { status: errors.length ? 'partial' : 'success', ... })
  } catch (err) {
    await finishRun(supabase, runId, { status: 'failed', ... })
  }
})
```

## Shared Utilities (`_shared/utils.ts`)

All helpers — import from here, never duplicate.

| Function | Signature | Notes |
|---|---|---|
| `parseDateRange(str)` | `→ { start, end }` | Pass the date substring only — uses `^`-anchored regex, fails on full text blocks |
| `parseDate(str)` | `→ string \| null` | Single date → ISO `YYYY-MM-DD` |
| `computeStatus(start, end?)` | `→ 'Upcoming' \| 'Ongoing' \| 'Past'` | Compares against today |
| `fetchWithRetry(url)` | `→ Response` | 3 retries, exponential backoff, rate-limit handling |
| `upsertEvents(supabase, events)` | `→ { inserted, updated, skippedInvalid, errors }` | Validates each event, batches 100 at a time, upserts on `ipo_id+start_date+title` |
| `startRun(supabase, ipoId, runId?, source?)` | `→ runId string` | Creates or updates a `scrape_runs` row |
| `finishRun(supabase, runId, result, ipoId?)` | `→ void` | Marks run complete; if 0 events found but DB has events, auto-marks as failed |
| `dryRunStream(supabase, ipoId, url, parser, note?)` | `→ Response` | NDJSON stream for the preview dialog — scrapes page 1 only, no DB writes |
| `peekFirstTitle(url, parser)` | `→ string \| null` | Gets title of first event on page 1 |
| `isFreshScrape(supabase, ipoId, title)` | `→ boolean` | True if that title is already in the DB — safe to skip |
| `recordSkippedRun(supabase, runId, startedAt)` | `→ void` | Marks a run as `skipped` |

### Critical: `parseDateRange` must receive a substring

```typescript
// WRONG — full text fails the ^-anchored regex
const { start } = parseDateRange(element.text)

// CORRECT — extract the date chunk first
const dateChunk = element.text.match(/\d{1,2}[\s–-]+\d{1,2}\s+\w+\s+\d{4}/)?.[0]
if (dateChunk) {
  const { start, end } = parseDateRange(dateChunk)
}
```

### `ScrapedEvent` shape (`_shared/types.ts`)

```typescript
{
  ipo_id:     string          // required — must match ipos table
  title:      string          // required
  start_date: string          // required — YYYY-MM-DD
  end_date?:  string | null
  location?:  string | null
  country?:   string | null
  url?:       string | null
  status:     'Upcoming' | 'Ongoing' | 'Past'  // required — use computeStatus()
  source?:    string          // domain name of the scraped site
  source_url?: string | null  // the specific page URL scraped
}
```

## Deploying

Git push does NOT deploy edge functions. You must run the CLI command after pushing.

```bash
# Deploy a single function
supabase functions deploy scrape-gewex

# Deploy multiple
supabase functions deploy scrape-rifs scrape-esmo scrape-gewex scrape-cordex

# Deploy the Academy sync
supabase functions deploy sync-academy-wp
```

## How to Add a New Scraper

1. **Create `supabase/functions/scrape-newipo/index.ts`** — copy `scrape-gewex/index.ts` as template.

2. **Set constants:**
   ```typescript
   const IPO_ID = 'newipo'       // must match the ipos table id
   const BASE   = 'https://...'
   const LIST   = '/events/'
   ```

3. **Write `parseEvents(html, sourceUrl)`** — inspect the site's HTML, write selectors. Return `ScrapedEvent[]`. Always call `computeStatus(start, end)` for the status field.

4. **Add to `FUNCTION_MAP`** in `app/dashboard/academy/health/actions.ts`:
   ```typescript
   newipo: 'scrape-newipo',
   ```

5. **Insert the IPO row** in Supabase (SQL or dashboard):
   ```sql
   INSERT INTO ipos (id, name) VALUES ('newipo', 'New IPO Name');
   ```

6. **Deploy:** `supabase functions deploy scrape-newipo`

7. **Test with Preview** — use the dry-run button on the Health page before running for real.

## Debugging a Broken Scraper

When a scraper marks a run as `failed` with "Scraper returned 0 events but this IPO has existing events":

1. Visit the IPO's events page in a browser — inspect the HTML
2. Compare the element selectors in `parseEvents()` against what you see
3. The site probably changed its HTML structure — update the selectors
4. Re-deploy: `supabase functions deploy scrape-xyz`
5. Force re-run on the Health page (bypass freshness check)

Common failure patterns:
- Event plugin changed (e.g., Tribe Events → plain HTML list)
- Date format changed (e.g., "Sept" instead of "Sep" — add alias to MONTHS in `_shared/utils.ts`)
- Site now requires JS rendering (edge functions cannot execute JS — the parser gets an empty shell)
