import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StructuredLoggerService } from '../logging/structured-logger.service';
import { TwentyApiService } from '../twenty/twenty-api.service';
import { GiftStagingRecord, NormalizedGiftCreatePayload } from '../gift/gift.types';

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
          promotionStatus: created?.promotionStatus,
          source: requestBody.intakeSource,
          externalId: requestBody.externalId,
        },
        GiftStagingService.name,
      );

      return {
        id: stagingId,
        autoPromote: resolvedAutoPromote,
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

  async markCommitted(record: GiftStagingRecord | undefined, giftId: string): Promise<void> {
    if (!this.enabled || !record?.id) {
      return;
    }

    try {
      await this.twentyApiService.request(
        'PATCH',
        `/giftStagings/${encodeURIComponent(record.id)}`,
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
          stagingId: record.id,
          giftId,
        },
        GiftStagingService.name,
      );
    } catch (error) {
      this.structuredLogger.warn(
        'Failed to update gift staging record after commit',
        {
          event: 'gift_staging_commit_failed',
          stagingId: record.id,
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
