import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { StripeWebhookService } from './stripe-webhook.service';

@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(private readonly stripeWebhookService: StripeWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | string[] | undefined,
  ): Promise<void> {
    const rawBody = (req as RawBodyRequest<Request> & { rawBody?: Buffer })
      .rawBody;
    await this.stripeWebhookService.handleIncomingEvent({
      signature,
      rawBody,
      parsedBody: req.body,
    });
  }
}
