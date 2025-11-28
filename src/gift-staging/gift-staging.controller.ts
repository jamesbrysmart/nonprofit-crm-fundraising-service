import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Inject,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  ServiceUnavailableException,
  forwardRef,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  GiftStagingService,
  GiftStagingListResult,
  GiftStagingListQuery,
  GiftStagingStatusUpdate,
  GiftStagingUpdateInput,
} from './gift-staging.service';
import {
  GiftStagingProcessingService,
  ProcessGiftArgs,
  ProcessGiftResult,
} from './gift-staging-processing.service';
import { GiftService } from '../gift/gift.service';
import { GiftStagingListQueryDto } from './dtos/gift-staging-list.dto';
import { GiftStagingRecordModel } from './gift-staging.service';

interface GiftStagingCreateResponse {
  data: {
    giftStaging: {
      id: string;
      autoPromote: boolean;
      promotionStatus: string;
      validationStatus: string;
      dedupeStatus: string;
    };
  };
  meta: {
    stagedOnly: boolean;
    rawPayload?: string;
    rawPayloadAvailable: boolean;
  };
}

type GiftStagingUpdateRequest = GiftStagingUpdateInput;

@Controller('gift-staging')
export class GiftStagingController {
  constructor(
    private readonly giftStagingService: GiftStagingService,
    private readonly giftStagingProcessingService: GiftStagingProcessingService,
    @Inject(forwardRef(() => GiftService))
    private readonly giftService: GiftService,
  ) {}

  @Get()
  async listGiftStaging(
    @Query() query: Record<string, string | string[] | undefined>,
  ): Promise<GiftStagingListResult> {
    this.ensureEnabled();

    const mergedQuery = {
      ...query,
      statuses: query.statuses ?? query.status,
      intakeSources: query.intakeSources ?? query.intakeSource,
      giftBatchId: query.giftBatchId ?? query.batchId,
      minAmountMinor: query.minAmountMinor ?? query.minAmount,
      maxAmountMinor: query.maxAmountMinor ?? query.maxAmount,
    };

    const dto = plainToInstance(GiftStagingListQueryDto, mergedQuery, {
      enableImplicitConversion: true,
    });

    const validationErrors = validateSync(dto, {
      skipMissingProperties: true,
      whitelist: true,
      forbidUnknownValues: false,
    });

    if (validationErrors.length > 0) {
      throw new BadRequestException('Invalid list query parameters');
    }

    const normalizedQuery: GiftStagingListQuery = {
      statuses: dto.statuses,
      intakeSources: dto.intakeSources,
      search: dto.search,
      cursor: dto.cursor,
      limit: dto.limit,
      sort: dto.sort,
      recurringAgreementId: dto.recurringAgreementId,
    };

    return this.giftStagingService.listGiftStaging(normalizedQuery);
  }

  @Get(':id')
  async getGiftStaging(
    @Param('id') stagingId: string,
  ): Promise<{ data: { giftStaging: GiftStagingRecordModel } }> {
    this.ensureEnabled();

    const entity = await this.giftStagingService.getGiftStagingById(stagingId);
    if (!entity) {
      throw new NotFoundException('Gift staging record not found');
    }

    return {
      data: {
        giftStaging: entity,
      },
    };
  }

  @Post()
  async createGiftStaging(
    @Body() body: unknown,
  ): Promise<GiftStagingCreateResponse> {
    this.ensureEnabled();

    const normalizedPayload = await this.giftService.normalizeCreateGiftPayload(
      body ?? {},
    );
    normalizedPayload.autoPromote = false;

    const stagedRecord =
      await this.giftStagingService.stageGift(normalizedPayload);
    if (!stagedRecord) {
      throw new InternalServerErrorException(
        'Failed to create gift staging record',
      );
    }

    const stagingEntity = await this.giftStagingService.getGiftStagingById(
      stagedRecord.id,
    );

    const promotionStatus =
      stagingEntity?.promotionStatus?.trim() ??
      stagedRecord.promotionStatus ??
      (stagedRecord.autoPromote ? 'committing' : 'pending');

    const validationStatus = stagingEntity?.validationStatus ?? 'pending';
    const dedupeStatus = stagingEntity?.dedupeStatus ?? 'pending';
    const rawPayload = stagingEntity?.rawPayload;

    return {
      data: {
        giftStaging: {
          id: stagedRecord.id,
          autoPromote: stagedRecord.autoPromote,
          promotionStatus,
          validationStatus,
          dedupeStatus,
        },
      },
      meta: {
        stagedOnly: !stagedRecord.autoPromote,
        rawPayload,
        rawPayloadAvailable:
          typeof rawPayload === 'string' && rawPayload.length > 0,
      },
    };
  }

  @Post(':id/process')
  async processGift(
    @Param('id') stagingId: string,
  ): Promise<ProcessGiftResult> {
    this.ensureEnabled();

    const args: ProcessGiftArgs = {
      stagingId,
    };

    return this.giftStagingProcessingService.processGift(args);
  }

  @Patch(':id')
  async updateGiftStaging(
    @Param('id') stagingId: string,
    @Body() body: GiftStagingUpdateRequest,
  ): Promise<{ data: { giftStaging: GiftStagingRecordModel } }> {
    this.ensureEnabled();

    const entity = await this.giftStagingService.updateGiftStagingPayload(
      stagingId,
      body ?? {},
    );
    if (!entity) {
      throw new NotFoundException('Gift staging record not found');
    }

    return {
      data: {
        giftStaging: entity,
      },
    };
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
}
