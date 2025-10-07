import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StructuredLoggerService } from '../logging/structured-logger.service';
import { TwentyApiService } from '../twenty/twenty-api.service';
import { GiftStagingRecord, NormalizedGiftCreatePayload } from '../gift/gift.types';

export interface GiftStagingEntity {
  id: string;
  promotionStatus?: string;
  validationStatus?: string;
  dedupeStatus?: string;
  rawPayload?: string;
  giftId?: string;
  autoPromote?: boolean;
  giftBatchId?: string;
}

export interface GiftStagingStatusUpdate {
  promotionStatus?: string;
  validationStatus?: string;
  dedupeStatus?: string;
  errorDetail?: string;
  rawPayload?: string;
  giftBatchId?: string;
}

interface GiftStagingCreateResponse {
  data?: {
    createGiftStaging?: {
      id?: string;
      autoPromote?: boolean;
      promotionStatus?: string;
    };
  };
}

@Injectable()
export class GiftStagingService {
  private readonly enabled: boolean;
  private readonly autoPromoteDefault: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly structuredLogger: StructuredLoggerService,
    private readonly twentyApiService: TwentyApiService,
  ) {
    this.enabled = this.resolveBooleanFlag(
      this.configService.get<string>('FUNDRAISING_ENABLE_GIFT_STAGING'),
      false,
    );
    this.autoPromoteDefault = this.resolveBooleanFlag(
      this.configService.get<string>('FUNDRAISING_STAGING_AUTO_PROMOTE_DEFAULT'),
      true,
    );
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async stageGift(payload: NormalizedGiftCreatePayload): Promise<GiftStagingRecord | undefined> {
    if (!this.enabled) {
      return undefined;
    }

    const autoPromote =
      typeof payload.autoPromote === 'boolean' ? payload.autoPromote : this.autoPromoteDefault;

    const requestBody = this.buildCreatePayload(payload, autoPromote);

    try {
      const response = (await this.twentyApiService.request(
        'POST',
        '/giftStagings',
        requestBody,
        GiftStagingService.name,
      )) as GiftStagingCreateResponse;

      const created = response?.data?.createGiftStaging;
      const stagingId = created?.id;
      const resolvedAutoPromote =
        typeof created?.autoPromote === 'boolean' ? created.autoPromote : autoPromote;
      const resolvedPromotionStatus =
        typeof created?.promotionStatus === 'string' && created.promotionStatus.trim().length > 0
          ? created.promotionStatus
          : resolvedAutoPromote
            ? 'committing'
            : 'pending';

      if (!stagingId) {
        this.structuredLogger.warn(
          'Gift staging create response missing id',
          {
            event: 'gift_staging_stage_missing_id',
            autoPromote: resolvedAutoPromote,
          },
          GiftStagingService.name,
        );
        return undefined;
      }

      this.structuredLogger.info(
        'Staged gift payload',
        {
          event: 'gift_staging_stage',
          stagingId,
          autoPromote: resolvedAutoPromote,
          promotionStatus: resolvedPromotionStatus,
          source: requestBody.intakeSource,
          externalId: requestBody.externalId,
        },
        GiftStagingService.name,
      );

      return {
        id: stagingId,
        autoPromote: resolvedAutoPromote,
        promotionStatus: resolvedPromotionStatus,
        payload,
      };
    } catch (error) {
      this.structuredLogger.warn(
        'Failed to create gift staging record',
        {
          event: 'gift_staging_stage_failed',
          message: error instanceof Error ? error.message : String(error),
        },
        GiftStagingService.name,
      );
      return undefined;
    }
  }

  async getGiftStagingById(stagingId: string): Promise<GiftStagingEntity | undefined> {
    if (typeof stagingId !== 'string' || stagingId.trim().length === 0) {
      return undefined;
    }

    try {
      const response = await this.twentyApiService.request(
        'GET',
        `/giftStagings/${encodeURIComponent(stagingId)}`,
        undefined,
        GiftStagingService.name,
      );

      const entity = this.extractGiftStagingFromResponse(response);
      if (!entity) {
        this.structuredLogger.warn(
          'Gift staging get response missing giftStaging',
          {
            event: 'gift_staging_get_missing',
            stagingId,
          },
          GiftStagingService.name,
        );
        return undefined;
      }

      return entity;
    } catch (error) {
      this.structuredLogger.warn(
        'Failed to fetch gift staging record',
        {
          event: 'gift_staging_get_failed',
          stagingId,
          message: error instanceof Error ? error.message : String(error),
        },
        GiftStagingService.name,
      );
      return undefined;
    }
  }

  async markCommitted(record: GiftStagingRecord | undefined, giftId: string): Promise<void> {
    if (!this.enabled || !record?.id) {
      return;
    }

    await this.markCommittedById(record.id, giftId);
  }

  async markCommittedById(stagingId: string, giftId: string): Promise<void> {
    if (!this.enabled || typeof stagingId !== 'string' || stagingId.trim().length === 0) {
      return;
    }

    await this.patchCommitted(stagingId, giftId);
  }

  async updateStatusById(
    stagingId: string,
    updates: GiftStagingStatusUpdate,
  ): Promise<void> {
    if (!this.enabled || typeof stagingId !== 'string' || stagingId.trim().length === 0) {
      return;
    }

    let resolvedUpdates = { ...updates };

    if (resolvedUpdates.rawPayload === undefined) {
      const existing = await this.getGiftStagingById(stagingId);
      if (existing?.rawPayload) {
        resolvedUpdates.rawPayload = existing.rawPayload;
      }
    }

    const payload = this.pruneUndefinedValues({
      promotionStatus: resolvedUpdates.promotionStatus,
      validationStatus: resolvedUpdates.validationStatus,
      dedupeStatus: resolvedUpdates.dedupeStatus,
      errorDetail: resolvedUpdates.errorDetail,
      rawPayload: resolvedUpdates.rawPayload,
      giftBatchId: resolvedUpdates.giftBatchId,
    });

    if (Object.keys(payload).length === 0) {
      return;
    }

    await this.twentyApiService.request(
      'PATCH',
      `/giftStagings/${encodeURIComponent(stagingId)}`,
      payload,
      GiftStagingService.name,
    );
  }

  private async patchCommitted(stagingId: string, giftId: string): Promise<void> {
    try {
      await this.twentyApiService.request(
        'PATCH',
        `/giftStagings/${encodeURIComponent(stagingId)}`,
        {
          promotionStatus: 'committed',
          validationStatus: 'passed',
          dedupeStatus: 'passed',
          giftId,
        },
        GiftStagingService.name,
      );

      this.structuredLogger.info(
        'Gift staging record committed',
        {
          event: 'gift_staging_committed',
          stagingId,
          giftId,
        },
        GiftStagingService.name,
      );
    } catch (error) {
      this.structuredLogger.warn(
        'Failed to update gift staging record after commit',
        {
          event: 'gift_staging_commit_failed',
          stagingId,
          giftId,
          message: error instanceof Error ? error.message : String(error),
        },
        GiftStagingService.name,
      );
    }
  }

  private resolveBooleanFlag(value: string | undefined, fallback: boolean): boolean {
    if (typeof value !== 'string') {
      return fallback;
    }

    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
      return false;
    }
    return fallback;
  }

  private extractGiftStagingFromResponse(response: unknown): GiftStagingEntity | undefined {
    if (!this.isPlainObject(response)) {
      return undefined;
    }

    const data = response.data;
    if (!this.isPlainObject(data)) {
      return undefined;
    }

    const giftStaging = (data as Record<string, unknown>).giftStaging;
    if (!this.isPlainObject(giftStaging)) {
      return undefined;
    }

    const record = giftStaging as Record<string, unknown>;
    const id = record.id;
    if (typeof id !== 'string' || id.trim().length === 0) {
      return undefined;
    }

    const entity: GiftStagingEntity = {
      id,
    };

    if (typeof record.promotionStatus === 'string') {
      entity.promotionStatus = record.promotionStatus;
    }
    if (typeof record.validationStatus === 'string') {
      entity.validationStatus = record.validationStatus;
    }
    if (typeof record.dedupeStatus === 'string') {
      entity.dedupeStatus = record.dedupeStatus;
    }
    if (typeof record.rawPayload === 'string') {
      entity.rawPayload = record.rawPayload;
    } else if (record.rawPayload && typeof record.rawPayload === 'object') {
      try {
        entity.rawPayload = JSON.stringify(record.rawPayload);
      } catch (error) {
        this.structuredLogger.warn(
          'Failed to stringify rawPayload when extracting gift staging',
          {
            event: 'gift_staging_extract_raw_payload_failed',
            stagingId: id,
          },
          GiftStagingService.name,
        );
      }
    }
    if (typeof record.giftId === 'string') {
      entity.giftId = record.giftId;
    }
    if (typeof record.autoPromote === 'boolean') {
      entity.autoPromote = record.autoPromote;
    }
    if (typeof record.giftBatchId === 'string') {
      entity.giftBatchId = record.giftBatchId;
    }

    return entity;
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private buildCreatePayload(
    payload: NormalizedGiftCreatePayload,
    autoPromote: boolean,
  ): Record<string, unknown> {
    const promotionStatus = autoPromote ? 'committing' : 'pending';

    const rawPayload = this.safeStringify(payload);

    const body: Record<string, unknown> = {
      autoPromote,
      promotionStatus,
      validationStatus: 'pending',
      dedupeStatus: 'pending',
      intakeSource: payload.intakeSource,
      sourceFingerprint: payload.sourceFingerprint,
      source: payload.intakeSource,
      externalId: payload.externalId,
      amountMinor: payload.amountMinor,
      paymentMethod: payload.paymentMethod,
      dateReceived: payload.dateReceived ?? payload.giftDate,
      giftAidEligible: payload.giftAidEligible ?? false,
      fundId: payload.fundId,
      appealId: payload.appealId,
      appealSegmentId: payload.appealSegmentId,
      trackingCodeId: payload.trackingCodeId,
      contactId: payload.donorId,
      giftBatchId: payload.giftBatchId,
      rawPayload,
    };

    return this.pruneUndefinedValues(body);
  }

  private pruneUndefinedValues<T extends Record<string, unknown>>(input: T): T {
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined && value !== null && value !== '') {
        output[key] = value;
      }
    }
    return output as T;
  }

  private safeStringify(payload: NormalizedGiftCreatePayload): string {
    try {
      return JSON.stringify(payload);
    } catch (error) {
      this.structuredLogger.warn(
        'Failed to stringify gift payload for staging; falling back to empty object',
        {
          event: 'gift_staging_stringify_failed',
          message: error instanceof Error ? error.message : String(error),
        },
        GiftStagingService.name,
      );
      return '{}';
    }
  }
}
