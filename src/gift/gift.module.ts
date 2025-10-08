import { Module, forwardRef } from '@nestjs/common';
import { GiftService } from './gift.service';
import { GiftController } from './gift.controller';
import { GiftStagingModule } from '../gift-staging/gift-staging.module';

@Module({
  imports: [forwardRef(() => GiftStagingModule)],
  controllers: [GiftController],
  providers: [GiftService],
  exports: [GiftService],
})
export class GiftModule {}
