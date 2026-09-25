/**
 * Erros de domínio — puros, sem NestJS/HTTP. Domínio e aplicação lançam estes;
 * o exception filter traduz para HTTP.
 *
 * Mensagens em pt-BR, prontas para a tela (a UI é pt-BR). O `code` é estável e
 * é o que o frontend usa para decidir comportamento — nunca o texto.
 * (Lição do SafeKeep: mensagem no idioma errado chegava ao usuário.)
 */

export type DomainErrorCode = 'VALIDATION' | 'NOT_FOUND' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'CONFLICT';

export abstract class DomainError extends Error {
  abstract readonly code: DomainErrorCode;

  constructor(
    message: string,
    /** Código específico opcional (ex.: 'CUSTOMER_BLOCKED'), para a tela reagir. */
    public readonly reason?: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION';
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
}

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
}

export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
}

export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
}
