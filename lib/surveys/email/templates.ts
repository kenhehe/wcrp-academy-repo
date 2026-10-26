// Pure: the five survey emails as subject + HTML + plain text. The header and footer copy
// the WCRP Academy newsletter (dark band, logo, website, why you got this); the body is the
// survey's own (docs/surveys/PLAN.md section 9). Email apps ignore CSS variables and <style>
// support is patchy, so colours are fixed values in inline styles: the one place in the repo
// with hex colours on purpose. Swap them here when the newsletter's exact values are known.
import type { EmailKind } from '@/lib/data/surveys.types'

const C = {
  page:    '#EBECEE',
  navy:    '#1F2B3C',
  text:    '#232C3D',
  muted:   '#4E6B85',
  border:  '#D0E8F5',
  hair:    '#E6F2FA',
  primary: '#1C68A5',
  accent:  '#EAF5FC',
  panel:   '#F5F9FC',
  okText:  '#17663A',
  okBg:    '#E6F6EC',
  white:   '#FFFFFF',
}
const FONT = 'Arial,Helvetica,sans-serif'

export interface EmailContent {
  kind:         EmailKind
  surveyTitle:  string
  link:         string          // the person's own link (with ?t=)
  opensAt:      string | null   // the window of the survey the button opens
  closesAt:     string | null
  stopUrl:      string | null   // "Stop reminders for this survey"
  logoUrl?:     string | null
}

export interface RenderedEmail {
  subject:   string
  preheader: string
  html:      string
  text:      string
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// UTC first, then Manila, the way the newsletter writes times: '27 Oct 2026, 15:59 UTC (23:59 PHT / UTC+8)'
export function formatEmailTime(iso: string): string {
  const d = new Date(iso)
  const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d)
  const time = (timeZone: string) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(d)
  return `${day}, ${time('UTC')} UTC (${time('Asia/Manila')} PHT / UTC+8)`
}

interface Copy {
  subject:   string
  preheader: string
  heading:   string
  lead:      string
  button:    string
  step:      1 | 2
  step1Done: boolean
  facts:     [string, string][]
  why:       string
}

function copyFor(c: EmailContent): Copy {
  const t = c.surveyTitle
  const closes = c.closesAt ? formatEmailTime(c.closesAt) : 'see the survey page'
  const time: [string, string] = ['Time needed', 'About 2 minutes, on your phone or computer']
  const privacy: [string, string] = ['Privacy', 'Answers are analysed anonymously']
  const registered = `You received this email because you registered for ${t}.`
  switch (c.kind) {
    case 'invite_pre': return {
      subject: `Before ${t}: a 2-minute survey`, preheader: 'Tell us where you\'re starting from. It takes about 2 minutes.',
      heading: 'Where are you starting from?',
      lead: 'Thank you for registering. We ask a few short questions before the event and the same ones after, to see what it changed for you.',
      button: 'Start the before-survey', step: 1, step1Done: false, facts: [time, ['Closes', `${closes}, when the event starts`], privacy], why: registered,
    }
    case 'reminder_pre': return {
      subject: `Reminder: your before-survey for ${t} closes soon`, preheader: 'There\'s still time to answer before the event starts.',
      heading: 'Your before-survey closes soon',
      lead: 'We haven\'t received your answers yet. Please answer before the event starts, so we can see what you take away from it.',
      button: 'Answer the before-survey', step: 1, step1Done: false, facts: [time, ['Closes', closes], privacy], why: registered,
    }
    case 'confirmation': return {
      subject: 'Thanks! Keep this email for your after-survey link', preheader: 'Your personal link for the after-survey is inside.',
      heading: 'Thank you! Please keep this email',
      lead: 'Your before-survey answers are saved. When the event ends, the button below opens your after-survey, and your answers are matched without typing anything.',
      button: 'My after-survey link', step: 2, step1Done: true,
      facts: [['Opens', c.opensAt ? `${formatEmailTime(c.opensAt)}, when the event ends` : 'when the event ends'], ['Closes', closes], time],
      why: 'You received this email because you answered the before-survey with this address.',
    }
    case 'invite_post': return {
      subject: `How did ${t} go? 2-minute survey`, preheader: 'Tell us what you took away. It takes about 2 minutes.',
      heading: 'How did it go?',
      lead: 'Thank you for joining. Please tell us what you took away; we compare your answers with the before-survey to see the event\'s impact.',
      button: 'Start the after-survey', step: 2, step1Done: false, facts: [time, ['Closes', closes], privacy], why: registered,
    }
    case 'reminder_post': return {
      subject: `Reminder: tell us how ${t} went`, preheader: 'Your after-survey is still open. It takes about 2 minutes.',
      heading: 'Your after-survey is still open',
      lead: 'You answered before the event; one more short survey and we can see what it changed for you.',
      button: 'Answer the after-survey', step: 2, step1Done: true, facts: [time, ['Closes', closes], privacy], why: registered,
    }
  }
}

function logo(logoUrl: string | null | undefined): string {
  return logoUrl
    ? `<img src="${esc(logoUrl)}" alt="WCRP Academy" width="140" style="display:block;border:0;width:140px;height:auto;margin:0 auto">`
    : `<span style="font-family:${FONT};font-size:18px;line-height:1.1;color:${C.white}"><b>WCRP</b> Academy</span>`
}

