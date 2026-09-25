'use client';

import {
  Bell,
  Bike,
  ChevronDown,
  FileText,
  Home,
  LifeBuoy,
  LogOut,
  MoreHorizontal,
  UserRound,
  Wallet,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { PrivacyGate } from '@/components/customer/privacy-gate';
import { Brand } from '@/components/layout/brand';
import { useUnreadCount } from '@/components/layout/notification-bell';
import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAreaGuard, useCustomerActor, useLogout } from '@/lib/auth/use-auth';
import { cn, firstName } from '@/lib/utils';

interface Tab {
  label: string;
  short?: string;
  href: string;
  icon: LucideIcon;
}

/** Menu do cliente (§17). Os 4 primeiros vão na barra inferior do celular. */
const TABS: Tab[] = [
  { label: 'Início', href: '/app', icon: Home },
  { label: 'Pagamentos', href: '/app/payments', icon: Wallet },
  { label: 'Minha moto', short: 'Moto', href: '/app/motorcycle', icon: Bike },
  { label: 'Avisos', href: '/app/notifications', icon: Bell },
];

const MORE: Tab[] = [
  { label: 'Meu contrato', href: '/app/contract', icon: FileText },
  { label: 'Manutenção', href: '/app/maintenance', icon: Wrench },
  { label: 'Meu perfil', href: '/app/profile', icon: UserRound },
  { label: 'Suporte', href: '/app/support', icon: LifeBuoy },
];

/** Topo do computador: o essencial; Avisos vira sino e Perfil/Sair ficam no menu da pessoa. */
const DESKTOP: Tab[] = [
  TABS[0]!,
  TABS[1]!,
  TABS[2]!,
  { label: 'Contrato', href: '/app/contract', icon: FileText },
  { label: 'Manutenção', href: '/app/maintenance', icon: Wrench },
  { label: 'Suporte', href: '/app/support', icon: LifeBuoy },
];

function active(pathname: string, href: string) {
  return href === '/app' ? pathname === '/app' : pathname === href || pathname.startsWith(`${href}/`);
}

function UnreadDot({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'absolute min-w-[18px] rounded-full bg-destructive px-1 text-center text-[10px] font-bold leading-[18px] text-destructive-foreground ring-2 ring-card',
        className,
      )}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}

/**
 * Moldura do app do cliente: muito mais simples que o painel (§15). No
 * celular e no tablet, barra inferior com Início / Pagamentos / Moto / Avisos /
 * Mais (ao alcance do polegar); no computador, menu no topo, sino de avisos e
 * menu da pessoa, com o conteúdo numa coluna central larga (não esticada).
 */
