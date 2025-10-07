import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  GiftStagingService,
  GiftStagingListResult,
  GiftStagingListQuery,
  GiftStagingStatusUpdate,
} from './gift-staging.service';
import {
  GiftStagingProcessingService,
  ProcessGiftArgs,
  ProcessGiftResult,
} from './gift-staging-processing.service';

@Controller('gift-staging')
export class GiftStagingController {
  constructor(
    private readonly giftStagingService: GiftStagingService,
    private readonly giftStagingProcessingService: GiftStagingProcessingService,
  ) {}

  @Get()
  async listGiftStaging(
    @Query() query: Record<string, string | string[] | undefined>,
  ): Promise<GiftStagingListResult> {
    this.ensureEnabled();

    const normalizedQuery: GiftStagingListQuery = {
      statuses: this.toArray(query.status ?? query.statuses),
      intakeSources: this.toArray(query.intakeSource ?? query.intakeSources),
      search: this.toOptionalString(query.search),
      cursor: this.toOptionalString(query.cursor),
      limit: this.toOptionalNumber(query.limit),
      sort: this.toOptionalString(query.sort),
    };

    return this.giftStagingService.listGiftStaging(normalizedQuery);
  }

  @Post(':id/process')
  async processGift(@Param('id') stagingId: string): Promise<ProcessGiftResult> {
    this.ensureEnabled();

    const args: ProcessGiftArgs = {
      stagingId,
    };

    return this.giftStagingProcessingService.processGift(args);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') stagingId: string,
    @Body() body: GiftStagingStatusUpdate,
  ): Promise<{ ok: true }> {
    this.ensureEnabled();

    await this.giftStagingService.updateStatusById(stagingId, body ?? {});
    return { ok: true };
  }

  private ensureEnabled(): void {
    if (!this.giftStagingService.isEnabled()) {
      throw new ServiceUnavailableException('Gift staging is disabled');
    }
  }

  private toOptionalNumber(value: string | string[] | undefined): number | undefined {
    const parsed = this.toOptionalString(value);
    if (!parsed) {
      return undefined;
    }

    const num = Number.parseInt(parsed, 10);
    return Number.isFinite(num) ? num : undefined;
  }

  private toOptionalString(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return undefined;
      }
      return value[0]?.trim() || undefined;
    }
    if (typeof value !== 'string') {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private toArray(value: string | string[] | undefined): string[] | undefined {
    if (!value) {
      return undefined;
    }
    const source = Array.isArray(value) ? value : [value];
    const normalized = source
      .flatMap((entry) => entry.split(','))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    return normalized.length > 0 ? normalized : undefined;
  }
}
