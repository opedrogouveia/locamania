'use client';

import { Lock } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { BackLink } from '@/components/ui/back-link';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe, useStaff } from '@/lib/auth/use-auth';
import { settingsItemFor, visibleSettings } from '@/lib/settings/nav';
import { cn } from '@/lib/utils';

/** Tela de "sem acesso" das Configurações (a API recusaria de qualquer jeito). */
export function NoAccess({ description = 'Peça à proprietária para liberar esta área no seu perfil.' }: { description?: string }) {
  return (
    <EmptyState
      icon={Lock}
      title="Você não tem acesso a esta área"
      description={description}
      action={<BackLink href="/admin">Voltar ao painel</BackLink>}
    />
  );
}

/**
 * Moldura das subpáginas de Configurações: no desktop, menu lateral com todas
 * as seções (troca de uma para outra sem voltar); no celular, "‹ Configurações"
 * no topo — a lista inicial faz o papel do menu, como nos Ajustes do iPhone.
 * Também faz a guarda de permissão de cada seção.
 */
export function SettingsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isLoading } = useMe();
  const staff = useStaff();
  const groups = visibleSettings(staff?.permissions ?? []);
  const item = settingsItemFor(pathname);

  if (pathname === '/admin/settings') return <>{children}</>;

  let content: ReactNode = children;
  if (isLoading || !staff) {
    content = (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  } else if (item && !staff.permissions.includes(item.permission)) {
    content = <NoAccess />;
  }

  return (
    <div className="lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-8 xl:gap-12">
      <aside className="hidden lg:block">
        <nav aria-label="Seções das configurações" className="sticky top-[5.5rem] space-y-5">
          <Link href="/admin/settings" className="block px-3 text-sm font-semibold tracking-tight hover:text-primary">
            Configurações
          </Link>
          {groups.map((g) => (
            <div key={g.label} className="space-y-1">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</p>
              <ul className="space-y-0.5">
                {g.items.map((i) => {
                  const active = item?.href === i.href;
                  return (
                    <li key={i.href}>
                      <Link
                        href={i.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors',
                          active ? 'bg-primary/10 font-medium text-primary' : 'text-foreground/80 hover:bg-accent hover:text-foreground',
                        )}
                      >
                        <i.icon className="size-4 shrink-0" aria-hidden />
                        <span className="truncate">{i.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 space-y-5">
        <BackLink href="/admin/settings" className="lg:hidden">
          Configurações
        </BackLink>
        {content}
      </div>
    </div>
  );
}
