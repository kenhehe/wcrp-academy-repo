import PageInfo from '@/components/base/PageInfo'
import { cn } from '@/lib/utils'
import type { PageHeaderProps } from './types'

export default function PageHeader({ title, info, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {info && <PageInfo>{info}</PageInfo>}
        </div>
        {description && (
          <div className="text-sm text-muted-foreground">{description}</div>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  )
}
