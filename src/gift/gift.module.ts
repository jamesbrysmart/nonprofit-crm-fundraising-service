import { Module } from '@nestjs/common';
import { GiftService } from './gift.service';
import { GiftController } from './gift.controller';
import { GiftStagingService } from '../gift-staging/gift-staging.service';

@Module({
  controllers: [GiftController],
  providers: [GiftService, GiftStagingService],
  exports: [GiftService],
})
export class GiftModule {}
