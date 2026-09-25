'use client';

import { useCallback, useEffect, useState } from 'react';

type Params = Record<string, string | undefined>;

/**
 * Estado de filtros na URL (aba, situação, página, busca) — o link abre a tela
 * do jeito que estava e o "voltar" do celular funciona. Lê `window.location`
 * num efeito (`useSearchParams` quebra o build estático); `ready` avisa quando
 * a URL já foi lida, para a lista não buscar duas vezes.
 */
export function useUrlState<T extends Params>(defaults: T): [T, (patch: Partial<T>) => void, boolean] {
  const [state, setState] = useState<T>(defaults);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const next = { ...defaults } as Params;
    for (const key of Object.keys(defaults)) {
      const v = sp.get(key);
      if (v !== null) next[key] = v;
    }
    // Chaves fora dos padrões também valem (ex.: ?ending=1 vindo do painel).
    sp.forEach((v, k) => {
      if (!(k in next)) next[k] = v;
    });
    setState(next as T);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback(
    (patch: Partial<T>) => {
      setState((prev) => {
        const next = { ...prev, ...patch };
        const sp = new URLSearchParams();
        for (const [k, v] of Object.entries(next)) {
          if (v !== undefined && v !== '' && v !== defaults[k]) sp.set(k, v);
        }
        const q = sp.toString();
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${q ? `?${q}` : ''}`);
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return [state, update, ready];
}

/** Página da URL como número (>= 1). */
export function pageOf(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}
