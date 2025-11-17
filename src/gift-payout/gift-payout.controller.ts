import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { GiftPayoutService } from './gift-payout.service';

interface GiftIdPayload {
  giftIds?: string[];
}

@Controller('gift-payouts')
export class GiftPayoutController {
  constructor(private readonly giftPayoutService: GiftPayoutService) {}

  @Post()
  create(@Body() payload: unknown): Promise<unknown> {
    return this.giftPayoutService.createGiftPayout(payload);
  }

  @Get()
  list(@Query() query: Record<string, unknown>): Promise<unknown> {
    return this.giftPayoutService.listGiftPayouts(query ?? {});
  }

  @Get(':id')
  getById(
    @Param('id') payoutId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<unknown> {
    return this.giftPayoutService.getGiftPayout(payoutId, query ?? {});
  }

  @Patch(':id')
  update(
    @Param('id') payoutId: string,
    @Body() payload: unknown,
  ): Promise<unknown> {
    return this.giftPayoutService.updateGiftPayout(payoutId, payload);
  }

  @Post(':id/gifts/link')
  linkGifts(
    @Param('id') payoutId: string,
    @Body() payload: GiftIdPayload,
  ): Promise<{ linkedGiftIds: string[] }> {
    return this.giftPayoutService.linkGifts(payoutId, payload);
  }

  @Post(':id/gifts/unlink')
  unlinkGifts(
    @Param('id') payoutId: string,
    @Body() payload: GiftIdPayload,
  ): Promise<{ unlinkedGiftIds: string[] }> {
    return this.giftPayoutService.unlinkGifts(payoutId, payload);
  }
}
