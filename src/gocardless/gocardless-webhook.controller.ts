import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { GoCardlessWebhookService } from './gocardless-webhook.service';

@Controller('webhooks/gocardless')
export class GoCardlessWebhookController {
  constructor(private readonly webhookService: GoCardlessWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  handleWebhook(@Body() body: unknown): { ok: true } {
    this.webhookService.handleWebhook(body);
    return { ok: true };
  }
}
