import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Unit tests for pure logic only (no database, no React rendering): lib/ helpers and the
// scrapers' shared date parsing. Run with `npm test`.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    include: ['lib/**/*.test.ts', 'supabase/functions/**/*.test.ts'],
    environment: 'node',
  },
})
