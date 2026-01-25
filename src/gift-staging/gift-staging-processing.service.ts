import { BadRequestException, Injectable } from '@nestjs/common';
import { StructuredLoggerService } from '../logging/structured-logger.service';
import {
  GiftStagingService,
  GiftStagingStatusUpdate,
} from './gift-staging.service';
import type { GiftStagingRecordModel } from './gift-staging.service';
import { TwentyApiService } from '../twenty/twenty-api.service';
import {
  buildTwentyGiftPayload,
  extractCreateGiftId,
} from '../gift/gift-payload.util';
import { ensureCreateGiftResponse } from '../gift/gift.validation';
import type { NormalizedGiftCreatePayload } from '../gift/gift.types';
import { RecurringAgreementService } from '../recurring-agreement/recurring-agreement.service';
import { ReceiptPolicyService } from '../receipt/receipt-policy.service';

export interface ProcessGiftArgs {
  stagingId: string;
}

export type ProcessGiftDeferredReason =
  | 'not_ready'
  | 'locked'
  | 'missing_payload';

export type ProcessGiftErrorReason =
  | 'fetch_failed'
  | 'payload_invalid'
  | 'gift_api_failed';

export type ProcessGiftResult =
  | { status: 'committed'; giftId: string; stagingId: string }
  | { status: 'deferred'; stagingId: string; reason: ProcessGiftDeferredReason }
  | { status: 'error'; stagingId: string; error: ProcessGiftErrorReason };

@Injectable()
export class GiftStagingProcessingService {
  private readonly logContext = GiftStagingProcessingService.name;

  constructor(
    private readonly giftStagingService: GiftStagingService,
    private readonly twentyApiService: TwentyApiService,
    private readonly structuredLogger: StructuredLoggerService,
    private readonly recurringAgreementService: RecurringAgreementService,
    private readonly receiptPolicyService: ReceiptPolicyService,
  ) {}

