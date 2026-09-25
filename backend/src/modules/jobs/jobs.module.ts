import { Module } from '@nestjs/common';

import { JOB_RUNS, JobsService } from './application/jobs.service';
import { PrismaJobRuns } from './infrastructure/prisma-job-runs';
import { JobsController } from './presentation/jobs.controller';

@Module({
  controllers: [JobsController],
  providers: [JobsService, { provide: JOB_RUNS, useClass: PrismaJobRuns }],
})
export class JobsModule {}
