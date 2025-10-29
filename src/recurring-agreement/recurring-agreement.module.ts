import { Module } from '@nestjs/common';
import { RecurringAgreementController } from './recurring-agreement.controller';
import { RecurringAgreementService } from './recurring-agreement.service';
import { TwentyModule } from '../twenty/twenty.module';

@Module({
  imports: [TwentyModule],
  controllers: [RecurringAgreementController],
  providers: [RecurringAgreementService],
  exports: [RecurringAgreementService],
})
export class RecurringAgreementModule {}
