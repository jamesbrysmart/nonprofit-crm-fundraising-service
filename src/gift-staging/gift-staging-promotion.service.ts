import { BadRequestException, Injectable } from '@nestjs/common';
import { StructuredLoggerService } from '../logging/structured-logger.service';
import { GiftStagingService, GiftStagingEntity } from './gift-staging.service';
import { TwentyApiService } from '../twenty/twenty-api.service';
import { buildTwentyGiftPayload, extractCreateGiftId } from '../gift/gift-payload.util';
import { ensureCreateGiftResponse } from '../gift/gift.validation';
import type { NormalizedGiftCreatePayload } from '../gift/gift.types';

export interface PromoteGiftArgs {
  stagingId: string;
}

export type PromoteGiftDeferredReason = 'not_ready' | 'locked' | 'missing_payload';

export type PromoteGiftErrorReason = 'fetch_failed' | 'payload_invalid' | 'gift_api_failed';

export type PromoteGiftResult =
  | { status: 'committed'; giftId: string; stagingId: string }
  | { status: 'deferred'; stagingId: string; reason: PromoteGiftDeferredReason }
  | { status: 'error'; stagingId: string; error: PromoteGiftErrorReason };

@Injectable()
export class GiftStagingPromotionService {
  private readonly logContext = GiftStagingPromotionService.name;

  constructor(
    private readonly giftStagingService: GiftStagingService,
    private readonly twentyApiService: TwentyApiService,
    private readonly structuredLogger: StructuredLoggerService,
  ) {}

  async promoteGift(args: PromoteGiftArgs): Promise<PromoteGiftResult> {
    if (!args || typeof args.stagingId !== 'string' || args.stagingId.trim().length === 0) {
      throw new BadRequestException('stagingId is required');
    }

    const stagingId = args.stagingId.trim();

    const stagingRecord = await this.giftStagingService.getGiftStagingById(stagingId);
    if (!stagingRecord) {
      this.structuredLogger.warn(
        'Gift staging record not found or fetch failed',
        {
          event: 'gift_staging_promote_missing',
          stagingId,
        },
        this.logContext,
      );
      return {
        status: 'error',
        stagingId,
        error: 'fetch_failed',
      };
    }

    const committedResult = this.handleAlreadyCommitted(stagingRecord);
    if (committedResult) {
      return { ...committedResult, stagingId };
    }

    if (stagingRecord.promotionStatus === 'committing') {
      this.structuredLogger.info(
        'Staging record locked by active promotion',
        {
          event: 'gift_staging_promote_locked',
          stagingId,
        },
        this.logContext,
      );
      return {
        status: 'deferred',
        stagingId,
        reason: 'locked',
      };
    }

    if (!this.canPromote(stagingRecord)) {
      this.structuredLogger.info(
        'Staging record not ready for promotion',
        {
          event: 'gift_staging_promote_not_ready',
          stagingId,
          promotionStatus: stagingRecord.promotionStatus,
          validationStatus: stagingRecord.validationStatus,
          dedupeStatus: stagingRecord.dedupeStatus,
        },
        this.logContext,
      );
      return {
        status: 'deferred',
        stagingId,
        reason: 'not_ready',
      };
    }

    if (!stagingRecord.rawPayload) {
      this.structuredLogger.warn(
        'Staging record missing raw payload',
        {
          event: 'gift_staging_promote_missing_payload',
          stagingId,
        },
        this.logContext,
      );
      return {
        status: 'deferred',
        stagingId,
        reason: 'missing_payload',
      };
    }

    const parsedPayload = this.parseRawPayload(stagingRecord.rawPayload);
    if (!parsedPayload) {
      this.structuredLogger.warn(
        'Failed to parse staging raw payload',
        {
          event: 'gift_staging_promote_payload_parse_failed',
          stagingId,
        },
        this.logContext,
      );
      return {
        status: 'deferred',
        stagingId,
        reason: 'missing_payload',
      };
    }

    if (!this.isValidPreparedPayload(parsedPayload)) {
      this.structuredLogger.warn(
        'Parsed staging payload missing required fields',
        {
          event: 'gift_staging_promote_payload_invalid',
          stagingId,
        },
        this.logContext,
      );
      return {
        status: 'error',
        stagingId,
        error: 'payload_invalid',
      };
    }

    const requestBody = buildTwentyGiftPayload(parsedPayload);

    let createGiftResponse: unknown;
    try {
      this.structuredLogger.info(
        'Creating gift from staging record',
        {
          event: 'gift_staging_promote_call_create',
          stagingId,
          giftBatchId: stagingRecord.giftBatchId,
        },
        this.logContext,
      );

      createGiftResponse = await this.twentyApiService.request(
        'POST',
        '/gifts',
        requestBody,
        this.logContext,
      );
    } catch (error) {
      this.structuredLogger.error(
        'Failed to create gift in Twenty during promotion',
        {
          event: 'gift_staging_promote_create_failed',
          stagingId,
        },
        this.logContext,
        error instanceof Error ? error : undefined,
      );
      return {
        status: 'error',
        stagingId,
        error: 'gift_api_failed',
      };
    }

    try {
      ensureCreateGiftResponse(createGiftResponse);
    } catch (error) {
      this.structuredLogger.warn(
        'Create gift response failed validation',
        {
          event: 'gift_staging_promote_create_response_invalid',
          stagingId,
        },
        this.logContext,
      );
      return {
        status: 'error',
        stagingId,
        error: 'gift_api_failed',
      };
    }

    const giftId = extractCreateGiftId(createGiftResponse);
    if (!giftId) {
      this.structuredLogger.warn(
        'Create gift response missing gift id',
        {
          event: 'gift_staging_promote_missing_gift_id',
          stagingId,
        },
        this.logContext,
      );
      return {
        status: 'error',
        stagingId,
        error: 'gift_api_failed',
      };
    }

    await this.giftStagingService.markCommittedById(stagingId, giftId);

    return {
      status: 'committed',
      stagingId,
      giftId,
    };
  }

