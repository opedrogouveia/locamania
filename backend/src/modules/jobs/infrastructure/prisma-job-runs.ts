import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { JobRunDto } from '@locamania/shared';

import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { JobRuns } from '../application/jobs.service';

@Injectable()
export class PrismaJobRuns implements JobRuns {
  constructor(private readonly prisma: PrismaService) {}

  async running(name: string, since: Date): Promise<boolean> {
    return (await this.prisma.raw.jobRun.count({ where: { name, status: 'RUNNING', startedAt: { gte: since } } })) > 0;
  }

  async start(name: string, trigger: string): Promise<string> {
    return (await this.prisma.raw.jobRun.create({ data: { name, trigger } })).id;
  }

  async finish(id: string, status: 'SUCCESS' | 'FAILED', summary: Record<string, unknown>): Promise<void> {
    await this.prisma.raw.jobRun.update({ where: { id }, data: { status, finishedAt: new Date(), summary: summary as Prisma.InputJsonValue } });
  }

  async recent(take: number): Promise<JobRunDto[]> {
    const rows = await this.prisma.raw.jobRun.findMany({ orderBy: { startedAt: 'desc' }, take });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
      summary: (r.summary as Record<string, unknown> | null) ?? null,
      trigger: r.trigger,
    }));
  }
}
