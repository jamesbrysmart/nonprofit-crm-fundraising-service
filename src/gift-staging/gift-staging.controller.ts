import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GiftStagingService } from './gift-staging.service';
import {
  GiftStagingPromotionService,
  PromoteGiftArgs,
  PromoteGiftResult,
} from './gift-staging-promotion.service';
import type { GiftStagingStatusUpdate } from './gift-staging.service';

@Controller('gift-staging')
export class GiftStagingController {
  constructor(
    private readonly giftStagingService: GiftStagingService,
    private readonly giftStagingPromotionService: GiftStagingPromotionService,
  ) {}

  @Post(':id/promote')
  async promoteGift(@Param('id') stagingId: string): Promise<PromoteGiftResult> {
    if (!this.giftStagingService.isEnabled()) {
      throw new ServiceUnavailableException('Gift staging is disabled');
    }

    const args: PromoteGiftArgs = {
      stagingId,
    };

    return this.giftStagingPromotionService.promoteGift(args);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') stagingId: string,
    @Body() body: GiftStagingStatusUpdate,
  ): Promise<{ ok: true }> {
    if (!this.giftStagingService.isEnabled()) {
      throw new ServiceUnavailableException('Gift staging is disabled');
    }

    await this.giftStagingService.updateStatusById(stagingId, body ?? {});
    return { ok: true };
  }
}
