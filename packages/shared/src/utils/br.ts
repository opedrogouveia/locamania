/**
 * Validação e máscaras de documentos brasileiros. Usadas no formulário (máscara
 * enquanto digita) e na API (validação), para as duas pontas concordarem.
 *
 * Tudo é gravado **só com dígitos** (CPF, CEP, telefone) ou normalizado (placa
 * em maiúsculas, sem hífen) — a busca por "123.456" e por "123456" acha o mesmo.
 */

export const onlyDigits = (value: string | null | undefined): string =>
  (value ?? '').replace(/\D/g, '');

// ─────────────────────────────── CPF ───────────────────────────────

export function isValidCpf(value: string | null | undefined): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export function formatCpf(value: string | null | undefined): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Mostra só o começo e o fim (LGPD): `123.***.***-09`. */
export function maskCpf(value: string | null | undefined): string {
  const d = onlyDigits(value);
  if (d.length !== 11) return '—';
  return `${d.slice(0, 3)}.***.***-${d.slice(9)}`;
}

// ─────────────────────────────── CNPJ ───────────────────────────────

export function isValidCnpj(value: string | null | undefined): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + Number(cnpj[i]) * w, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
}

export function formatCnpj(value: string | null | undefined): string {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

// ─────────────────────────────── CEP ───────────────────────────────

export function isValidCep(value: string | null | undefined): boolean {
  return onlyDigits(value).length === 8;
}

export function formatCep(value: string | null | undefined): string {
  const d = onlyDigits(value).slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

// ───────────────────────────── Telefone ─────────────────────────────

/** Fixo (10 dígitos) ou celular (11), com DDD. */
export function isValidPhone(value: string | null | undefined): boolean {
  const d = onlyDigits(value);
  return d.length === 10 || d.length === 11;
}

export function formatPhone(value: string | null | undefined): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * Link oficial "click-to-chat" do WhatsApp (wa.me) com a mensagem pronta.
 * Funciona sem a API paga: abre a conversa no celular/computador de quem
 * clica, e a pessoa envia. O envio automático fica para a WhatsApp Business
 * Platform (ver docs/decisoes-e-perguntas.md).
 */
export function whatsappLink(phone: string | null | undefined, message?: string): string | null {
  const d = onlyDigits(phone);
  if (d.length < 10) return null;
  const withCountry = d.length <= 11 ? `55${d}` : d;
  return `https://wa.me/${withCountry}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

// ─────────────────────────────── Placa ───────────────────────────────

/** Remove hífen/espaço e põe em maiúsculas: `abc-1234` → `ABC1234`. */
export function normalizePlate(value: string | null | undefined): string {
  return (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Padrão antigo (ABC1234) ou Mercosul (ABC1D23). */
export function isValidPlate(value: string | null | undefined): boolean {
  return /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(normalizePlate(value));
}

/** `ABC1234` → `ABC-1234`; Mercosul `ABC1D23` fica sem hífen, como na placa. */
export function formatPlate(value: string | null | undefined): string {
  const p = normalizePlate(value);
  if (p.length !== 7) return p;
  return /^[A-Z]{3}\d{4}$/.test(p) ? `${p.slice(0, 3)}-${p.slice(3)}` : p;
}

// ─────────────────────────────── Texto ───────────────────────────────

/** Minúsculas, sem acento — para busca e comparação. */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Primeiro nome, para saudação ("Olá, João"). */
export function firstName(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? '';
}

/** Iniciais para avatar: "João da Silva" → "JS". */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter((p) => p.length > 2 || /^[A-Z]/.test(p));
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}
