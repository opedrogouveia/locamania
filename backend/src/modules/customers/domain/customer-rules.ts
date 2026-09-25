import {
  ageOn,
  BRAZILIAN_STATES,
  isValidCep,
  isValidCpf,
  isValidPhone,
  onlyDigits,
  type CreateCustomerRequest,
  type Ymd,
} from '@locamania/shared';

import { ValidationError } from '../../../shared/errors/domain-errors';
import type { CustomerWriteData } from './customers.ports';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const t = value?.trim();
  return t ? t : null;
}

/**
 * Normaliza e valida os dados do cliente (cadastro e edição). Grava só dígitos
 * em CPF/CEP/telefone — assim a busca por "123.456" e por "123456" acha o mesmo.
 */
export function normalizeCustomerInput(input: Partial<CreateCustomerRequest>, today: Ymd): CustomerWriteData {
  const out: CustomerWriteData = {};

  if (input.name !== undefined) {
    const name = input.name.trim().replace(/\s+/g, ' ');
    if (name.length < 3) throw new ValidationError('Informe o nome completo.');
    out.name = name;
  }
  if (input.cpf !== undefined) {
    const cpf = onlyDigits(input.cpf);
    if (!isValidCpf(cpf)) throw new ValidationError('CPF inválido.');
    out.cpf = cpf;
  }
  for (const key of ['phone', 'whatsapp'] as const) {
    const v = input[key];
    if (v === undefined) continue;
    const digits = onlyDigits(v);
    if (digits && !isValidPhone(digits)) throw new ValidationError(key === 'phone' ? 'Telefone inválido (use DDD + número).' : 'WhatsApp inválido (use DDD + número).');
    out[key] = digits || null;
  }
  if (input.email !== undefined) {
    const email = clean(input.email)?.toLowerCase() ?? null;
    if (email && !EMAIL_RE.test(email)) throw new ValidationError('E-mail inválido.');
    out.email = email;
  }
  if (input.postalCode !== undefined) {
    const cep = onlyDigits(input.postalCode);
    if (cep && !isValidCep(cep)) throw new ValidationError('CEP inválido.');
    out.postalCode = cep || null;
  }
  if (input.state !== undefined) {
    const uf = clean(input.state)?.toUpperCase() ?? null;
    if (uf && !(BRAZILIAN_STATES as readonly string[]).includes(uf)) throw new ValidationError('Estado (UF) inválido.');
    out.state = uf;
  }
  if (input.birthDate !== undefined) {
    if (input.birthDate) {
      if (input.birthDate > today) throw new ValidationError('A data de nascimento não pode ser no futuro.');
      if (ageOn(input.birthDate, today) < 18) throw new ValidationError('O cliente precisa ter pelo menos 18 anos.');
    }
    out.birthDate = input.birthDate ?? null;
  }
  if (input.cnhNumber !== undefined) {
    const cnh = onlyDigits(input.cnhNumber);
    if (cnh && cnh.length !== 11) throw new ValidationError('O número da CNH tem 11 dígitos.');
    out.cnhNumber = cnh || null;
  }
  for (const key of ['rg', 'street', 'streetNumber', 'complement', 'district', 'city', 'notes'] as const) {
    if (input[key] !== undefined) out[key] = clean(input[key]);
  }
  if (input.cnhCategory !== undefined) out.cnhCategory = input.cnhCategory ?? null;
  if (input.cnhExpiresAt !== undefined) out.cnhExpiresAt = input.cnhExpiresAt ?? null;
  return out;
}

/** CNH categoria A é exigida para moto (A, AB, AC, AD, AE). */
export function cnhAllowsMotorcycle(category: string | null): boolean {
  return !!category && category.includes('A');
}
