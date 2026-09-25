import type { ActorKind } from '@locamania/shared';

/**
 * Sessão no navegador: o token e de quem ele é (equipe ou cliente). Isolado
 * aqui para trocar por cookie httpOnly sem mexer no resto (ver
 * docs/decisoes-e-perguntas.md).
 */
const KEY = 'locamania_session';
const EVENT = 'locamania:session';

export interface StoredSession {
  token: string;
  kind: ActorKind;
}

export function getSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return getSession()?.token ?? null;
}

export function setSession(session: StoredSession): void {
  window.localStorage.setItem(KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(EVENT));
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

/** Assina mudanças de sessão (login/logout nesta aba ou em outra). */
export function subscribeSession(callback: () => void): () => void {
  const onStorage = (e: StorageEvent) => e.key === KEY && callback();
  window.addEventListener(EVENT, callback);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener('storage', onStorage);
  };
}

/** Para onde mandar quem acabou de entrar. */
export function homeFor(kind: ActorKind): string {
  return kind === 'staff' ? '/admin' : '/app';
}
