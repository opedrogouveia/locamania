import { Injectable } from '@nestjs/common';
import type { TrackerCommandStatus, TrackerCommandType } from '@locamania/shared';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { TrackingRepository } from '../domain/tracking.ports';

@Injectable()
export class PrismaTrackingRepository implements TrackingRepository {
  constructor(private readonly prisma: PrismaService) {}

  trackedMotorcycles() {
    return this.prisma.raw.motorcycle.findMany({
      where: { deletedAt: null, hasTracker: true, status: { not: 'INACTIVE' } },
      select: { id: true, plate: true, brandCode: true, modelCode: true, status: true, trackerProvider: true, trackerDeviceId: true },
      orderBy: { plate: 'asc' },
    });
  }

  motorcycle(id: string) {
    return this.prisma.raw.motorcycle.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, plate: true, brandCode: true, modelCode: true, status: true, hasTracker: true, trackerProvider: true, trackerDeviceId: true },
    });
  }

  latestPosition(motorcycleId: string) {
    return this.prisma.raw.trackerPosition.findFirst({
      where: { motorcycleId },
      orderBy: { recordedAt: 'desc' },
      select: { lat: true, lng: true, speedKmh: true, recordedAt: true },
    });
  }

  async savePosition(motorcycleId: string, p: { lat: number; lng: number; speedKmh: number | null; recordedAt: Date }): Promise<void> {
    await this.prisma.raw.trackerPosition.create({ data: { motorcycleId, ...p } });
  }

  async commands(motorcycleId: string, take: number) {
    const rows = await this.prisma.raw.trackerCommand.findMany({ where: { motorcycleId }, orderBy: { createdAt: 'desc' }, take });
    const users = await this.prisma.raw.user.findMany({ where: { id: { in: rows.map((r) => r.requestedById).filter(Boolean) as string[] } }, select: { id: true, name: true } });
    const names = new Map(users.map((u) => [u.id, u.name]));
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      reason: r.reason,
      requestedByName: r.requestedById ? (names.get(r.requestedById) ?? null) : null,
      createdAt: r.createdAt,
      providerResponse: r.providerResponse,
    }));
  }

  async createCommand(data: { motorcycleId: string; type: TrackerCommandType; reason: string; requestedById: string; status: TrackerCommandStatus; providerResponse: string }): Promise<string> {
    return (await this.prisma.client.trackerCommand.create({ data })).id;
  }
}