  private handleAlreadyCommitted(
    stagingRecord: GiftStagingEntity,
  ): { status: 'committed'; giftId: string } | undefined {
    if (stagingRecord.promotionStatus !== 'committed') {
      return undefined;
    }

    if (typeof stagingRecord.giftId === 'string' && stagingRecord.giftId.trim().length > 0) {
      this.structuredLogger.info(
        'Staging record already committed',
        {
          event: 'gift_staging_promote_already_committed',
          stagingId: stagingRecord.id,
          giftId: stagingRecord.giftId,
        },
        this.logContext,
      );
      return {
        status: 'committed',
        giftId: stagingRecord.giftId,
      };
    }

    this.structuredLogger.warn(
      'Staging record marked committed but missing gift id',
      {
        event: 'gift_staging_promote_committed_missing_gift',
        stagingId: stagingRecord.id,
      },
      this.logContext,
    );
    return undefined;
  }

  private canPromote(stagingRecord: GiftStagingEntity): boolean {
    const promotionStatus = stagingRecord.promotionStatus ?? 'pending';
    const eligibleStatuses = new Set(['ready_for_commit', 'commit_failed']);

    const validationPassed = stagingRecord.validationStatus === 'passed';
    const dedupePassed = stagingRecord.dedupeStatus === 'passed';

    return validationPassed && dedupePassed && eligibleStatuses.has(promotionStatus);
  }

  private parseRawPayload(rawPayload: string): NormalizedGiftCreatePayload | undefined {
    try {
      const parsed = JSON.parse(rawPayload);
      if (this.isPlainObject(parsed)) {
        return parsed as NormalizedGiftCreatePayload;
      }
    } catch (error) {
      return undefined;
    }

    return undefined;
  }

  private isValidPreparedPayload(payload: NormalizedGiftCreatePayload): boolean {
    if (!this.isPlainObject(payload.amount)) {
      return false;
    }

    const amount = payload.amount as Record<string, unknown>;
    const currencyCode = amount.currencyCode;
    const value = amount.value;

    return (
      typeof payload.amountMinor === 'number' &&
      Number.isFinite(payload.amountMinor) &&
      typeof payload.currency === 'string' &&
      payload.currency.trim().length > 0 &&
      typeof payload.donorId === 'string' &&
      payload.donorId.trim().length > 0 &&
      typeof currencyCode === 'string' &&
      currencyCode.trim().length > 0 &&
      typeof value === 'number' &&
      Number.isFinite(value)
    );
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
