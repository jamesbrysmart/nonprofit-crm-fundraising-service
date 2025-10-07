import { Module } from '@nestjs/common';
import { GiftStagingController } from './gift-staging.controller';
import { GiftStagingService } from './gift-staging.service';
import { GiftStagingPromotionService } from './gift-staging-promotion.service';

@Module({
  controllers: [GiftStagingController],
  providers: [GiftStagingService, GiftStagingPromotionService],
  exports: [GiftStagingService, GiftStagingPromotionService],
})
export class GiftStagingModule {}
