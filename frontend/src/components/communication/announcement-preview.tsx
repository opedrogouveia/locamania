'use client';

import { Bell, Mail, Megaphone } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Prévia do aviso como o cliente vê: o item na tela "Avisos" do aplicativo e,
 * se marcado, o e-mail. Sem texto ainda, mostra o molde apagado.
 */
export function AnnouncementPreview({ title, body, email, companyName }: { title: string; body: string; email: boolean; companyName: string }) {
  const t = title.trim();
  const b = body.trim();
  const empty = !t && !b;
  return (
    <div className="space-y-4">
      {/* Aplicativo */}
      <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-[1.75rem] border-[6px] border-foreground/85 bg-background shadow-lg">
        <div className="flex items-center justify-between border-b border-border bg-card px-4 pb-2.5 pt-3">
          <span className="text-sm font-semibold">Avisos</span>
          <Bell className="size-4 text-muted-foreground" aria-hidden />
        </div>
        <div className="space-y-2 p-3">
          <div className={cn('flex items-start gap-3 rounded-xl border border-primary/30 bg-card p-3 shadow-sm', empty && 'opacity-50')}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-info/12 text-info">
              <Megaphone className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="break-words text-sm font-semibold leading-snug">{t || 'Título do aviso'}</p>
                <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-label="Não lido" />
              </div>
              <p className="mt-0.5 whitespace-pre-line break-words text-[13px] leading-snug text-muted-foreground">{b || 'A mensagem aparece aqui, do jeito que você escrever.'}</p>
              <p className="mt-1.5 text-[11px] text-muted-foreground">Aviso da {companyName} · agora</p>
            </div>
          </div>
          {/* Itens antigos, só para dar contexto */}
          {[0, 1].map((i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl p-3 opacity-40" aria-hidden>
              <span className="size-9 shrink-0 rounded-full bg-muted" />
              <div className="flex-1 space-y-1.5 pt-1">
                <span className="block h-2.5 w-3/4 rounded bg-muted" />
                <span className="block h-2 w-full rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* E-mail */}
      {email && (
        <div className={cn('overflow-hidden rounded-xl border border-border bg-card', empty && 'opacity-50')}>
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-sm">
            <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 truncate">
              <span className="text-muted-foreground">Assunto: </span>
              <span className="font-medium">
                {/* Mesmo assunto que a API monta (communication.service). */}
                {t || 'Título do aviso'} — Locamania
              </span>
            </span>
          </div>
          <div className="space-y-2 px-4 py-3 text-sm">
            {(b || 'A mensagem aparece aqui.').split(/\n+/).map((p, i) => (
              <p key={i} className="break-words">
                {p}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
