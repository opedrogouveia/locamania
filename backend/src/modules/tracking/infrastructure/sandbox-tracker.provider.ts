import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TrackerCapabilitiesDto, TrackerCommandStatus, TrackerCommandType } from '@locamania/shared';

import type { AppConfig } from '../../../shared/config/configuration';
import type { TrackerProvider } from '../domain/tracking.ports';
import { PrismaTrackingRepository } from './prisma-tracking.repository';

/** Número pseudoaleatório estável por moto (a posição simulada não "pula" a cada leitura). */
function seeded(id: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10_000) / 10_000;
}

/**
 * Rastreador de TESTES: posição simulada em São Paulo (andando devagar ao
 * longo do dia) e comando registrado como "simulado". A integração real é um
 * novo adaptador com a API do fornecedor escolhido.
 */
@Injectable()
export class SandboxTrackerProvider implements TrackerProvider {
  readonly name = 'sandbox';
  readonly sandbox = true;
  readonly enabled: boolean;

  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly repo: PrismaTrackingRepository,
  ) {
    this.enabled = config.get('tracker', { infer: true }).provider === 'sandbox';
  }

  capabilities(): TrackerCapabilitiesDto {
    return { location: true, odometer: false, block: true };
  }

  async lastPosition(motorcycleId: string) {
    const stored = await this.repo.latestPosition(motorcycleId);
    if (stored && Date.now() - stored.recordedAt.getTime() < 15 * 60_000) return stored;
    // Simula a próxima leitura a partir da anterior (ou de um ponto base da moto).
    const baseLat = -23.55 - 0.12 + seeded(motorcycleId, 1) * 0.24;
    const baseLng = -46.63 - 0.15 + seeded(motorcycleId, 2) * 0.3;
    const t = Date.now() / 3_600_000;
    const position = {
      lat: Number((baseLat + Math.sin(t + seeded(motorcycleId, 3) * 6) * 0.01).toFixed(6)),
      lng: Number((baseLng + Math.cos(t + seeded(motorcycleId, 4) * 6) * 0.01).toFixed(6)),
      speedKmh: Math.round(seeded(motorcycleId, Math.floor(t)) * 55),
      recordedAt: new Date(),
    };
    await this.repo.savePosition(motorcycleId, position);
    return position;
  }

  async sendCommand(_deviceId: string, type: TrackerCommandType): Promise<{ status: TrackerCommandStatus; response: string }> {
    return {
      status: 'SIMULATED',
      response:
        type === 'BLOCK'
          ? 'Simulação: nenhum equipamento conectado. Em produção, o rastreador aplica o bloqueio só com a moto parada.'
          : 'Simulação: nenhum equipamento conectado. Em produção, o rastreador libera a partida da moto.',
    };
  }
}
