import {
  Body,
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
import {
  GiftStagingService,
  GiftStagingEntity,
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

    const normalizedQuery: GiftStagingListQuery = {
      statuses: this.toArray(query.status ?? query.statuses),
      intakeSources: this.toArray(query.intakeSource ?? query.intakeSources),
      search: this.toOptionalString(query.search),
      cursor: this.toOptionalString(query.cursor),
      limit: this.toOptionalNumber(query.limit),
      sort: this.toOptionalString(query.sort),
      recurringAgreementId: this.toOptionalString(query.recurringAgreementId),
    };

    return this.giftStagingService.listGiftStaging(normalizedQuery);
  }

  @Get(':id')
  async getGiftStaging(
    @Param('id') stagingId: string,
  ): Promise<{ data: { giftStaging: GiftStagingEntity } }> {
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
  ): Promise<{ data: { giftStaging: GiftStagingEntity } }> {
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

  private toOptionalNumber(
    value: string | string[] | undefined,
  ): number | undefined {
    const parsed = this.toOptionalString(value);
    if (!parsed) {
      return undefined;
    }

    const num = Number.parseInt(parsed, 10);
    return Number.isFinite(num) ? num : undefined;
  }

  private toOptionalString(
    value: string | string[] | undefined,
  ): string | undefined {
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
