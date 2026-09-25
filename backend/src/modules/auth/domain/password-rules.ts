import { ValidationError } from '../../../shared/errors/domain-errors';

export const MIN_PASSWORD_LENGTH = 8;

/** Senha mínima: 8 caracteres, com letra e número. Simples de lembrar, difícil de adivinhar. */
export function assertPasswordStrong(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    throw new ValidationError('A senha precisa ter letras e números.');
  }
}

/** Mesma senha de antes daria a impressão de que a troca aconteceu. */
export function assertPasswordIsNew(current: string, next: string): void {
  if (current === next) throw new ValidationError('A nova senha precisa ser diferente da atual.');
}
