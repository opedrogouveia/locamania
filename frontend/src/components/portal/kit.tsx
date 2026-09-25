'use client';

/**
 * Peças do app do cliente (§15–§17). Mais simples e maiores que as do painel:
 * o locatário usa o celular na rua, com pressa — títulos grandes, números
 * grandes, um botão óbvio por cartão.
 */
import { formatPlate } from '@locamania/shared';
import { AlertTriangle, ChevronRight, LifeBuoy, RotateCw, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api/client';
import { cn } from '@/lib/utils';

export type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

/** Fundo suave + texto na cor do tom (bolhas de ícone, pílulas). */
export const TONE_SOFT: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-destructive/12 text-destructive',
  info: 'bg-info/12 text-info',
  muted: 'bg-muted text-muted-foreground',
};

export const TONE_TEXT: Record<Tone, string> = {
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
  info: 'text-info',
  muted: 'text-muted-foreground',
};

// ───────────────────────────── Título da tela ─────────────────────────────

export function PortalTitle({ title, subtitle, actions, className }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="text-[15px] text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

// ───────────────────────────── Cartão ─────────────────────────────

export function Panel({ children, className, as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' }) {
  return <As className={cn('rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5', className)}>{children}</As>;
}

/** Cabeçalho do cartão: ícone + título + ação à direita ("Ver todos"). */
export function PanelHeader({ icon: Icon, title, tone = 'primary', action, className }: { icon?: LucideIcon; title: ReactNode; tone?: Tone; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 flex items-center gap-2.5', className)}>
      {Icon && <ToneIcon icon={Icon} tone={tone} size="sm" />}
      <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold">{title}</h2>
      {action}
    </div>
  );
}

/** Link discreto no canto do cartão ("Ver todos ›"). */
export function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="-my-2 -mr-2 inline-flex min-h-10 shrink-0 items-center gap-0.5 rounded-lg px-2 text-sm font-medium text-primary hover:bg-primary/10">
      {children}
      <ChevronRight className="size-4" aria-hidden />
    </Link>
  );
}

export function ToneIcon({ icon: Icon, tone = 'primary', size = 'md', className }: { icon: LucideIcon; tone?: Tone; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-xl',
        size === 'sm' && 'size-8 rounded-lg',
        size === 'md' && 'size-10',
        size === 'lg' && 'size-14 rounded-2xl',
        TONE_SOFT[tone],
        className,
      )}
    >
      <Icon className={cn(size === 'sm' ? 'size-4' : size === 'md' ? 'size-5' : 'size-7')} aria-hidden />
    </span>
  );
}

// ───────────────────────────── Linhas ─────────────────────────────

/** Linha tocável (≥ 56 px): ícone, título, apoio e algo à direita. */
export function RowLink({
  href,
  onClick,
  icon,
  tone = 'primary',
  title,
  subtitle,
  right,
  chevron = true,
  className,
}: {
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  tone?: Tone;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  chevron?: boolean;
  className?: string;
}) {
  const body = (
    <>
      {icon && <ToneIcon icon={icon} tone={tone} />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{title}</span>
        {subtitle && <span className="block truncate text-sm text-muted-foreground">{subtitle}</span>}
      </span>
      {right && <span className="flex shrink-0 flex-col items-end gap-1 text-right">{right}</span>}
      {chevron && (href || onClick) && <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />}
    </>
  );
  const cls = cn('flex min-h-14 w-full items-center gap-3 py-2.5 text-left', (href || onClick) && 'transition-colors hover:bg-accent/40', className);
  if (href) {
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}

/** Lista com divisórias que encosta nas bordas do cartão (as linhas "respiram" até a borda). */
export function RowList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('-mx-4 divide-y divide-border sm:-mx-5 [&>*]:px-4 sm:[&>*]:px-5', className)}>{children}</div>;
}

// ───────────────────────────── Pequenos ─────────────────────────────

/** Placa no jeito da placa (fonte mono, borda). */
export function Plate({ plate, className }: { plate: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md border-2 border-foreground/70 bg-card px-2 py-0.5 font-mono text-sm font-bold tracking-widest', className)}>
      {formatPlate(plate)}
    </span>
  );
}

/** Pílula de situação com bolinha ("Aluguel em dia"). */
export function StatusPill({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold', TONE_SOFT[tone], className)}>
      <span className="size-2 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

/** Rótulo pequeno + valor grande (km, valor do aluguel). */
export function Metric({ label, value, hint, className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-lg font-semibold tabular tracking-tight">{value}</p>
      {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Faixa de aviso dentro de um cartão ou da tela. */
export function Notice({ tone = 'info', icon: Icon, title, children, action, className }: { tone?: Tone; icon?: LucideIcon; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  const border: Record<Tone, string> = {
    primary: 'border-primary/30 bg-primary/5',
    success: 'border-success/30 bg-success/8',
    warning: 'border-warning/40 bg-warning/10',
    danger: 'border-destructive/30 bg-destructive/8',
    info: 'border-info/30 bg-info/8',
    muted: 'border-border bg-muted/60',
  };
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border p-3.5 text-sm', border[tone], className)}>
      {Icon && <Icon className={cn('mt-0.5 size-5 shrink-0', TONE_TEXT[tone])} aria-hidden />}
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-muted-foreground">{children}</div>}
        {action && <div className="pt-1.5">{action}</div>}
      </div>
    </div>
  );
}

// ───────────────────────────── Estados ─────────────────────────────

/** Esqueleto genérico de tela do app (título + cartões). */
export function PortalSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-44 w-full rounded-2xl" />
      {Array.from({ length: cards - 1 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-2xl" />
      ))}
    </div>
  );
}

/** Erro da API com "Tentar de novo" (sem internet cai aqui com a mensagem certa). */
export function PortalError({ error, onRetry, title = 'Não foi possível carregar' }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <Panel className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <ToneIcon icon={AlertTriangle} tone="danger" size="lg" />
      <div className="space-y-1">
        <p className="text-lg font-semibold">{title}</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{errorMessage(error)}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="lg" onClick={onRetry}>
          <RotateCw /> Tentar de novo
        </Button>
      )}
    </Panel>
  );
}

/** Vazio amigável (ícone grande, frase curta, uma ação). */
export function PortalEmpty({ icon, title, description, action, className }: { icon: LucideIcon; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <Panel className={cn('flex flex-col items-center gap-3 px-6 py-12 text-center', className)}>
      <ToneIcon icon={icon} tone="muted" size="lg" />
      <div className="space-y-1">
        <p className="text-lg font-semibold">{title}</p>
        {description && <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </Panel>
  );
}

/** "Fale com a Locamania" — atalho para o suporte nos vazios. */
export function SupportButton({ label = 'Falar com a Locamania', variant = 'outline' }: { label?: string; variant?: 'outline' | 'default' }) {
  return (
    <Button asChild variant={variant} size="lg">
      <Link href="/app/support">
        <LifeBuoy /> {label}
      </Link>
    </Button>
  );
}
