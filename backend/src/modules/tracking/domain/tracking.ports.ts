import type { TrackerCapabilitiesDto, TrackerCommandStatus, TrackerCommandType } from '@locamania/shared';

export const TRACKER_PROVIDER = Symbol('TrackerProvider');
export const TRACKING_REPOSITORY = Symbol('TrackingRepository');

/**
 * Porta do rastreador (§31). **Não assume que todo rastreador tem as mesmas
 * funções**: cada fornecedor declara as capacidades, e a tela só oferece o que
 * o equipamento faz.
 */
export interface TrackerProvider {
  readonly name: string;
  readonly sandbox: boolean;
  readonly enabled: boolean;
  capabilities(deviceId: string | null): TrackerCapabilitiesDto;
  /** Última posição conhecida (o sandbox simula). */
  lastPosition(motorcycleId: string, deviceId: string | null): Promise<{ lat: number; lng: number; speedKmh: number | null; recordedAt: Date } | null>;
  /**
   * Envia bloqueio/desbloqueio. O equipamento é quem aplica as regras de
   * segurança (ex.: só bloquear com a moto parada) — o sistema nunca desliga
   * uma moto em movimento por conta própria (§32).
   */
  sendCommand(deviceId: string, type: TrackerCommandType): Promise<{ status: TrackerCommandStatus; response: string }>;
}

export interface TrackingRepository {
  trackedMotorcycles(): Promise<{ id: string; plate: string; brandCode: string; modelCode: string; status: string; trackerProvider: string | null; trackerDeviceId: string | null }[]>;
  motorcycle(id: string): Promise<{ id: string; plate: string; brandCode: string; modelCode: string; status: string; hasTracker: boolean; trackerProvider: string | null; trackerDeviceId: string | null } | null>;
  latestPosition(motorcycleId: string): Promise<{ lat: number; lng: number; speedKmh: number | null; recordedAt: Date } | null>;
  savePosition(motorcycleId: string, p: { lat: number; lng: number; speedKmh: number | null; recordedAt: Date }): Promise<void>;
  commands(motorcycleId: string, take: number): Promise<{ id: string; type: TrackerCommandType; status: TrackerCommandStatus; reason: string; requestedByName: string | null; createdAt: Date; providerResponse: string | null }[]>;
  createCommand(data: { motorcycleId: string; type: TrackerCommandType; reason: string; requestedById: string; status: TrackerCommandStatus; providerResponse: string }): Promise<string>;
}
