/**
 * Aleatoriedade determinística da seed de demonstração.
 *
 * LCG de 32 bits (constantes do Numerical Recipes): simples, rápido e, com a
 * mesma semente, gera sempre a mesma sequência — rodar a seed duas vezes dá os
 * mesmos dados (só as datas andam junto com "hoje").
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Número em [0, 1). */
  next(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 4294967296;
  }

  /** Inteiro em [min, max] (inclusive). */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)] as T;
  }

  /** Escolha ponderada: [[valor, peso], ...]. */
  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((acc, [, w]) => acc + w, 0);
    let r = this.next() * total;
    for (const [value, w] of entries) {
      r -= w;
      if (r < 0) return value;
    }
    return entries[entries.length - 1]![0];
  }

  /** Cópia embaralhada (Fisher–Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  }

  /** Sequência de `n` dígitos (pode começar com zero). */
  digits(n: number): string {
    let s = '';
    for (let i = 0; i < n; i++) s += String(this.int(0, 9));
    return s;
  }

  letters(n: number, alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'): string {
    let s = '';
    for (let i = 0; i < n; i++) s += alphabet[this.int(0, alphabet.length - 1)];
    return s;
  }
}

/**
 * Ids no formato do `cuid()` do Prisma ("c" + 24 caracteres base 36), vindos de
 * um gerador próprio — estáveis entre execuções, então os links da demonstração
 * (ex.: /admin/customers/<id>) continuam valendo depois de rodar a seed de novo.
 */
export class IdFactory {
  private readonly rng: Rng;
  private readonly alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';

  constructor(seed: number) {
    this.rng = new Rng(seed);
  }

  id(): string {
    let s = 'c';
    for (let i = 0; i < 24; i++) s += this.alphabet[this.rng.int(0, 35)];
    return s;
  }

  hex(n: number): string {
    let s = '';
    for (let i = 0; i < n; i++) s += '0123456789abcdef'[this.rng.int(0, 15)];
    return s;
  }
}
