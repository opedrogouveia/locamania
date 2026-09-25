export const PASSWORD_HASHER = Symbol('PasswordHasher');

/** Porta para hashing/verificação de senha (impl. na infraestrutura). */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}
