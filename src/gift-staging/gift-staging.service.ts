import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ConfigService } from '@nestjs/config';
import { StructuredLoggerService } from '../logging/structured-logger.service';
import { TwentyApiService } from '../twenty/twenty-api.service';
import {
  GiftStagingRecord,
  NormalizedGiftCreatePayload,
} from '../gift/gift.types';
import { validateSync } from 'class-validator';
import { GiftStagingListQueryDto } from './dtos/gift-staging-list.dto';
import { GiftStagingRecordModel } from './domain/staging-record.model';
import { GiftStagingApiClient } from './api-client/gift-staging.api-client';
import { mergePayloadForUpdate } from './utils/payload-merger.util';
import { extractReceiptMeta } from './utils/receipt-extractor.util';
import { mapCreateGiftStagingPayload } from './mappers/domain-to-twenty.mapper';
import { CreateGiftStagingDto } from './dtos/create-gift-staging.dto';

export { GiftStagingRecordModel } from './domain/staging-record.model';

export interface GiftStagingStatusUpdate {
  promotionStatus?: string;
  validationStatus?: string;
  dedupeStatus?: string;
  errorDetail?: string;
  rawPayload?: string;
  giftBatchId?: string;
}

export interface GiftStagingUpdateInput {
  donorId?: string | null;
  companyId?: string | null;
  donorFirstName?: string | null;
  donorLastName?: string | null;
  donorEmail?: string | null;
  amountMinor?: number;
  amountMajor?: number;
  currency?: string | null;
  feeAmountMinor?: number;
  feeAmountMajor?: number;
  feeCurrency?: string | null;
  dateReceived?: string | null;
  expectedAt?: string | null;
  fundId?: string | null;
  appealId?: string | null;
  appealSegmentId?: string | null;
  trackingCodeId?: string | null;
  opportunityId?: string | null;
  giftIntent?: string | null;
  inKindDescription?: string | null;
  isInKind?: boolean;
  estimatedValue?: number | null;
  notes?: string | null;
  giftAidEligible?: boolean;
  promotionStatus?: string;
  validationStatus?: string;
  dedupeStatus?: string;
  errorDetail?: string | null;
  giftBatchId?: string | null;
  giftPayoutId?: string | null;
}

export interface GiftStagingListQuery {
  statuses?: string[];
  intakeSources?: string[];
  search?: string;
  cursor?: string;
  limit?: number;
  sort?: string;
  recurringAgreementId?: string;
  minAmountMinor?: number;
  maxAmountMinor?: number;
  giftBatchId?: string;
}

export interface GiftStagingListItem {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  processingStatus?: string;
  validationStatus?: string;
  dedupeStatus?: string;
  errorDetail?: string;
  intakeSource?: string;
  sourceFingerprint?: string;
  externalId?: string;
  giftBatchId?: string;
  autoPromote: boolean;
  amountMinor?: number;
  amount?: number;
  currency?: string;
  feeAmount?: number;
  feeAmountMinor?: number;
  dateReceived?: string;
  expectedAt?: string;
  paymentMethod?: string;
  giftAidEligible: boolean;
  donorId?: string;
  companyId?: string;
  donorFirstName?: string;
  donorLastName?: string;
  donorEmail?: string;
  fundId?: string;
  appealId?: string;
  appealSegmentId?: string;
  trackingCodeId?: string;
  opportunityId?: string;
  giftIntent?: string;
  isInKind?: boolean;
  inKindDescription?: string;
  estimatedValue?: number;
  provider?: string;
  providerPaymentId?: string;
  providerContext?: Record<string, unknown>;
  recurringAgreementId?: string;
  giftPayoutId?: string;
  rawPayloadAvailable: boolean;
  notes?: string;
  receiptStatus?: string;
  receiptPolicyApplied?: string;
  receiptChannel?: string;
  receiptTemplateVersion?: string;
  receiptError?: string;
  receiptDedupeKey?: string;
  receiptSentAt?: string;
  receiptWarnings?: string[];
}

