import { Module } from '@nestjs/common';
import { GoCardlessWebhookController } from './gocardless-webhook.controller';
import { GoCardlessWebhookService } from './gocardless-webhook.service';
import { LoggingModule } from '../logging/logging.module';

@Module({
  imports: [LoggingModule],
  controllers: [GoCardlessWebhookController],
  providers: [GoCardlessWebhookService],
})
export class GoCardlessModule {}
