'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Spinner } from '@/components/ui/spinner';
import { getSession, homeFor } from '@/lib/auth/session';

/** Raiz: manda cada um para a sua área (painel, app ou login). */
export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    const session = getSession();
    router.replace(session ? homeFor(session.kind) : '/login');
  }, [router]);
  return (
    <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
      <Spinner className="size-6" />
    </div>
  );
}
