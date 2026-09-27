import { CalendarCheck, ShieldCheck, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';

import { Brand } from '@/components/layout/brand';

const HIGHLIGHTS = [
  { icon: Wallet, text: 'Pagamentos e vencimentos em dia, com PIX no aplicativo.' },
  { icon: CalendarCheck, text: 'Manutenção da moto acompanhada por quilometragem e data.' },
  { icon: ShieldCheck, text: 'Contrato, documentos e avisos num lugar só.' },
];

/**
 * Moldura das telas de acesso. Celular: uma coluna, marca no topo. Desktop:
 * painel de marca à esquerda.
 */
export function AuthLayout({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-border bg-card p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-primary/[0.06]" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-[28rem] rounded-full bg-primary/[0.04]" />
        <div className="relative">
          <Brand />
        </div>
        <div className="relative max-w-md space-y-6">
          <h2 className="text-3xl font-semibold leading-tight">A locadora inteira, do cadastro à devolução.</h2>
          <ul className="space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-muted-foreground">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="pt-1">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-muted-foreground">© {new Date().getFullYear()} Locamania</p>
      </aside>

      <main className="flex flex-col px-5 pb-safe pt-safe sm:px-8">
        <div className="flex h-16 items-center lg:hidden">
          <Brand />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <div className="mb-7 space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
