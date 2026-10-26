// Server only. Survey email settings, all from env vars (.env.local and Vercel):
//   SURVEYS_SMTP_HOST, SURVEYS_SMTP_PORT (587 STARTTLS or 465 TLS), SURVEYS_SMTP_USER, SURVEYS_SMTP_PASS
//   SURVEYS_EMAIL_FROM        'WCRP Academy <surveys@wcrp-academy.org>' (a mailbox of its own: its own daily quota)
//   SURVEYS_EMAIL_REPLY_TO    where replies go, e.g. office@wcrp-academy.org
//   SURVEYS_EMAIL_DAILY_LIMIT what the mailbox may send per rolling 24 h (Infomaniak: 200 or 500); default 180
//   SURVEYS_EMAIL_LOGO_URL    optional: the logo image for the dark header band
export interface EmailConfig {
  host:       string
  port:       number
  user:       string
  pass:       string
  from:       string
  replyTo:    string | null
  dailyLimit: number
  logoUrl:    string | null
}

// null until the SMTP settings are in place: the Send tab says so instead of failing
export function emailConfig(): EmailConfig | null {
  const { SURVEYS_SMTP_HOST: host, SURVEYS_SMTP_USER: user, SURVEYS_SMTP_PASS: pass, SURVEYS_EMAIL_FROM: from } = process.env
  if (!host || !user || !pass || !from) return null
  const port = Number(process.env.SURVEYS_SMTP_PORT ?? 587)
  const dailyLimit = Number(process.env.SURVEYS_EMAIL_DAILY_LIMIT ?? 180)
  if (!Number.isInteger(port) || port <= 0) throw new Error('SURVEYS_SMTP_PORT must be a port number (587 or 465)')
  if (!Number.isInteger(dailyLimit) || dailyLimit <= 0) throw new Error('SURVEYS_EMAIL_DAILY_LIMIT must be a whole number above 0')
  return {
    host, port, user, pass, from, dailyLimit,
    replyTo: process.env.SURVEYS_EMAIL_REPLY_TO || null,
    logoUrl: process.env.SURVEYS_EMAIL_LOGO_URL || null,
  }
}

export const EMAIL_NOT_SET_UP = 'Email sending isn\'t set up yet (SURVEYS_SMTP_* and SURVEYS_EMAIL_FROM env vars)'