export function CustomerShell({ children }: { children: ReactNode }) {
  const { ready } = useAreaGuard('customer');
  const customer = useCustomerActor();
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();
  const unread = useUnreadCount('customer').data?.unread ?? 0;
  // A folha "Mais" guarda em que tela foi aberta: mudou de tela, ela fecha sozinha.
  const [moreAt, setMoreAt] = useState<string | null>(null);
  const more = moreAt === pathname;
  const setMore = (open: boolean) => setMoreAt(open ? pathname : null);

  // A folha "Mais" fecha no "voltar"/Esc e não deixa a página rolar por baixo.
  useEffect(() => {
    if (!more) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMoreAt(null);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [more]);

  if (!ready || !customer) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
        <Spinner className="size-6" />
      </div>
    );
  }

  const moreActive = MORE.some((m) => active(pathname, m.href));

  return (
    <PrivacyGate>
      <div className="min-h-dvh bg-muted/40">
        <header className="sticky top-0 z-30 border-b border-border bg-card/90 pt-safe backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:px-6 lg:h-16">
            <Link href="/app" aria-label="Início" className="shrink-0 rounded-md">
              <Brand />
            </Link>

            {/* Computador: menu no topo */}
            <nav className="ml-4 hidden items-center gap-0.5 lg:flex" aria-label="Menu">
              {DESKTOP.map((t) => {
                const on = active(pathname, t.href);
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    aria-current={on ? 'page' : undefined}
                    className={cn(
                      'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      on ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {t.label}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-1">
              <Link
                href="/app/notifications"
                aria-label={unread ? `Avisos: ${unread} não lidos` : 'Avisos'}
                aria-current={active(pathname, '/app/notifications') ? 'page' : undefined}
                className={cn(
                  'relative hidden size-10 items-center justify-center rounded-lg transition-colors lg:inline-flex',
                  active(pathname, '/app/notifications') ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Bell className="size-5" />
                <UnreadDot count={unread} className="right-0.5 top-0.5" />
              </Link>
              <ThemeToggle />
              <div className="hidden lg:block">
                <DropdownMenu>
                  <DropdownMenuTrigger className="ml-1 flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 text-sm font-medium transition-colors hover:bg-accent">
                    <Avatar name={customer.name} className="size-8 text-xs" />
                    <span className="max-w-32 truncate">{firstName(customer.name)}</span>
                    <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-52">
                    <DropdownMenuLabel>{customer.name}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => router.push('/app/profile')}>
                      <UserRound /> Meu perfil
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => router.push('/app/notifications')}>
                      <Bell /> Avisos
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => logout.mutate()}>
                      <LogOut /> Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 sm:px-6 sm:pt-6 lg:pb-14 lg:pt-8">{children}</main>

        {/* Barra inferior (celular e tablet) */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-safe backdrop-blur lg:hidden" aria-label="Menu">
          <div className="mx-auto grid max-w-lg grid-cols-5">
            {TABS.map((t) => {
              const on = active(pathname, t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={on ? 'page' : undefined}
                  className={cn('relative flex min-h-[3.9rem] flex-col items-center justify-center gap-1 text-[11px] font-medium', on ? 'text-primary' : 'text-muted-foreground')}
                >
                  <span className={cn('relative flex h-7 w-12 items-center justify-center rounded-full transition-colors', on && 'bg-primary/12')}>
                    <t.icon className="size-5" aria-hidden />
                    {t.href === '/app/notifications' && <UnreadDot count={unread} className="-right-0.5 -top-1" />}
                  </span>
                  {t.short ?? t.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setMore(true)}
              aria-expanded={more}
              className={cn('flex min-h-[3.9rem] flex-col items-center justify-center gap-1 text-[11px] font-medium', moreActive ? 'text-primary' : 'text-muted-foreground')}
            >
              <span className={cn('flex h-7 w-12 items-center justify-center rounded-full transition-colors', moreActive && 'bg-primary/12')}>
                <MoreHorizontal className="size-5" aria-hidden />
              </span>
              Mais
            </button>
          </div>
        </nav>

        {/* Folha "Mais" */}
        {more && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Mais opções">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMore(false)} aria-hidden />
            <div className="animate-in absolute inset-x-0 bottom-0 rounded-t-3xl bg-card px-4 pb-safe pt-3 shadow-xl">
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border" aria-hidden />
              <div className="mb-4 flex items-center gap-3">
                <Avatar name={customer.name} className="size-11" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{customer.name}</p>
                  <p className="text-sm text-muted-foreground">Cliente Locamania</p>
                </div>
                <button type="button" onClick={() => setMore(false)} className="flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent" aria-label="Fechar">
                  <X className="size-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {MORE.map((m) => (
                  <Link
                    key={m.href}
                    href={m.href}
                    className={cn(
                      'flex min-h-16 items-center gap-3 rounded-2xl border p-4 text-[15px] font-medium transition-colors hover:bg-accent',
                      active(pathname, m.href) ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border',
                    )}
                  >
                    <m.icon className="size-5 shrink-0 text-primary" aria-hidden />
                    {m.label}
                  </Link>
                ))}
              </div>
              <button
                type="button"
                onClick={() => logout.mutate()}
                className="mb-3 mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border p-3.5 text-[15px] font-medium text-destructive hover:bg-destructive/5"
              >
                <LogOut className="size-4" /> Sair do aplicativo
              </button>
            </div>
          </div>
        )}
      </div>
    </PrivacyGate>
  );
}
