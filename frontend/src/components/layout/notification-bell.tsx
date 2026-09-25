'use client';

import type { UnreadCountDto } from '@locamania/shared';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import Link from 'next/link';

import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils';

export const UNREAD_KEY = ['notifications', 'unread'] as const;

/** Contador de avisos não lidos — atualiza sozinho a cada minuto (§34). */
export function useUnreadCount(audience: 'staff' | 'customer') {
  return useQuery({
    queryKey: [...UNREAD_KEY, audience],
    queryFn: () =>
      api.get<UnreadCountDto>(audience === 'staff' ? '/notifications/unread-count' : '/portal/notifications/unread-count'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function NotificationBell({ href, audience, className }: { href: string; audience: 'staff' | 'customer'; className?: string }) {
  const { data } = useUnreadCount(audience);
  const unread = data?.unread ?? 0;
  return (
    <Link
      href={href}
      className={cn('relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground', className)}
      aria-label={unread ? `Notificações: ${unread} não lidas` : 'Notificações'}
    >
      <Bell className="size-5" />
      {unread > 0 && (
        <span className="absolute right-1 top-1 flex min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-[18px] text-destructive-foreground">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}
