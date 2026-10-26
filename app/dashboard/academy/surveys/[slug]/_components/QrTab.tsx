import QRCode from 'qrcode'
import { AlertTriangle, Download } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import LocalDateTime from '@/components/surveys/LocalDateTime'
import type { SurveyEventRow } from '@/lib/data/surveys.types'
import { surveyLink, surveysBaseUrl } from '@/lib/surveys/base-url'
import CopyLinkButton from './CopyLinkButton'

// QR codes tab: one code per stage, without a token (people who scan type their email once;
// the phone is remembered for the after-survey). Codes are always black on white, whatever
// the theme, so every phone camera reads them; PNG at print size, SVG for any size.
export default async function QrTab({ survey }: { survey: SurveyEventRow }) {
  const base = await surveysBaseUrl()
  const pinned = Boolean(process.env.SURVEYS_BASE_URL)
  const codes = await Promise.all((['pre', 'post'] as const).map(async stage => {
    const url = surveyLink(base, survey.slug, stage)
    const options = { margin: 4, errorCorrectionLevel: 'M' as const }
    const [svg, png] = await Promise.all([
      QRCode.toString(url, { ...options, type: 'svg' }),
      QRCode.toDataURL(url, { ...options, width: 1200 }),
    ])
    return {
      stage, url, png,
      svg: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      opens: stage === 'pre' ? survey.pre_opens_at : survey.post_opens_at,
      closes: stage === 'pre' ? survey.pre_closes_at : survey.post_closes_at,
    }
  }))

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Download a code and send it to the presenter for their slides, or print it. People who scan it type their
        email once; the same phone is remembered for the after-survey.
      </p>
      {survey.status === 'draft' && (
        <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          This survey is a draft: the codes work once you open it.
        </p>
      )}
      {!pinned && (
        <p className="flex items-start gap-2 rounded-lg bg-info-soft px-3 py-2.5 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
          These codes point to {base}. Set SURVEYS_BASE_URL to the production address so codes always point there,
          wherever they&apos;re made.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        {codes.map(c => (
          <Card key={c.stage}>
            <CardHeader>
              <CardTitle>{c.stage === 'pre' ? 'Before-survey' : 'After-survey'} QR code</CardTitle>
              <CardDescription>
                Open <LocalDateTime iso={c.opens} /> to <LocalDateTime iso={c.closes} withYear />, your time.
                {c.stage === 'post' && ' Before it opens, the code shows a "not open yet" page.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-start gap-5">
              {/* eslint-disable-next-line @next/next/no-img-element -- a generated data URL, nothing to optimise */}
              <img src={c.svg} alt={`QR code for the ${c.stage === 'pre' ? 'before' : 'after'}-survey`} width={176} height={176} className="rounded-lg border" />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <span className="font-mono text-[13px] break-all">{c.url}</span>
                <div className="flex flex-wrap gap-2">
                  <a href={c.png} download={`${survey.slug}-${c.stage}-qr.png`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    <Download data-icon="inline-start" aria-hidden="true" />
                    PNG
                  </a>
                  <a href={c.svg} download={`${survey.slug}-${c.stage}-qr.svg`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    <Download data-icon="inline-start" aria-hidden="true" />
                    SVG
                  </a>
                  <CopyLinkButton url={c.url} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
