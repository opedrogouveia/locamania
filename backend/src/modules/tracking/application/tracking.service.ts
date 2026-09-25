import { Inject, Injectable } from '@nestjs/common';
import {
  normalizePlate,
  Permission,
  TRACKER_COMMAND_LABELS,
  type TrackerCommandDto,
  type TrackerCommandRequest,
  type TrackerStatusDto,
} from '@locamania/shared';

import type { StaffPrincipal } from '../../../shared/auth/principal';
import { CatalogLabelsService } from '../../../shared/catalog/catalog-labels.service';
import { NotFoundError, ValidationError } from '../../../shared/errors/domain-errors';
import { iso } from '../../../shared/http/mappers';
import { AuditService } from '../../audit/application/audit.service';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { TRACKER_PROVIDER, TRACKING_REPOSITORY, type TrackerProvider, type TrackingRepository } from '../domain/tracking.ports';

const ONLINE_MS = 30 * 60_000;

@Injectable()
export class TrackingService {
  constructor(
    @Inject(TRACKING_REPOSITORY) private readonly repo: TrackingRepository,
    @Inject(TRACKER_PROVIDER) private readonly provider: TrackerProvider,
    private readonly catalog: CatalogLabelsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private async status(m: { id: string; plate: string; brandCode: string; modelCode: string; status: string; trackerDeviceId: string | null }): Promise<TrackerStatusDto> {
    const label = await this.catalog.motorcycleLabel(m.brandCode, m.modelCode);
    const position = this.provider.enabled ? await this.provider.lastPosition(m.id, m.trackerDeviceId) : await this.repo.latestPosition(m.id);
    const last = (await this.repo.commands(m.id, 1))[0];
    return {
      motorcycle: { id: m.id, plate: m.plate, label, status: m.status },
      provider: this.provider.name,
      deviceId: m.trackerDeviceId,
      sandbox: this.provider.sandbox,
      capabilities: this.provider.capabilities(m.trackerDeviceId),
      online: !!position && Date.now() - position.recordedAt.getTime() < ONLINE_MS,
      lastCommunicationAt: iso(position?.recordedAt ?? null),
      position: position ? { lat: position.lat, lng: position.lng, speedKmh: position.speedKmh, recordedAt: iso(position.recordedAt) } : null,
      mapUrl: position ? `https://www.google.com/maps?q=${position.lat},${position.lng}` : null,
      lastCommand: last ? this.commandDto(last) : null,
    };
  }

  private commandDto(c: Awaited<ReturnType<TrackingRepository['commands']>>[number]): TrackerCommandDto {
    return { id: c.id, type: c.type, status: c.status, reason: c.reason, requestedBy: c.requestedByName, requestedAt: iso(c.createdAt), providerResponse: c.providerResponse };
  }

  async list(): Promise<TrackerStatusDto[]> {
    const motos = await this.repo.trackedMotorcycles();
    return Promise.all(motos.map((m) => this.status(m)));
  }

  async get(motorcycleId: string): Promise<TrackerStatusDto & { commands: TrackerCommandDto[] }> {
    const m = await this.repo.motorcycle(motorcycleId);
    if (!m) throw new NotFoundError('Moto não encontrada.');
    if (!m.hasTracker) throw new ValidationError('Esta moto não tem rastreador cadastrado.');
    return { ...(await this.status(m)), commands: (await this.repo.commands(m.id, 20)).map((c) => this.commandDto(c)) };
  }

  /**
   * Bloqueio seguro (§32): confirmação digitando a placa, motivo obrigatório,
   * registro de quem, quando e por quê, e só se o equipamento suportar.
   */
  async command(motorcycleId: string, input: TrackerCommandRequest, actor: StaffPrincipal): Promise<TrackerCommandDto> {
    const m = await this.repo.motorcycle(motorcycleId);
    if (!m) throw new NotFoundError('Moto não encontrada.');
    if (!m.hasTracker || !m.trackerDeviceId) throw new ValidationError('Esta moto não tem rastreador com identificação cadastrada.');
    if (!this.provider.enabled || !this.provider.capabilities(m.trackerDeviceId).block) {
      throw new ValidationError('O rastreador desta moto não oferece bloqueio remoto.');
    }
    if (normalizePlate(input.confirmPlate) !== m.plate) throw new ValidationError('A placa digitada não confere. Confirme a moto antes de continuar.');
    if (input.reason.trim().length < 5) throw new ValidationError('Descreva o motivo (mínimo de 5 caracteres).');
    const result = await this.provider.sendCommand(m.trackerDeviceId, input.type);
    const id = await this.repo.createCommand({
      motorcycleId,
      type: input.type,
      reason: input.reason.trim(),
      requestedById: actor.id,
      status: result.status,
      providerResponse: result.response,
    });
    await this.audit.record({
      action: 'COMMAND',
      entityType: 'Motorcycle',
      entityId: motorcycleId,
      changes: { command: input.type, reason: input.reason.trim(), status: result.status },
    });
    await this.notifications.notifyStaff(
      {
        type: 'TRACKER_COMMAND',
        title: `${TRACKER_COMMAND_LABELS[input.type]} solicitado — ${m.plate}`,
        body: `${actor.name}: ${input.reason.trim()}`,
        severity: input.type === 'BLOCK' ? 'DANGER' : 'INFO',
        link: `/admin/motorcycles/${motorcycleId}?tab=tracking`,
        entityType: 'Motorcycle',
        entityId: motorcycleId,
        dedupeKey: `tracker:${id}`,
      },
      Permission.TRACKING_VIEW,
    );
    return this.commandDto((await this.repo.commands(motorcycleId, 1))[0]!);
  }
}
