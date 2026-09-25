import type { ApiErrorResponse } from '@locamania/shared';

import { clearSession, getToken } from '../auth/session';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3201';

export const OFFLINE_MESSAGE = 'Sem conexão com a internet.';

/** Erro de API tipado, com o envelope padrão do backend. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorResponse | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get code(): string | undefined {
    return this.body?.code;
  }

  get offline(): boolean {
    return this.status === 0;
  }
}

/** Mensagem pronta para a tela a partir de qualquer erro. */
export function errorMessage(error: unknown, fallback = 'Não foi possível concluir. Tente de novo.'): string {
  if (error instanceof ApiError) return error.message || fallback;
  return fallback;
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Cliente HTTP único do app. Componentes NUNCA chamam fetch direto — usam as
 * funções de `lib/api/*`, que se apoiam aqui.
 *
 * - Sem internet, falha na hora com "Sem conexão com a internet." (§35): nada
 *   é considerado salvo sem a resposta do servidor.
 * - 401 com sessão aberta = sessão expirou/foi encerrada → limpa e volta ao login.
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (isOffline()) throw new ApiError(0, undefined, OFFLINE_MESSAGE);

  const token = getToken();
  const headers = new Headers(options.headers);
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, undefined, isOffline() ? OFFLINE_MESSAGE : 'Não foi possível falar com o servidor. Tente de novo.');
  }

  if (!response.ok) {
    let body: ApiErrorResponse | undefined;
    try {
      body = (await response.json()) as ApiErrorResponse;
    } catch {
      body = undefined;
    }
    if (response.status === 401 && token && !path.startsWith('/auth/login')) {
      clearSession();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = `/login?expired=1`;
      }
    }
    const message = body
      ? Array.isArray(body.message)
        ? body.message.join(' ')
        : body.message
      : response.statusText;
    throw new ApiError(response.status, body, message);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** GET/POST/PATCH/DELETE com JSON. */
export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};

/**
 * Query string a partir de um objeto — **genérico** (no SafeKeep cada recurso
 * tinha o seu, e filtro novo esquecido era ignorado em silêncio).
 */
export function qs(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

/** Busca um arquivo autenticado como blob (PDF, Excel, foto). */
async function fetchBlob(path: string): Promise<{ blob: Blob; fileName: string | null }> {
  if (isOffline()) throw new ApiError(0, undefined, OFFLINE_MESSAGE);
  const token = getToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    let body: ApiErrorResponse | undefined;
    try {
      body = (await response.json()) as ApiErrorResponse;
    } catch {
      body = undefined;
    }
    throw new ApiError(response.status, body, (body?.message as string) ?? 'Não foi possível abrir o arquivo.');
  }
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  return { blob: await response.blob(), fileName: match?.[1] ? decodeURIComponent(match[1]) : null };
}

/**
 * Baixa um arquivo. Por blob, e não `<a href>` para a API: link direto não
 * manda o cabeçalho de autorização, e token na URL vaza em log e histórico.
 */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const { blob, fileName } = await fetchBlob(path);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName ?? fallbackName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Abre um arquivo (PDF/foto) numa nova aba — para visualizar e imprimir. */
export async function openFile(path: string): Promise<void> {
  // A aba abre antes do await: navegador de celular bloqueia pop-up aberto depois.
  const tab = window.open('', '_blank');
  try {
    const { blob } = await fetchBlob(path);
    const url = URL.createObjectURL(blob);
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch (error) {
    tab?.close();
    throw error;
  }
}

/** URL de objeto para exibir uma imagem autenticada num <img>. */
export async function objectUrl(path: string): Promise<string> {
  const { blob } = await fetchBlob(path);
  return URL.createObjectURL(blob);
}
