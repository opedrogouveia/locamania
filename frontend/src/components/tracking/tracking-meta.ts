import type { TrackerCommandDto, TrackerStatusDto } from '@locamania/shared';

/** Nome do fornecedor para a tela ("sandbox" é o ambiente de testes). */
export function providerLabel(provider: string | null | undefined): string {
  if (!provider) return '—';
  return provider.toLowerCase() === 'sandbox' ? 'Teste (simulado)' : provider;
}

/** "há 3 min", "há 2 h", "há 4 dias". */
export function agoText(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}

export type Communication = {
  tone: 'success' | 'warning' | 'danger';
  label: string;
  detail: string;
};

/** Situação da comunicação do equipamento: online, atrasada (> 30 min) ou nunca comunicou. */
export function communication(
  s: Pick<TrackerStatusDto, 'online' | 'lastCommunicationAt'>,
): Communication {
  if (!s.lastCommunicationAt)
    return {
      tone: 'danger',
      label: 'Nunca comunicou',
      detail: 'Confira a instalação e a identificação do equipamento.',
    };
  if (s.online)
    return { tone: 'success', label: 'Comunicando', detail: agoText(s.lastCommunicationAt) };
  const hours = (Date.now() - new Date(s.lastCommunicationAt).getTime()) / 3_600_000;
  return {
    tone: hours > 24 ? 'danger' : 'warning',
    label: 'Sem comunicação',
    detail: `última ${agoText(s.lastCommunicationAt)}`,
  };
}

/** Último comando foi um bloqueio que não falhou → a moto está (ou vai ficar) bloqueada. */
export function isBlocked(last: TrackerCommandDto | null | undefined): boolean {
  return !!last && last.type === 'BLOCK' && last.status !== 'FAILED';
}

export const BLOCK_REASONS = [
  'Atraso no pagamento',
  'Suspeita de roubo ou furto',
  'Moto não devolvida no prazo',
  'Uso fora do combinado no contrato',
];
export const UNBLOCK_REASONS = [
  'Pagamento regularizado',
  'Moto recuperada',
  'Moto devolvida',
  'Bloqueio feito por engano',
];
