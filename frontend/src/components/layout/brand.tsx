import { cn } from '@/lib/utils';

/**
 * Marca provisória da Locamania (o logo oficial ainda não chegou). Trocar o
 * logo = trocar este componente e `app/icon.svg`.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden className={cn('size-8 shrink-0', className)}>
      <rect width="512" height="512" rx="112" className="fill-brand" />
      <path d="M168 128h64v196h124v60H168z" fill="#ffffff" />
      <circle cx="356" cy="164" r="36" className="fill-brand-accent" />
    </svg>
  );
}

export function Brand({ className, subtitle }: { className?: string; subtitle?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <BrandMark />
      <span className="flex flex-col leading-none">
        <span className="text-lg font-bold tracking-tight">Locamania</span>
        {subtitle && <span className="mt-0.5 text-[11px] font-medium text-muted-foreground">{subtitle}</span>}
      </span>
    </span>
  );
}
