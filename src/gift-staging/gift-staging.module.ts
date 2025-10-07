import { Module } from '@nestjs/common';
import { GiftStagingController } from './gift-staging.controller';
import { GiftStagingService } from './gift-staging.service';
import { GiftStagingProcessingService } from './gift-staging-processing.service';

@Module({
  controllers: [GiftStagingController],
  providers: [GiftStagingService, GiftStagingProcessingService],
  exports: [GiftStagingService, GiftStagingProcessingService],
})
export class GiftStagingModule {}