export interface GiftStagingListResult {
  data: GiftStagingListItem[];
  meta: {
    nextCursor?: string;
    hasMore: boolean;
  };
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
    private readonly giftStagingApiClient: GiftStagingApiClient,
  ) {
    this.enabled = this.resolveBooleanFlag(
      this.configService.get<string>('FUNDRAISING_ENABLE_GIFT_STAGING'),
      false,
    );
    this.autoPromoteDefault = this.resolveBooleanFlag(
      this.configService.get<string>(
        'FUNDRAISING_STAGING_AUTO_PROMOTE_DEFAULT',
      ),
      false,
    );
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async stageGift(
    payload: NormalizedGiftCreatePayload,
  ): Promise<GiftStagingRecord | undefined> {
    if (!this.enabled) {
      return undefined;
    }

    const autoPromote =
      typeof payload.autoPromote === 'boolean'
        ? payload.autoPromote
        : this.autoPromoteDefault;

    const requestBody = mapCreateGiftStagingPayload(payload, autoPromote);
    const dto = plainToInstance(CreateGiftStagingDto, requestBody);
    const errors = validateSync(dto as object, {
      whitelist: true,
      forbidUnknownValues: true,
    });
    if (Array.isArray(errors) && errors.length > 0) {
      const messages = errors.map((error) => {
        const constraints = error.constraints
          ? Object.values(error.constraints).join('; ')
          : undefined;
        return constraints || error.toString();
      });
      this.structuredLogger.warn(
        'Validation failed for gift staging payload',
        {
          event: 'gift_staging_stage_validation_failed',
          errors: messages,
        },
        GiftStagingService.name,
      );
      return undefined;
    }

    try {
      const response = (await this.giftStagingApiClient.create(
        requestBody,
      )) as GiftStagingCreateResponse;

      const created = response?.data?.createGiftStaging;
      const stagingId = created?.id;
      const resolvedAutoPromote =
        typeof created?.autoPromote === 'boolean'
          ? created.autoPromote
          : autoPromote;
      const resolvedPromotionStatus =
        typeof created?.promotionStatus === 'string' &&
        created.promotionStatus.trim().length > 0
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

  async getGiftStagingById(
    stagingId: string,
  ): Promise<GiftStagingRecordModel | undefined> {
    if (typeof stagingId !== 'string' || stagingId.trim().length === 0) {
      return undefined;
    }

    try {
      const record = await this.giftStagingApiClient.getById(stagingId);
      const receiptMeta = extractReceiptMeta(record);
      return receiptMeta ? { ...record, ...receiptMeta } : record;
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

  async listGiftStaging(
    query: GiftStagingListQuery,
  ): Promise<GiftStagingListResult> {
    if (!this.enabled) {
      return {
        data: [],
        meta: {
          hasMore: false,
        },
      };
    }

    const sanitizedQuery = this.normalizeListQuery(query);

    const path = this.buildPath(
      '/giftStagings',
      this.buildListQueryParams(sanitizedQuery),
    );

    const extracted = await this.giftStagingApiClient.list(path);

    const summaries = extracted.records.map((entity) =>
      this.toListItem(entity),
    );

    return {
      data: summaries,
      meta: {
        nextCursor: extracted.nextCursor,
        hasMore: extracted.hasMore,
      },
    };
  }

  async markCommitted(
    record: GiftStagingRecord | undefined,
    giftId: string,
  ): Promise<void> {
    if (!this.enabled || !record?.id) {
      return;
    }

    await this.markCommittedById(record.id, giftId);
  }

  async markCommittedById(stagingId: string, giftId: string): Promise<void> {
    if (
      !this.enabled ||
      typeof stagingId !== 'string' ||
      stagingId.trim().length === 0
    ) {
      return;
    }

    await this.patchCommitted(stagingId, giftId);
  }

  async updateStatusById(
    stagingId: string,
    updates: GiftStagingStatusUpdate,
  ): Promise<void> {
    if (
      !this.enabled ||
      typeof stagingId !== 'string' ||
      stagingId.trim().length === 0
    ) {
      return;
    }

    const resolvedUpdates = { ...updates };

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

    await this.giftStagingApiClient.patch(stagingId, payload);
  }

  async updateGiftStagingPayload(
    stagingId: string,
    updates: GiftStagingUpdateInput,
  ): Promise<GiftStagingRecordModel | undefined> {
    if (
      !this.enabled ||
      typeof stagingId !== 'string' ||
      stagingId.trim().length === 0
    ) {
      return undefined;
    }

    const existing = await this.getGiftStagingById(stagingId);
    if (!existing) {
      return undefined;
    }

    const mergedPayload = mergePayloadForUpdate(existing, updates);
    const rawPayload = JSON.stringify(mergedPayload);
    const patchBody = this.buildPayloadUpdateBody(
      existing,
      mergedPayload,
      updates,
      rawPayload,
    );

    await this.giftStagingApiClient.patch(stagingId, patchBody);

    this.structuredLogger.info(
      'Updated gift staging payload',
      {
        event: 'gift_staging_payload_updated',
        stagingId,
        donorId: mergedPayload.donorId,
        amountMinor: mergedPayload.amountMinor,
      },
      GiftStagingService.name,
    );

    return this.getGiftStagingById(stagingId);
  }

  private async patchCommitted(
    stagingId: string,
    giftId: string,
  ): Promise<void> {
    try {
      await this.giftStagingApiClient.patch(stagingId, {
        promotionStatus: 'committed',
        validationStatus: 'passed',
        dedupeStatus: 'passed',
        giftId,
      });

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

  private buildPayloadUpdateBody(
    existing: GiftStagingRecordModel,
    payload: NormalizedGiftCreatePayload,
    updates: GiftStagingUpdateInput,
    rawPayload: string,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      donorId: payload.donorId,
      companyId: payload.companyId,
      donorFirstName: payload.donorFirstName,
      donorLastName: payload.donorLastName,
      donorEmail: payload.donorEmail,
      amountMinor: payload.amountMinor,
      amount: payload.amount,
      dateReceived:
        payload.dateReceived ?? payload.giftDate ?? existing.dateReceived,
      expectedAt: payload.expectedAt,
      fundId: payload.fundId,
      appealId: payload.appealId,
      appealSegmentId: payload.appealSegmentId,
      trackingCodeId: payload.trackingCodeId,
      opportunityId: payload.opportunityId,
      giftIntent: payload.giftIntent,
      isInKind:
        updates.isInKind !== undefined
          ? (updates.isInKind ?? undefined)
          : payload.isInKind,
      inKindDescription: payload.inKindDescription,
      estimatedValue: payload.estimatedValue,
      notes: payload.notes,
      giftAidEligible:
        typeof updates.giftAidEligible === 'boolean'
          ? updates.giftAidEligible
          : payload.giftAidEligible,
      giftBatchId:
        updates.giftBatchId !== undefined
          ? this.normalizeNullableString(updates.giftBatchId)
          : (payload.giftBatchId ?? existing.giftBatchId),
      promotionStatus: updates.promotionStatus,
      validationStatus: updates.validationStatus,
      dedupeStatus: updates.dedupeStatus,
      errorDetail: updates.errorDetail,
      rawPayload,
    };

    return this.pruneUndefinedValues(body);
  }

  private normalizeNullableString(value?: string | null): string | undefined {
    if (value === null) {
      return undefined;
    }
    if (typeof value !== 'string') {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private resolveBooleanFlag(
    value: string | undefined,
    fallback: boolean,
  ): boolean {
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

  private pruneUndefinedValues<T extends Record<string, unknown>>(input: T): T {
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined && value !== null && value !== '') {
        output[key] = value;
      }
    }
    return output as T;
  }

  private normalizeListQuery(
    query: GiftStagingListQuery,
  ): GiftStagingListQuery {
    const dto = plainToInstance(GiftStagingListQueryDto, query ?? {}, {
      enableImplicitConversion: true,
    });

    return {
      statuses: dto.statuses,
      intakeSources: dto.intakeSources,
      search: dto.search ? dto.search.toLowerCase() : undefined,
      cursor: dto.cursor,
      limit: this.normalizeLimit(dto.limit),
      sort: dto.sort,
      recurringAgreementId: dto.recurringAgreementId,
      minAmountMinor: dto.minAmountMinor,
      maxAmountMinor: dto.maxAmountMinor,
      giftBatchId: dto.giftBatchId,
    };
  }

  private buildListQueryParams(
    query: GiftStagingListQuery,
  ): Record<string, string> {
    const params: Record<string, string> = {};
    if (query.limit) {
      params.limit = query.limit.toString();
    }
    if (query.cursor) {
      params.cursor = query.cursor;
    }
    if (query.statuses?.length) {
      params.statuses = query.statuses.join(',');
    }
    if (query.intakeSources?.length) {
      params.intakeSources = query.intakeSources.join(',');
    }
    if (query.search) {
      params.search = query.search;
    }
    if (query.sort) {
      params.sort = query.sort;
    }
    if (query.recurringAgreementId) {
      params.recurringAgreementId = query.recurringAgreementId;
    }
    if (typeof query.minAmountMinor === 'number') {
      params.minAmountMinor = query.minAmountMinor.toString();
    }
    if (typeof query.maxAmountMinor === 'number') {
      params.maxAmountMinor = query.maxAmountMinor.toString();
    }
    if (query.giftBatchId) {
      params.giftBatchId = query.giftBatchId;
    }
    return params;
  }

  private toListItem(entity: GiftStagingRecordModel): GiftStagingListItem {
    const receiptMeta = extractReceiptMeta(entity);
    return {
      id: entity.id,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      processingStatus: entity.promotionStatus,
      validationStatus: entity.validationStatus,
      dedupeStatus: entity.dedupeStatus,
      errorDetail: entity.errorDetail,
      intakeSource: entity.intakeSource,
      sourceFingerprint: entity.sourceFingerprint,
      externalId: entity.externalId,
      giftBatchId: entity.giftBatchId,
      autoPromote: entity.autoPromote ?? false,
      amount: entity.amount,
      amountMinor: entity.amountMinor,
      currency: entity.currency,
      feeAmount: entity.feeAmount,
      feeAmountMinor: entity.feeAmountMinor,
      dateReceived: entity.dateReceived,
      expectedAt: entity.expectedAt,
      paymentMethod: entity.paymentMethod,
      giftAidEligible: entity.giftAidEligible ?? false,
      donorId: entity.donorId,
      donorFirstName: entity.donorFirstName,
      donorLastName: entity.donorLastName,
      donorEmail: entity.donorEmail,
      fundId: entity.fundId,
      appealId: entity.appealId,
      appealSegmentId: entity.appealSegmentId,
      trackingCodeId: entity.trackingCodeId,
      opportunityId: entity.opportunityId,
      giftIntent: entity.giftIntent,
      isInKind: entity.isInKind ?? false,
      inKindDescription: entity.inKindDescription,
      estimatedValue: entity.estimatedValue,
      provider: entity.provider,
      providerPaymentId: entity.providerPaymentId,
      providerContext: entity.providerContext,
      recurringAgreementId: entity.recurringAgreementId,
      giftPayoutId: entity.giftPayoutId,
      rawPayloadAvailable: Boolean(
        entity.rawPayload && entity.rawPayload.length > 0,
      ),
      notes: entity.notes,
      receiptStatus: receiptMeta?.receiptStatus,
      receiptPolicyApplied: receiptMeta?.receiptPolicyApplied,
      receiptChannel: receiptMeta?.receiptChannel,
      receiptTemplateVersion: receiptMeta?.receiptTemplateVersion,
      receiptError: receiptMeta?.receiptError,
      receiptDedupeKey: receiptMeta?.receiptDedupeKey,
      receiptSentAt: receiptMeta?.receiptSentAt,
      receiptWarnings: receiptMeta?.receiptWarnings,
    };
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || !Number.isFinite(limit)) {
      return 25;
    }
    return Math.max(1, Math.min(100, Math.floor(limit)));
  }

  private buildPath(basePath: string, params: Record<string, string>): string {
    if (!params || Object.keys(params).length === 0) {
      return basePath;
    }

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, value);
      }
    });

    const queryString = searchParams.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  }
}
