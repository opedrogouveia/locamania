import { onlyDigits } from '@locamania/shared';

export interface CepAddress {
  street: string;
  district: string;
  city: string;
  state: string;
}

/** Endereço pelo CEP (ViaCEP, público). Falhou ou não achou → null, sem erro na tela. */
export async function lookupCep(cep: string): Promise<CepAddress | null> {
  const digits = onlyDigits(cep);
  if (digits.length !== 8 || (typeof navigator !== 'undefined' && !navigator.onLine)) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const j = (await res.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
    if (j.erro) return null;
    return { street: j.logradouro ?? '', district: j.bairro ?? '', city: j.localidade ?? '', state: j.uf ?? '' };
  } catch {
    return null;
  }
}
