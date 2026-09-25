import { WifiOff } from 'lucide-react';

export const metadata = { title: 'Sem conexão' };

/** Mostrada pelo service worker quando o app abre sem internet (§35). */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <WifiOff className="size-7 text-muted-foreground" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold">Sem conexão com a internet.</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Para ver seus pagamentos e seu contrato com segurança, o app precisa estar conectado. Tente de novo quando a
        conexão voltar.
      </p>
    </main>
  );
}