  async processGift(args: ProcessGiftArgs): Promise<ProcessGiftResult> {
    if (
      !args ||
      typeof args.stagingId !== 'string' ||
      args.stagingId.trim().length === 0
    ) {
      throw new BadRequestException('stagingId is required');
    }

    const stagingId = args.stagingId.trim();

    const stagingRecord =
      await this.giftStagingService.getGiftStagingById(stagingId);
    if (!stagingRecord) {
      this.structuredLogger.warn(
        'Gift staging record not found or fetch failed',
        {
          event: 'gift_staging_process_missing',
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
        'Staging record locked by active processing',
        {
          event: 'gift_staging_process_locked',
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

    if (!this.canProcess(stagingRecord)) {
      this.structuredLogger.info(
        'Staging record not ready for processing',
        {
          event: 'gift_staging_process_not_ready',
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
          event: 'gift_staging_process_missing_payload',
          stagingId,
        },
        this.logContext,
      );
      await this.setProcessingError(
        stagingId,
        'Staging record missing raw payload',
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
          event: 'gift_staging_process_payload_parse_failed',
          stagingId,
        },
        this.logContext,
      );
      await this.setProcessingError(
        stagingId,
        'Failed to parse staging raw payload',
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
          event: 'gift_staging_process_payload_invalid',
          stagingId,
        },
        this.logContext,
      );
      await this.setProcessingError(
        stagingId,
        'Staging payload missing required fields for gift creation',
      );
      return {
        status: 'error',
        stagingId,
        error: 'payload_invalid',
      };
    }

    await this.updateProcessingStatus(stagingId, {
      promotionStatus: 'committing',
    });

    const enrichedPayload =
      this.receiptPolicyService.applyReceiptMetadata(parsedPayload);

    const requestBody = buildTwentyGiftPayload(enrichedPayload);

    let createGiftResponse: unknown;
    try {
      this.structuredLogger.info(
        'Creating gift from staging record',
        {
          event: 'gift_staging_process_call_create',
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
      const message = error instanceof Error ? error.message : String(error);
      await this.setProcessingError(
        stagingId,
        message || 'Failed to create gift in Twenty',
      );
      this.structuredLogger.error(
        'Failed to create gift in Twenty during processing',
        {
          event: 'gift_staging_process_create_failed',
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
      const message =
        error instanceof Error
          ? error.message
          : 'Create gift response failed validation';
      await this.setProcessingError(stagingId, message);
      this.structuredLogger.warn(
        'Create gift response failed validation',
        {
          event: 'gift_staging_process_create_response_invalid',
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
          event: 'gift_staging_process_missing_gift_id',
          stagingId,
        },
        this.logContext,
      );
      await this.setProcessingError(
        stagingId,
        'Create gift response missing gift id',
      );
      return {
        status: 'error',
        stagingId,
        error: 'gift_api_failed',
      };
    }

    await this.giftStagingService.markCommittedById(stagingId, giftId);

    const agreementId = stagingRecord.recurringAgreementId;
    if (agreementId) {
      const nextExpectedAt = this.calculateNextExpectedAt(stagingRecord);
      try {
        await this.recurringAgreementService.updateAgreement(agreementId, {
          nextExpectedAt,
          status: 'active',
        });
      } catch (error) {
        this.structuredLogger.warn(
          'Failed to update recurring agreement after staging promotion',
          {
            event: 'gift_staging_recurring_update_failed',
            stagingId,
            giftId,
            recurringAgreementId: agreementId,
            errorMessage:
              error instanceof Error ? error.message : String(error),
          },
          this.logContext,
        );
      }
    }

    return {
      status: 'committed',
      stagingId,
      giftId,
    };
  }

  private handleAlreadyCommitted(
    stagingRecord: GiftStagingRecordModel,
  ): { status: 'committed'; giftId: string } | undefined {
    if (stagingRecord.promotionStatus !== 'committed') {
      return undefined;
    }

    if (
      typeof stagingRecord.giftId === 'string' &&
      stagingRecord.giftId.trim().length > 0
    ) {
      this.structuredLogger.info(
        'Staging record already committed',
        {
          event: 'gift_staging_process_already_committed',
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
        event: 'gift_staging_process_committed_missing_gift',
        stagingId: stagingRecord.id,
      },
      this.logContext,
    );
    return undefined;
  }

  private async setProcessingError(
    stagingId: string,
    errorDetail: string,
  ): Promise<void> {
    await this.updateProcessingStatus(stagingId, {
      promotionStatus: 'commit_failed',
      errorDetail,
    });
  }

  private async updateProcessingStatus(
    stagingId: string,
    updates: GiftStagingStatusUpdate,
  ): Promise<void> {
    try {
      await this.giftStagingService.updateStatusById(stagingId, updates);
    } catch (error) {
      this.structuredLogger.warn(
        'Failed to update gift staging status',
        {
          event: 'gift_staging_process_status_update_failed',
          stagingId,
          updates,
          message: error instanceof Error ? error.message : String(error),
        },
        this.logContext,
      );
    }
  }

  private canProcess(stagingRecord: GiftStagingRecordModel): boolean {
    const promotionStatus = stagingRecord.promotionStatus ?? 'pending';
    const eligibleStatuses = new Set(['ready_for_commit', 'commit_failed']);
    // Ready/commit_failed are the only gates; we don’t block on dedupe/validation
    // because “Mark ready” is the reviewer’s explicit signal to proceed.
    return eligibleStatuses.has(promotionStatus);
  }

  private parseRawPayload(
    rawPayload: string,
  ): NormalizedGiftCreatePayload | undefined {
    try {
      const parsed: unknown = JSON.parse(rawPayload);
      if (this.isPlainObject(parsed)) {
        return parsed as NormalizedGiftCreatePayload;
      }
    } catch {
      return undefined;
    }

    return undefined;
  }

  private calculateNextExpectedAt(
    stagingRecord: GiftStagingRecordModel,
  ): string | undefined {
    // If the staging record carries an explicit expectedAt (from provider schedule), honour it.
    if (
      typeof stagingRecord.expectedAt === 'string' &&
      stagingRecord.expectedAt.trim().length > 0
    ) {
      return stagingRecord.expectedAt.trim();
    }

    // Fallback: add one month to the posted date to keep the agreement moving forward.
    const referenceDate = stagingRecord.giftDate ?? stagingRecord.createdAt;
    if (!referenceDate) {
      return undefined;
    }

    const parsedDate = new Date(referenceDate);
    if (Number.isNaN(parsedDate.valueOf())) {
      return undefined;
    }

    parsedDate.setUTCMonth(parsedDate.getUTCMonth() + 1);
    return parsedDate.toISOString().slice(0, 10);
  }

  private isValidPreparedPayload(
    payload: NormalizedGiftCreatePayload,
  ): boolean {
    if (!this.isPlainObject(payload.amount)) {
      return false;
    }

    const amount = payload.amount as Record<string, unknown>;
    const currencyCode = amount.currencyCode;
    const amountMicros = amount.amountMicros;

    const hasDonor =
      typeof payload.donorId === 'string' && payload.donorId.trim().length > 0;
    const hasCompany =
      typeof payload.companyId === 'string' &&
      payload.companyId.trim().length > 0;

    return (
      (hasDonor || hasCompany) &&
      typeof currencyCode === 'string' &&
      currencyCode.trim().length > 0 &&
      typeof amountMicros === 'number' &&
      Number.isFinite(amountMicros)
    );
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
