'use client';

import {
  Bell,
  Bike,
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
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { PrivacyGate } from '@/components/customer/privacy-gate';
import { Brand } from '@/components/layout/brand';
import { useUnreadCount } from '@/components/layout/notification-bell';
import { Spinner } from '@/components/ui/spinner';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAreaGuard, useCustomerActor, useLogout } from '@/lib/auth/use-auth';
import { cn } from '@/lib/utils';

interface Tab {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** Menu do cliente (§17). Os 4 primeiros vão na barra inferior. */
const TABS: Tab[] = [
  { label: 'Início', href: '/app', icon: Home },
  { label: 'Pagamentos', href: '/app/payments', icon: Wallet },
  { label: 'Minha moto', href: '/app/motorcycle', icon: Bike },
  { label: 'Avisos', href: '/app/notifications', icon: Bell },
];

const MORE: Tab[] = [
  { label: 'Meu contrato', href: '/app/contract', icon: FileText },
  { label: 'Manutenção', href: '/app/maintenance', icon: Wrench },
  { label: 'Meu perfil', href: '/app/profile', icon: UserRound },
  { label: 'Suporte', href: '/app/support', icon: LifeBuoy },
];

function active(pathname: string, href: string) {
  return href === '/app' ? pathname === '/app' : pathname.startsWith(href);
}

/**
 * Moldura do app do cliente: muito mais simples que o painel (§15). No
 * celular, barra inferior com Início / Pagamentos / Moto / Avisos / Mais; no
 * computador, os mesmos itens no topo e o conteúdo centralizado.
 */
export function CustomerShell({ children }: { children: ReactNode }) {
  const { ready } = useAreaGuard('customer');
  const customer = useCustomerActor();
  const pathname = usePathname();
  const logout = useLogout();
  const unread = useUnreadCount('customer').data?.unread ?? 0;
  const [more, setMore] = useState(false);

  useEffect(() => setMore(false), [pathname]);

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
          <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4 sm:h-16">
            <Link href="/app" aria-label="Início">
              <Brand />
            </Link>
            <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Menu">
              {[...TABS, ...MORE].map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={active(pathname, t.href) ? 'page' : undefined}
                  className={cn(
                    'relative rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
                    active(pathname, t.href) ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t.label}
                  {t.href === '/app/notifications' && unread > 0 && (
                    <span className="ml-1 rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                      {unread}
                    </span>
                  )}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => logout.mutate()}
                className="hidden items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground md:inline-flex"
              >
                <LogOut className="size-4" /> Sair
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-5 md:pb-12">{children}</main>

        {/* Barra inferior (celular) */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-safe backdrop-blur md:hidden" aria-label="Menu">
          <div className="mx-auto grid max-w-lg grid-cols-5">
            {TABS.map((t) => {
              const on = active(pathname, t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={on ? 'page' : undefined}
                  className={cn('relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium', on ? 'text-primary' : 'text-muted-foreground')}
                >
                  <t.icon className="size-5" aria-hidden />
                  {t.label === 'Minha moto' ? 'Moto' : t.label}
                  {t.href === '/app/notifications' && unread > 0 && (
                    <span className="absolute right-[calc(50%-18px)] top-1.5 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-bold leading-4 text-destructive-foreground">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setMore(true)}
              className={cn('flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium', moreActive ? 'text-primary' : 'text-muted-foreground')}
            >
              <MoreHorizontal className="size-5" aria-hidden />
              Mais
            </button>
          </div>
        </nav>

        {/* Folha "Mais" */}
        {more && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMore(false)} aria-hidden />
            <div className="animate-in absolute inset-x-0 bottom-0 rounded-t-2xl bg-card p-4 pb-safe shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold">Mais opções</p>
                <button type="button" onClick={() => setMore(false)} className="rounded-md p-2 text-muted-foreground" aria-label="Fechar">
                  <X className="size-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {MORE.map((m) => (
                  <Link key={m.href} href={m.href} className="flex items-center gap-3 rounded-xl border border-border p-4 text-sm font-medium hover:bg-accent">
                    <m.icon className="size-5 text-primary" aria-hidden />
                    {m.label}
                  </Link>
                ))}
              </div>
              <button
                type="button"
                onClick={() => logout.mutate()}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border p-3.5 text-sm font-medium text-destructive"
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
