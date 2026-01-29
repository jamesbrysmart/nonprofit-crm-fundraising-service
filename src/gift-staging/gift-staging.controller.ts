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
import type { ProcessingDiagnostics } from '../gift/gift.types';
import { GiftStagingListQueryDto } from './dtos/gift-staging-list.dto';
import { GiftStagingRecordModel } from './gift-staging.service';

interface GiftStagingCreateResponse {
  data: {
    giftStaging: {
      id: string;
      autoProcess: boolean;
      processingStatus: string;
      validationStatus: string;
      dedupeStatus: string;
      processingDiagnostics?: ProcessingDiagnostics | Record<string, unknown>;
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

    const normalizedPayload =
      await this.giftService.normalizeCreateGiftStagingPayload(body ?? {});
    normalizedPayload.autoProcess = false;

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

    const processingStatus =
      stagingEntity?.processingStatus?.trim() ??
      stagedRecord.processingStatus ??
      (stagedRecord.autoProcess ? 'processing' : 'pending');

    const validationStatus = stagingEntity?.validationStatus ?? 'pending';
    const dedupeStatus = stagingEntity?.dedupeStatus ?? 'pending';
    const rawPayload = stagingEntity?.rawPayload;
    const processingDiagnostics =
      stagingEntity?.processingDiagnostics ??
      normalizedPayload.processingDiagnostics;

    return {
      data: {
        giftStaging: {
          id: stagedRecord.id,
          autoProcess: stagedRecord.autoProcess,
          processingStatus,
          validationStatus,
          dedupeStatus,
          processingDiagnostics,
        },
      },
      meta: {
        stagedOnly: !stagedRecord.autoProcess,
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
