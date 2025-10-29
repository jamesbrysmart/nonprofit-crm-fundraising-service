import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GiftModule } from '../gift/gift.module';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';
import { RecurringAgreementModule } from '../recurring-agreement/recurring-agreement.module';

@Module({
  imports: [ConfigModule, GiftModule, RecurringAgreementModule],
  controllers: [StripeWebhookController],
  providers: [StripeWebhookService],
})
export class StripeModule {}
