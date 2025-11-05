import { Module, forwardRef } from '@nestjs/common';
import { GiftStagingController } from './gift-staging.controller';
import { GiftStagingService } from './gift-staging.service';
import { GiftStagingProcessingService } from './gift-staging-processing.service';
import { GiftModule } from '../gift/gift.module';
import { RecurringAgreementModule } from '../recurring-agreement/recurring-agreement.module';

@Module({
  imports: [forwardRef(() => GiftModule), RecurringAgreementModule],
  controllers: [GiftStagingController],
  providers: [GiftStagingService, GiftStagingProcessingService],
  exports: [GiftStagingService, GiftStagingProcessingService],
})
export class GiftStagingModule {}
