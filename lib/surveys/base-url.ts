// Server only. The site address used in survey links, QR codes and emails.
// SURVEYS_BASE_URL pins it (set it to the production URL on Vercel, so a QR code made on a
// preview deployment still points at production); otherwise the current request's host.
import { headers } from 'next/headers'

export async function surveysBaseUrl(): Promise<string> {
  const configured = process.env.SURVEYS_BASE_URL
  if (configured) return configured.replace(/\/+$/, '')
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  if (!host) throw new Error('Cannot tell the site address for survey links: set SURVEYS_BASE_URL')
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https')
  return `${proto}://${host}`
}

export function surveyLink(baseUrl: string, slug: string, stage: 'pre' | 'post', token?: string): string {
  return `${baseUrl}/s/${slug}/${stage}${token ? `?t=${token}` : ''}`
}
