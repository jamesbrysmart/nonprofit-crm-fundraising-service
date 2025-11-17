import { Module } from '@nestjs/common';
import { GiftPayoutController } from './gift-payout.controller';
import { GiftPayoutService } from './gift-payout.service';
import { TwentyModule } from '../twenty/twenty.module';

@Module({
  imports: [TwentyModule],
  controllers: [GiftPayoutController],
  providers: [GiftPayoutService],
  exports: [GiftPayoutService],
})
export class GiftPayoutModule {}
