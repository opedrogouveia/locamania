import { addDays, diffDays, todayYmd, ymdToDate, type Ymd } from '@locamania/shared';

import type { Rng } from './random';

export const TIMEZONE = 'America/Sao_Paulo';
/** São Paulo não tem horário de verão desde 2019: UTC−3 o ano todo. */
const UTC_OFFSET_HOURS = 3;

/**
 * "Hoje" da demonstração e a janela de 12 meses de operação. Os dias são
 * indexados a partir do início da janela (0) até hoje (365), o que deixa as
 * simulações de quilometragem e manutenção num vetor simples.
 */
export class DemoClock {
  readonly now: Date;
  readonly today: Ymd;
  /** Primeiro dia da janela de operação (hoje − 365). */
  readonly start: Ymd;
  readonly todayIdx: number;

  constructor(now: Date = new Date()) {
    this.now = now;
    this.today = todayYmd(TIMEZONE, now);
    this.start = addDays(this.today, -365);
    this.todayIdx = diffDays(this.start, this.today);
  }

  idx(ymd: Ymd): number {
    return diffDays(this.start, ymd);
  }

  ymd(idx: number): Ymd {
    return addDays(this.start, idx);
  }

  /** Campo `@db.Date` (meia-noite UTC do dia). */
  ymdDate(ymd: Ymd): Date {
    return ymdToDate(ymd);
  }

  /** Campo `@db.Date` a partir do índice do dia. */
  idxDate(idx: number): Date {
    return ymdToDate(this.ymd(idx));
  }

  /** Dia relativo a hoje (negativo = passado). */
  rel(days: number): Ymd {
    return addDays(this.today, days);
  }

  /** Instante no horário local de São Paulo. */
  at(ymd: Ymd, hour: number, minute = 0, second = 0): Date {
    const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
    return new Date(Date.UTC(y, m - 1, d, hour + UTC_OFFSET_HOURS, minute, second));
  }

  /**
   * Instante aleatório no dia, dentro do horário informado, nunca no futuro
   * (um pagamento "de hoje" não pode ter acontecido daqui a duas horas).
   */
  past(ymd: Ymd, rng: Rng, fromHour = 8, toHour = 19): Date {
    const minutes = rng.int(fromHour * 60, toHour * 60 - 1);
    const date = this.at(ymd, Math.floor(minutes / 60), minutes % 60, rng.int(0, 59));
    return this.clamp(date, rng);
  }

  /** Garante que o instante não passa de "agora" (recua alguns minutos). */
  clamp(date: Date, rng: Rng): Date {
    if (date.getTime() <= this.now.getTime()) return date;
    const back = rng.int(3, 50) * 60_000;
    const floor = this.at(this.today, 0, 1).getTime();
    return new Date(Math.max(floor, this.now.getTime() - back));
  }

  /** Soma minutos a um instante, sem passar de agora. */
  plusMinutes(date: Date, minutes: number): Date {
    const t = date.getTime() + minutes * 60_000;
    return new Date(Math.min(t, this.now.getTime()));
  }
}
