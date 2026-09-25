'use client';

import { STAFF_ROLE_LABELS, type StaffActor } from '@locamania/shared';
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, UserRound, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { Brand, BrandMark } from '@/components/layout/brand';
import { CommandPalette, useCommandPalette } from '@/components/layout/command-palette';
import { NotificationBell } from '@/components/layout/notification-bell';
import { Avatar } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAreaGuard, useLogout, useStaff } from '@/lib/auth/use-auth';
import { cn } from '@/lib/utils';
import { ADMIN_MOBILE_TABS, currentTitle, isActive, visibleNav } from './admin-nav';

const COLLAPSE_KEY = 'locamania-sidebar-collapsed';

function SidebarNav({ staff, collapsed, onNavigate }: { staff: StaffActor; collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = visibleNav(staff.permissions);
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Menu principal">
      {groups.map((group) => (
        <div key={group.label} className="space-y-1">
          {!collapsed && (
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              {group.label}
            </p>
          )}
          {group.items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  collapsed && 'justify-center px-0',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                )}
              >
                <item.icon className="size-[18px] shrink-0" aria-hidden />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function UserMenu({ staff }: { staff: StaffActor }) {
  const logout = useLogout();
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar name={staff.name} />
        <span className="sr-only">Menu do usuário</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <span className="block truncate font-medium text-foreground">{staff.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{STAFF_ROLE_LABELS[staff.role]}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push('/admin/profile')}>
          <UserRound /> Meu perfil
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => logout.mutate()}>
          <LogOut /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Moldura do painel administrativo.
 *
 * Desktop: sidebar agrupada (recolhível) + barra superior com busca (Ctrl+K),
 * notificações e usuário. Celular: barra superior enxuta, **barra inferior**
 * com as 4 telas mais usadas + "Menu" (gaveta com o resto) — a proprietária
 * opera muito pelo telefone e o polegar alcança a parte de baixo.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const { ready } = useAreaGuard('staff');
  const staff = useStaff();
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const palette = useCommandPalette();

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      /* navegador sem storage */
    }
  }, []);
  useEffect(() => setDrawer(false), [pathname]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        /* ignora */
      }
      return !c;
    });
  }

  if (!ready || !staff) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
        <Spinner className="size-6" />
      </div>
    );
  }

  const tabs = ADMIN_MOBILE_TABS.filter((t) => t.anyOf.some((p) => staff.permissions.includes(p)));

  return (
    <div className="min-h-dvh lg:flex">
      {/* Sidebar (desktop) */}
      <aside
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        <div className={cn('flex h-16 items-center border-b border-sidebar-border px-4', collapsed && 'justify-center px-0')}>
          <Link href="/admin" aria-label="Painel">
            {collapsed ? <BrandMark /> : <Brand subtitle="Painel administrativo" />}
          </Link>
        </div>
        <SidebarNav staff={staff} collapsed={collapsed} />
        <div className="border-t border-sidebar-border p-3">
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
              collapsed && 'justify-center px-0',
            )}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
            {!collapsed && 'Recolher menu'}
          </button>
        </div>
      </aside>

      {/* Gaveta (celular/tablet) */}
      <div className={cn('lg:hidden', !drawer && 'pointer-events-none')}>
        <div
          className={cn('fixed inset-0 z-40 bg-black/50 transition-opacity', drawer ? 'opacity-100' : 'opacity-0')}
          onClick={() => setDrawer(false)}
          aria-hidden
        />
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-80 flex-col bg-sidebar pt-safe shadow-xl transition-transform duration-200',
            drawer ? 'translate-x-0' : '-translate-x-full',
          )}
          aria-hidden={!drawer}
        >
          <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
            <Brand subtitle="Painel administrativo" />
            <button type="button" onClick={() => setDrawer(false)} className="rounded-md p-2 text-muted-foreground hover:bg-sidebar-accent" aria-label="Fechar menu">
              <X className="size-5" />
            </button>
          </div>
          <SidebarNav staff={staff} onNavigate={() => setDrawer(false)} />
          <div className="border-t border-sidebar-border p-3 pb-safe">
            <div className="flex items-center gap-3 rounded-lg px-2 py-2">
              <Avatar name={staff.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{staff.name}</p>
                <p className="truncate text-xs text-muted-foreground">{STAFF_ROLE_LABELS[staff.role]}</p>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 pt-safe backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className="flex h-14 items-center gap-2 px-3 sm:h-16 sm:px-6">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="size-5" />
            </button>
            <p className="truncate text-base font-semibold lg:hidden">{currentTitle(pathname)}</p>

            <button
              type="button"
              onClick={() => palette.setOpen(true)}
              className="ml-auto hidden h-10 w-full max-w-md items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm text-muted-foreground shadow-sm transition-colors hover:border-ring/40 md:flex lg:ml-0"
            >
              <Search className="size-4" />
              <span className="flex-1 text-left">Buscar cliente, CPF, placa, contrato…</span>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">Ctrl K</kbd>
            </button>

            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => palette.setOpen(true)}
                className="rounded-md p-2 text-muted-foreground hover:bg-accent md:hidden"
                aria-label="Buscar"
              >
                <Search className="size-5" />
              </button>
              <NotificationBell href="/admin/notifications" audience="staff" />
              <div className="hidden sm:block">
                <ThemeToggle />
              </div>
              <UserMenu staff={staff} />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-7">
          {children}
        </main>
      </div>

      {/* Barra inferior (celular) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-safe backdrop-blur lg:hidden"
        aria-label="Atalhos"
      >
        <div className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
          {tabs.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <tab.icon className="size-5" aria-hidden />
                {tab.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground"
          >
            <Menu className="size-5" aria-hidden />
            Menu
          </button>
        </div>
      </nav>

      <CommandPalette open={palette.open} onOpenChange={palette.setOpen} />
    </div>
  );
}
