import { Module } from '@nestjs/common';

import { TrackingService } from './application/tracking.service';
import { TRACKER_PROVIDER, TRACKING_REPOSITORY } from './domain/tracking.ports';
import { PrismaTrackingRepository } from './infrastructure/prisma-tracking.repository';
import { SandboxTrackerProvider } from './infrastructure/sandbox-tracker.provider';
import { TrackingController } from './presentation/tracking.controller';

@Module({
  controllers: [TrackingController],
  providers: [
    TrackingService,
    PrismaTrackingRepository,
    { provide: TRACKING_REPOSITORY, useExisting: PrismaTrackingRepository },
    { provide: TRACKER_PROVIDER, useClass: SandboxTrackerProvider },
  ],
})
export class TrackingModule {}
