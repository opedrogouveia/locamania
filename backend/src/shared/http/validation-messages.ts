import { BadRequestException } from '@nestjs/common';
import { FIELD_LABELS } from '@locamania/shared';
import type { ValidationError } from 'class-validator';

/**
 * Mensagens do ValidationPipe em pt-BR. As padrões do class-validator saem em
 * inglês ("depositOutcome must be one of...") e chegam à tela da cliente.
 * Validadores próprios (IsCpf, IsYmd...) já trazem mensagem em português e
 * passam direto.
 */
const label = (prop: string) => {
  const l = FIELD_LABELS[prop] ?? prop;
  return l.charAt(0).toUpperCase() + l.slice(1);
};

const num = (msg: string) => /(-?\d+(?:\.\d+)?)/.exec(msg)?.[1];

function translate(constraint: string, original: string, prop: string): string {
  const f = label(prop);
  switch (constraint) {
    case 'isNotEmpty':
    case 'isDefined':
      return `${f}: campo obrigatório.`;
    case 'whitelistValidation':
      return `Campo não permitido: ${prop}.`;
    case 'isEnum':
    case 'isIn':
      return `${f}: opção inválida.`;
    case 'isEmail':
      return 'E-mail inválido.';
    case 'min':
      return `${f}: o mínimo é ${num(original) ?? ''}.`.replace(' .', '.');
    case 'max':
      return `${f}: o máximo é ${num(original) ?? ''}.`.replace(' .', '.');
    case 'minLength':
      return `${f}: use pelo menos ${num(original) ?? ''} caracteres.`;
    case 'maxLength':
      return `${f}: use no máximo ${num(original) ?? ''} caracteres.`;
    case 'arrayMaxSize':
      return `${f}: itens demais.`;
    case 'arrayMinSize':
    case 'arrayNotEmpty':
      return `${f}: informe pelo menos um item.`;
    case 'isBoolean':
      return `${f}: use sim ou não.`;
    case 'isInt':
      return `${f}: use um número inteiro.`;
    case 'isNumber':
    case 'isNumberString':
    case 'isPositive':
      return `${f}: número inválido.`;
    case 'isDateString':
    case 'isISO8601':
      return `${f}: data inválida.`;
    default:
      // Mensagem já em português (validadores do projeto) passa como está.
      return /[áéíóúãõçê]|inválid|obrigatóri/i.test(original) ? original : `${f}: valor inválido.`;
  }
}

const REQUIRED = ['isNotEmpty', 'isDefined'];
const isEmpty = (v: unknown) => v === undefined || v === null || v === '';

/** Uma mensagem por campo: vazio → "obrigatório"; senão a do validador do projeto, se houver. */
function flatten(errors: ValidationError[], out: string[] = []): string[] {
  for (const e of errors) {
    const entries = Object.entries(e.constraints ?? {});
    if (entries.length) {
      const required = entries.find(([k]) => REQUIRED.includes(k));
      const own = entries.find(([k, m]) => !REQUIRED.includes(k) && translate(k, m, e.property) === m);
      const [key, msg] = (isEmpty(e.value) && required) || own || required || entries[0]!;
      out.push(translate(key, msg, e.property));
    }
    if (e.children?.length) flatten(e.children, out);
  }
  return out;
}

export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  return new BadRequestException([...new Set(flatten(errors))]);
}
