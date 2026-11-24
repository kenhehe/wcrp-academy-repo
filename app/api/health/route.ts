// Polled by the router (wcrpacademy/wcrp-academy-host) during a blue/green deploy and on every
// restart, with Host: dashboard.wcrp-academy.org (host.config.json's hosts[0] for this app) — see
// docs/hosting-plan.md "Blue/green per app". No auth, no DB call: it only needs to prove the
// Next.js server itself came up, fast and without depending on anything that can fail on its own.
export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json({ ok: true })
}
