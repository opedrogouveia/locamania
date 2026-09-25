import { Global, Injectable, Module } from '@nestjs/common';
import { normalizeText, type CatalogGroup } from '@locamania/shared';

import { PrismaService } from '../prisma/prisma.service';

const TTL_MS = 60_000;

/**
 * Código → rótulo dos catálogos (marca, modelo, tipo de documento, categoria).
 * O registro guarda o código; a tela e o PDF mostram o rótulo atual — renomear
 * "CG 160 Fan" não reescreve nenhum contrato.
 */
@Injectable()
export class CatalogLabelsService {
  private cache: { map: Map<string, string>; at: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private async all(): Promise<Map<string, string>> {
    if (this.cache && Date.now() - this.cache.at < TTL_MS) return this.cache.map;
    const rows = await this.prisma.raw.catalogItem.findMany({ select: { group: true, code: true, label: true } });
    const map = new Map(rows.map((r) => [`${r.group}:${r.code}`, r.label]));
    this.cache = { map, at: Date.now() };
    return map;
  }

  async label(group: CatalogGroup, code: string | null | undefined): Promise<string> {
    if (!code) return '—';
    return (await this.all()).get(`${group}:${code}`) ?? code;
  }

  /** Resolve vários de uma vez (listas). */
  async resolver(): Promise<(group: CatalogGroup, code: string | null | undefined) => string> {
    const map = await this.all();
    return (group, code) => (code ? (map.get(`${group}:${code}`) ?? code) : '—');
  }

  /** "Honda CG 160 Titan". */
  async motorcycleLabel(brandCode: string, modelCode: string): Promise<string> {
    const r = await this.resolver();
    return `${r('MOTORCYCLE_BRAND', brandCode)} ${r('MOTORCYCLE_MODEL', modelCode)}`;
  }

  async exists(group: CatalogGroup, code: string): Promise<boolean> {
    return (await this.all()).has(`${group}:${code}`);
  }

  /** Códigos cujo rótulo contém o termo (busca "CG 160" → CG_160_FAN, CG_160_TITAN…). */
  async codesMatching(groups: CatalogGroup[], term: string): Promise<string[]> {
    const t = normalizeText(term);
    const out: string[] = [];
    for (const [key, label] of await this.all()) {
      const [group, code] = key.split(':') as [CatalogGroup, string];
      if (groups.includes(group) && normalizeText(label).includes(t)) out.push(code);
    }
    return out;
  }

  invalidate(): void {
    this.cache = null;
  }
}

@Global()
@Module({ providers: [CatalogLabelsService], exports: [CatalogLabelsService] })
export class CatalogLabelsModule {}
