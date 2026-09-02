import { Share2, Globe, Mail } from 'lucide-react'

interface Props {
  wants_social_media:    boolean
  wants_website_article: boolean
  wants_newsletter:      boolean
}

export default function PublicationFlags({ wants_social_media, wants_website_article, wants_newsletter }: Props) {
  const flags = [
    wants_social_media    && { icon: Share2, label: 'Wants social media' },
    wants_website_article && { icon: Globe,  label: 'Wants website article' },
    wants_newsletter      && { icon: Mail,   label: 'Wants newsletter' },
  ].filter((f): f is { icon: typeof Share2; label: string } => Boolean(f))

  if (flags.length === 0) return null

  return (
    <div className="flex items-center gap-1">
      {flags.map(({ icon: Icon, label }) => (
        <span key={label} title={label}>
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </span>
      ))}
    </div>
  )
}