function stepCell(n: string, label: string, state: 'on' | 'done' | 'off'): string {
  const bg = state === 'on' ? C.accent : C.white
  const dotBg = state === 'on' ? C.primary : state === 'done' ? C.okBg : C.white
  const dotFg = state === 'on' ? C.white : state === 'done' ? C.okText : C.muted
  const dotBorder = state === 'off' ? `1.5px solid ${C.border}` : `1.5px solid ${dotBg}`
  return `<td width="50%" style="padding:12px 14px;background:${bg};font-family:${FONT};font-size:14px;color:${state === 'off' ? C.muted : C.text};${state === 'on' ? 'font-weight:bold;' : ''}">`
    + `<span style="display:inline-block;width:22px;height:22px;line-height:22px;border-radius:11px;border:${dotBorder};background:${dotBg};color:${dotFg};text-align:center;font-size:12px;font-weight:bold;margin-right:8px">${n}</span>${label}</td>`
}

export function renderSurveyEmail(c: EmailContent): RenderedEmail {
  const k = copyFor(c)
  const title = esc(c.surveyTitle)
  const step1 = stepCell(k.step1Done ? '&#10003;' : '1', 'Before the event', k.step === 1 ? 'on' : k.step1Done ? 'done' : 'off')
  const step2 = stepCell('2', 'After the event', k.step === 2 ? 'on' : 'off')
  const facts = k.facts.map(([label, value], i) =>
    `<tr><td style="padding:10px 0;${i ? `border-top:1px solid ${C.hair};` : ''}width:110px;font-family:${FONT};font-size:14px;color:${C.muted};vertical-align:top">${esc(label)}</td>`
    + `<td style="padding:10px 0;${i ? `border-top:1px solid ${C.hair};` : ''}font-family:${FONT};font-size:14px;line-height:1.5;color:${C.text}">${esc(value)}</td></tr>`).join('')
  const link = esc(c.link)

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${esc(k.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(k.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${C.white};border-radius:4px;overflow:hidden">
<tr><td align="center" style="background:${C.navy};padding:36px 24px">${logo(c.logoUrl)}</td></tr>
<tr><td style="padding:36px 40px 32px">
<p style="margin:0 0 6px;font-family:${FONT};font-size:13px;color:${C.muted}">${title}</p>
<h1 style="margin:0 0 18px;font-family:${FONT};font-size:26px;line-height:1.25;color:${C.text}">${esc(k.heading)}</h1>
<p style="margin:0 0 20px;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.text}">${esc(k.lead)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:8px;border-collapse:separate;margin:0 0 18px"><tr>${step1}${step2}</tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.panel};border-radius:8px;margin:0 0 22px"><tr><td style="padding:4px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${facts}</table></td></tr></table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px"><tr><td style="border-radius:8px;background:${C.primary}"><a href="${link}" style="display:inline-block;padding:14px 24px;font-family:${FONT};font-size:15px;font-weight:bold;color:${C.white};text-decoration:none;border-radius:8px">${esc(k.button)}</a></td></tr></table>
<p style="margin:0 0 18px;font-family:${FONT};font-size:12.5px;line-height:1.55;color:${C.muted}">Button not working? Copy this link into your browser:<br><a href="${link}" style="color:${C.primary};word-break:break-all">${link}</a><br>It&#39;s personal to you, so please don&#39;t forward it.</p>
<p style="margin:0 0 6px;padding-top:16px;border-top:1px solid ${C.hair};font-family:${FONT};font-size:15px;line-height:1.6;color:${C.text}">Thank you,<br>The WCRP Academy team</p>
<p style="margin:0;font-family:${FONT};font-size:12.5px;line-height:1.55;color:${C.muted}">Your email is only used to send you survey links and is deleted 24 months after the event.</p>
</td></tr>
<tr><td align="center" style="background:${C.navy};padding:30px 32px;font-family:${FONT};font-size:12px;line-height:1.7;color:${C.white}">
${logo(c.logoUrl)}<br>
<b style="font-size:13px">WCRP Academy</b><br>
<a href="https://wcrp-academy.org/" style="color:${C.white}">https://wcrp-academy.org/</a><br>
${esc(k.why)}${c.stopUrl ? `<br><a href="${esc(c.stopUrl)}" style="color:${C.white}">Stop reminders for this survey</a>` : ''}
</td></tr>
</table>
</td></tr></table>
</body></html>`

  const text = [
    c.surveyTitle,
    '',
    k.heading,
    '',
    k.lead,
    '',
    ...k.facts.map(([label, value]) => `${label}: ${value}`),
    '',
    `${k.button}: ${c.link}`,
    'This link is personal to you, so please don\'t forward it.',
    '',
    'Thank you,',
    'The WCRP Academy team',
    '',
    'Your email is only used to send you survey links and is deleted 24 months after the event.',
    k.why,
    ...(c.stopUrl ? [`Stop reminders for this survey: ${c.stopUrl}`] : []),
    'WCRP Academy · https://wcrp-academy.org/',
  ].join('\n')

  return { subject: k.subject, preheader: k.preheader, html, text }
}
