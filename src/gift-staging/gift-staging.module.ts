import { Module, forwardRef } from '@nestjs/common';
import { GiftStagingController } from './gift-staging.controller';
import { GiftStagingService } from './gift-staging.service';
import { GiftStagingProcessingService } from './gift-staging-processing.service';
import { GiftModule } from '../gift/gift.module';
import { RecurringAgreementModule } from '../recurring-agreement/recurring-agreement.module';
import { ReceiptModule } from '../receipt/receipt.module';
import { GiftStagingApiClient } from './api-client/gift-staging.api-client';

@Module({
  imports: [
    forwardRef(() => GiftModule),
    RecurringAgreementModule,
    ReceiptModule,
  ],
  controllers: [GiftStagingController],
  providers: [
    GiftStagingService,
    GiftStagingProcessingService,
    GiftStagingApiClient,
  ],
  exports: [GiftStagingService, GiftStagingProcessingService],
})
export class GiftStagingModule {}
