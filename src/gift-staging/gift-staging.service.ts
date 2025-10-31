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
  createdAt?: string;
  updatedAt?: string;
  amount?: number;
  amountMinor?: number;
  currency?: string;
  intakeSource?: string;
  sourceFingerprint?: string;
  externalId?: string;
  paymentMethod?: string;
  dateReceived?: string;
  expectedAt?: string;
  provider?: string;
  providerPaymentId?: string;
  providerContext?: Record<string, unknown>;
  giftAidEligible?: boolean;
  donorId?: string;
  donorFirstName?: string;
  donorLastName?: string;
  donorEmail?: string;
  fundId?: string;
  appealId?: string;
  appealSegmentId?: string;
  trackingCodeId?: string;
  recurringAgreementId?: string;
  notes?: string;
  errorDetail?: string;
}

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
  donorFirstName?: string | null;
  donorLastName?: string | null;
  donorEmail?: string | null;
  amountMinor?: number;
  amountMajor?: number;
  currency?: string | null;
  dateReceived?: string | null;
  expectedAt?: string | null;
  fundId?: string | null;
  appealId?: string | null;
  appealSegmentId?: string | null;
  trackingCodeId?: string | null;
  notes?: string | null;
  giftAidEligible?: boolean;
  promotionStatus?: string;
  validationStatus?: string;
  dedupeStatus?: string;
  errorDetail?: string | null;
  giftBatchId?: string | null;
}

export interface GiftStagingListQuery {
  statuses?: string[];
  intakeSources?: string[];
  search?: string;
  cursor?: string;
  limit?: number;
  sort?: string;
  recurringAgreementId?: string;
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
  dateReceived?: string;
  expectedAt?: string;
  paymentMethod?: string;
  giftAidEligible: boolean;
  donorId?: string;
  donorFirstName?: string;
  donorLastName?: string;
  donorEmail?: string;
  fundId?: string;
  appealId?: string;
  appealSegmentId?: string;
  trackingCodeId?: string;
  provider?: string;
  providerPaymentId?: string;
  providerContext?: Record<string, unknown>;
  recurringAgreementId?: string;
  rawPayloadAvailable: boolean;
  notes?: string;
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

  async listGiftStaging(query: GiftStagingListQuery): Promise<GiftStagingListResult> {
    if (!this.enabled) {
      return {
        data: [],
        meta: {
          hasMore: false,
        },
      };
    }

    const limit = this.normalizeLimit(query.limit);
    const sanitizedQuery = {
      statuses: this.normalizeStringArray(query.statuses),
      intakeSources: this.normalizeStringArray(query.intakeSources),
      search: this.normalizeSearch(query.search),
      cursor: query.cursor?.trim() || undefined,
      limit,
      sort: this.normalizeSort(query.sort),
      recurringAgreementId: this.normalizeId(query.recurringAgreementId),
    };

    const path = this.buildPath('/giftStagings', this.buildListQueryParams(sanitizedQuery));

    const response = await this.twentyApiService.request(
      'GET',
      path,
      undefined,
      GiftStagingService.name,
    );

    const extracted = this.extractGiftStagingListResponse(response);

    const filtered = this.applyListFilters(extracted.records, sanitizedQuery);
    const sorted = this.applySort(filtered, sanitizedQuery.sort);
    const summaries = sorted.map((entity) => this.toListItem(entity));

    return {
      data: summaries,
      meta: {
        nextCursor: extracted.nextCursor,
        hasMore: extracted.hasMore,
      },
    };
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

  async updateGiftStagingPayload(
    stagingId: string,
    updates: GiftStagingUpdateInput,
  ): Promise<GiftStagingEntity | undefined> {
    if (!this.enabled || typeof stagingId !== 'string' || stagingId.trim().length === 0) {
      return undefined;
    }

    const existing = await this.getGiftStagingById(stagingId);
    if (!existing) {
      return undefined;
    }

    const mergedPayload = this.mergePayloadForUpdate(existing, updates);
    const rawPayload = this.safeStringify(mergedPayload);
    const patchBody = this.buildPayloadUpdateBody(existing, mergedPayload, updates, rawPayload);

    await this.twentyApiService.request(
      'PATCH',
      `/giftStagings/${encodeURIComponent(stagingId)}`,
      patchBody,
      GiftStagingService.name,
    );

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

  private mergePayloadForUpdate(
    existing: GiftStagingEntity,
    updates: GiftStagingUpdateInput,
  ): NormalizedGiftCreatePayload {
    const basePayload =
      this.parseRawPayload(existing.rawPayload) ?? this.buildPayloadFromEntity(existing);

    const merged: NormalizedGiftCreatePayload = {
      ...basePayload,
      amount: { ...(basePayload.amount ?? { currencyCode: existing.currency ?? 'GBP', value: basePayload.amountMajor ?? 0 }) },
      providerContext: basePayload.providerContext,
    };

    const normalizeString = (value?: string | null): string | undefined => {
      if (value === null) {
        return undefined;
      }
      if (typeof value !== 'string') {
        return value as unknown as string | undefined;
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };

    const normalizeCurrency = (value?: string | null): string | undefined => {
      const normalized = normalizeString(value);
      return normalized ? normalized.toUpperCase() : undefined;
    };

    if (updates.donorId !== undefined) {
      const donorId = normalizeString(updates.donorId);
      merged.donorId = donorId;
      if (donorId) {
        (merged as Record<string, unknown>).contactId = donorId;
      } else {
        delete (merged as Record<string, unknown>).contactId;
      }
    }

    if (updates.donorFirstName !== undefined) {
      merged.donorFirstName = normalizeString(updates.donorFirstName);
    }

    if (updates.donorLastName !== undefined) {
      merged.donorLastName = normalizeString(updates.donorLastName);
    }

    if (updates.donorEmail !== undefined) {
      merged.donorEmail = normalizeString(updates.donorEmail);
    }

    if (updates.currency !== undefined) {
      const currency = normalizeCurrency(updates.currency);
      merged.currency = currency ?? merged.currency ?? existing.currency;
      if (merged.amount) {
        merged.amount.currencyCode = merged.currency ?? merged.amount.currencyCode;
      }
    } else if (!merged.currency) {
      merged.currency = existing.currency ?? merged.amount?.currencyCode ?? 'GBP';
      if (merged.amount) {
        merged.amount.currencyCode = merged.currency;
      }
    }

    let amountMinor =
      updates.amountMinor !== undefined
        ? updates.amountMinor ?? undefined
        : merged.amountMinor ?? existing.amountMinor;
    let amountMajor =
      updates.amountMajor !== undefined
        ? updates.amountMajor ?? undefined
        : merged.amountMajor ?? existing.amount;

    if (amountMinor === undefined && amountMajor !== undefined) {
      amountMinor = Math.round(amountMajor * 100);
    }
    if (amountMajor === undefined && amountMinor !== undefined) {
      amountMajor = Number((amountMinor / 100).toFixed(2));
    }

    if (typeof amountMinor === 'number') {
      merged.amountMinor = amountMinor;
    }

    if (typeof amountMajor === 'number') {
      merged.amountMajor = amountMajor;
    }

    const resolvedAmountMajor =
      typeof merged.amountMajor === 'number'
        ? merged.amountMajor
        : typeof merged.amountMinor === 'number'
          ? Number((merged.amountMinor / 100).toFixed(2))
          : merged.amount?.value;

    if (!merged.amount) {
      merged.amount = {
        value: resolvedAmountMajor ?? 0,
        currencyCode: merged.currency ?? 'GBP',
      };
    } else {
      if (resolvedAmountMajor !== undefined) {
        merged.amount.value = resolvedAmountMajor;
      }
      if (merged.currency) {
        merged.amount.currencyCode = merged.currency;
      }
    }

    if (updates.dateReceived !== undefined) {
      const date = normalizeString(updates.dateReceived);
      if (date) {
        merged.dateReceived = date;
        merged.giftDate = date;
      } else {
        delete merged.dateReceived;
        delete merged.giftDate;
      }
    }

    if (updates.expectedAt !== undefined) {
      const expected = normalizeString(updates.expectedAt);
      if (expected) {
        merged.expectedAt = expected;
      } else {
        delete merged.expectedAt;
      }
    }

    if (updates.fundId !== undefined) {
      const fundId = normalizeString(updates.fundId);
      if (fundId) {
        merged.fundId = fundId;
      } else {
        delete merged.fundId;
      }
    }

    if (updates.appealId !== undefined) {
      const appealId = normalizeString(updates.appealId);
      if (appealId) {
        merged.appealId = appealId;
      } else {
        delete merged.appealId;
      }
    }

    if (updates.appealSegmentId !== undefined) {
      const appealSegmentId = normalizeString(updates.appealSegmentId);
      if (appealSegmentId) {
        merged.appealSegmentId = appealSegmentId;
      } else {
        delete merged.appealSegmentId;
      }
    }

    if (updates.trackingCodeId !== undefined) {
      const trackingCodeId = normalizeString(updates.trackingCodeId);
      if (trackingCodeId) {
        merged.trackingCodeId = trackingCodeId;
      } else {
        delete merged.trackingCodeId;
      }
    }

    if (updates.notes !== undefined) {
      const notes = normalizeString(updates.notes);
      if (notes) {
        merged.notes = notes;
      } else {
        delete merged.notes;
      }
    }

    if (updates.giftAidEligible !== undefined) {
      merged.giftAidEligible = updates.giftAidEligible;
    }

    if (updates.giftBatchId !== undefined) {
      const batchId = normalizeString(updates.giftBatchId);
      if (batchId) {
        merged.giftBatchId = batchId;
      } else {
        delete merged.giftBatchId;
      }
    }

    return merged;
  }

  private buildPayloadUpdateBody(
    existing: GiftStagingEntity,
    payload: NormalizedGiftCreatePayload,
    updates: GiftStagingUpdateInput,
    rawPayload: string,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      donorId: payload.donorId,
      donorFirstName: payload.donorFirstName,
      donorLastName: payload.donorLastName,
      donorEmail: payload.donorEmail,
      amountMinor: payload.amountMinor,
      amount: payload.amount,
      currency: payload.currency ?? existing.currency,
      dateReceived: payload.dateReceived ?? payload.giftDate ?? existing.dateReceived,
      expectedAt: payload.expectedAt,
      fundId: payload.fundId,
      appealId: payload.appealId,
      appealSegmentId: payload.appealSegmentId,
      trackingCodeId: payload.trackingCodeId,
      notes: payload.notes,
      giftAidEligible:
        typeof updates.giftAidEligible === 'boolean'
          ? updates.giftAidEligible
          : payload.giftAidEligible,
      giftBatchId:
        updates.giftBatchId !== undefined
          ? this.normalizeNullableString(updates.giftBatchId)
          : payload.giftBatchId ?? existing.giftBatchId,
      promotionStatus: updates.promotionStatus,
      validationStatus: updates.validationStatus,
      dedupeStatus: updates.dedupeStatus,
      errorDetail: updates.errorDetail,
      rawPayload,
    };

    return this.pruneUndefinedValues(body);
  }

  private parseRawPayload(rawPayload?: string): NormalizedGiftCreatePayload | undefined {
    if (!rawPayload || rawPayload.trim().length === 0) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(rawPayload);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as NormalizedGiftCreatePayload;
      }
    } catch (error) {
      this.structuredLogger.warn(
        'Failed to parse existing gift staging raw payload; falling back to entity fields',
        {
          event: 'gift_staging_parse_payload_failed',
          message: error instanceof Error ? error.message : String(error),
        },
        GiftStagingService.name,
      );
    }
    return undefined;
  }

  private buildPayloadFromEntity(entity: GiftStagingEntity): NormalizedGiftCreatePayload {
    const inferredAmountMinor =
      typeof entity.amountMinor === 'number'
        ? entity.amountMinor
        : typeof entity.amount === 'number'
          ? Math.round(entity.amount * 100)
          : 0;

    const inferredAmountMajor =
      typeof entity.amount === 'number'
        ? entity.amount
        : Number((inferredAmountMinor / 100).toFixed(2));

    const currency = entity.currency ?? 'GBP';

    const payload: NormalizedGiftCreatePayload = {
      amount: {
        currencyCode: currency,
        value: inferredAmountMajor,
      },
      amountMinor: inferredAmountMinor,
      amountMajor: inferredAmountMajor,
      currency,
      donorId: entity.donorId,
      donorFirstName: entity.donorFirstName,
      donorLastName: entity.donorLastName,
      donorEmail: entity.donorEmail,
      dateReceived: entity.dateReceived,
      giftDate: entity.dateReceived,
      expectedAt: entity.expectedAt,
      fundId: entity.fundId,
      appealId: entity.appealId,
      appealSegmentId: entity.appealSegmentId,
      trackingCodeId: entity.trackingCodeId,
      notes: entity.notes,
      giftAidEligible: entity.giftAidEligible,
      intakeSource: entity.intakeSource,
      sourceFingerprint: entity.sourceFingerprint,
      provider: entity.provider,
      providerPaymentId: entity.providerPaymentId,
      providerContext: entity.providerContext,
      recurringAgreementId: entity.recurringAgreementId,
      giftBatchId: entity.giftBatchId,
      autoPromote: entity.autoPromote,
    };

    return payload;
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

    return this.parseGiftStagingRecord((data as Record<string, unknown>).giftStaging);
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
      amount: {
        value: payload.amountMajor,
        currencyCode: payload.currency,
      },
      amountMinor: payload.amountMinor,
      paymentMethod: payload.paymentMethod,
      dateReceived: payload.dateReceived ?? payload.giftDate,
      expectedAt: payload.expectedAt,
      giftAidEligible: payload.giftAidEligible ?? false,
      fundId: payload.fundId,
      appealId: payload.appealId,
      appealSegmentId: payload.appealSegmentId,
      trackingCodeId: payload.trackingCodeId,
      contactId: payload.donorId,
      donorFirstName: payload.donorFirstName,
      donorLastName: payload.donorLastName,
      donorEmail: payload.donorEmail,
      giftBatchId: payload.giftBatchId,
      provider: payload.provider,
      providerPaymentId: payload.providerPaymentId,
      providerContext: this.normalizeProviderContext(payload.providerContext),
      recurringAgreementId: payload.recurringAgreementId,
      notes: payload.notes,
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

  private normalizeProviderContext(
    value: Record<string, unknown> | string | undefined,
  ): Record<string, unknown> | undefined {
    if (this.isPlainObject(value)) {
      return value as Record<string, unknown>;
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (this.isPlainObject(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        this.structuredLogger.warn(
          'Failed to parse providerContext string; dropping value',
          {
            event: 'gift_staging_provider_context_parse_failed',
          },
          GiftStagingService.name,
        );
      }
    }
    return undefined;
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

  private parseGiftStagingRecord(record: unknown): GiftStagingEntity | undefined {
    if (!this.isPlainObject(record)) {
      return undefined;
    }

    const recordObj = record as Record<string, unknown>;

    const id = recordObj.id;
    if (typeof id !== 'string' || id.trim().length === 0) {
      return undefined;
    }

    const entity: GiftStagingEntity = {
      id,
      promotionStatus:
        typeof recordObj.promotionStatus === 'string' ? recordObj.promotionStatus : undefined,
      validationStatus:
        typeof recordObj.validationStatus === 'string' ? recordObj.validationStatus : undefined,
      dedupeStatus: typeof recordObj.dedupeStatus === 'string' ? recordObj.dedupeStatus : undefined,
      giftId: typeof recordObj.giftId === 'string' ? recordObj.giftId : undefined,
      autoPromote: typeof recordObj.autoPromote === 'boolean' ? recordObj.autoPromote : undefined,
      giftBatchId: typeof recordObj.giftBatchId === 'string' ? recordObj.giftBatchId : undefined,
      createdAt: typeof recordObj.createdAt === 'string' ? recordObj.createdAt : undefined,
      updatedAt: typeof recordObj.updatedAt === 'string' ? recordObj.updatedAt : undefined,
      amount:
        typeof recordObj.amount === 'number' && Number.isFinite(recordObj.amount)
          ? recordObj.amount
          : undefined,
      amountMinor:
        typeof recordObj.amountMinor === 'number' && Number.isFinite(recordObj.amountMinor)
          ? recordObj.amountMinor
          : undefined,
      currency: typeof recordObj.currency === 'string' ? recordObj.currency : undefined,
      intakeSource: typeof recordObj.intakeSource === 'string' ? recordObj.intakeSource : undefined,
      sourceFingerprint:
        typeof recordObj.sourceFingerprint === 'string'
          ? recordObj.sourceFingerprint
          : undefined,
      externalId: typeof recordObj.externalId === 'string' ? recordObj.externalId : undefined,
      paymentMethod:
        typeof recordObj.paymentMethod === 'string' ? recordObj.paymentMethod : undefined,
      dateReceived: typeof recordObj.dateReceived === 'string' ? recordObj.dateReceived : undefined,
      expectedAt: typeof recordObj.expectedAt === 'string' ? recordObj.expectedAt : undefined,
      provider: typeof recordObj.provider === 'string' ? recordObj.provider : undefined,
      providerPaymentId:
        typeof recordObj.providerPaymentId === 'string'
          ? recordObj.providerPaymentId
          : undefined,
      giftAidEligible:
        typeof recordObj.giftAidEligible === 'boolean' ? recordObj.giftAidEligible : undefined,
      donorId: typeof recordObj.donorId === 'string' ? recordObj.donorId : undefined,
      donorFirstName:
        typeof recordObj.donorFirstName === 'string' ? recordObj.donorFirstName : undefined,
      donorLastName:
        typeof recordObj.donorLastName === 'string' ? recordObj.donorLastName : undefined,
      donorEmail: typeof recordObj.donorEmail === 'string' ? recordObj.donorEmail : undefined,
      fundId: typeof recordObj.fundId === 'string' ? recordObj.fundId : undefined,
      appealId: typeof recordObj.appealId === 'string' ? recordObj.appealId : undefined,
      appealSegmentId:
        typeof recordObj.appealSegmentId === 'string' ? recordObj.appealSegmentId : undefined,
      trackingCodeId:
        typeof recordObj.trackingCodeId === 'string' ? recordObj.trackingCodeId : undefined,
      recurringAgreementId:
        typeof recordObj.recurringAgreementId === 'string'
          ? recordObj.recurringAgreementId
          : undefined,
      notes: typeof recordObj.notes === 'string' ? recordObj.notes : undefined,
      errorDetail: typeof recordObj.errorDetail === 'string' ? recordObj.errorDetail : undefined,
    };

    const rawPayload = recordObj.rawPayload;
    if (typeof rawPayload === 'string') {
      entity.rawPayload = rawPayload;
    } else if (this.isPlainObject(rawPayload)) {
      try {
        entity.rawPayload = JSON.stringify(rawPayload);
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

    const providerContextRaw = recordObj.providerContext;
    if (this.isPlainObject(providerContextRaw)) {
      entity.providerContext = providerContextRaw as Record<string, unknown>;
    } else if (typeof providerContextRaw === 'string') {
      try {
        const parsed = JSON.parse(providerContextRaw);
        if (this.isPlainObject(parsed)) {
          entity.providerContext = parsed as Record<string, unknown>;
        }
      } catch {
        this.structuredLogger.warn(
          'Failed to parse providerContext string when extracting gift staging',
          {
            event: 'gift_staging_provider_context_parse_failed',
            stagingId: id,
          },
          GiftStagingService.name,
        );
      }
    }

    return entity;
  }

  private extractGiftStagingListResponse(response: unknown): {
    records: GiftStagingEntity[];
    hasMore: boolean;
    nextCursor?: string;
  } {
    if (!this.isPlainObject(response)) {
      return { records: [], hasMore: false };
    }

    const data = response.data;
    if (!this.isPlainObject(data)) {
      return { records: [], hasMore: false };
    }

    const giftStagings = (data as Record<string, unknown>).giftStagings;

    const records: GiftStagingEntity[] = Array.isArray(giftStagings)
      ? giftStagings
          .map((entry) => this.parseGiftStagingRecord(entry))
          .filter((entry): entry is GiftStagingEntity => Boolean(entry))
      : [];

    const pageInfo = this.isPlainObject((data as Record<string, unknown>).pageInfo)
      ? ((data as Record<string, unknown>).pageInfo as Record<string, unknown>)
      : undefined;

    const hasMore =
      typeof pageInfo?.hasNextPage === 'boolean'
        ? pageInfo.hasNextPage
        : Boolean(pageInfo?.hasMore);

    const nextCursor =
      typeof pageInfo?.endCursor === 'string'
        ? pageInfo.endCursor
        : typeof pageInfo?.nextCursor === 'string'
          ? pageInfo.nextCursor
          : undefined;

    return { records, hasMore, nextCursor };
  }

  private buildListQueryParams(query: {
    limit: number;
    cursor?: string;
  }): Record<string, string> {
    const params: Record<string, string> = {};
    if (query.limit) {
      params.limit = query.limit.toString();
    }
    if (query.cursor) {
      params.cursor = query.cursor;
    }
    return params;
  }

  private applyListFilters(
    records: GiftStagingEntity[],
    query: {
      statuses?: string[];
      intakeSources?: string[];
      search?: string;
      recurringAgreementId?: string;
    },
  ): GiftStagingEntity[] {
    return records.filter((record) => {
      if (query.statuses && query.statuses.length > 0) {
        const status = record.promotionStatus ?? '';
        if (!query.statuses.includes(status)) {
          return false;
        }
      }

      if (query.intakeSources && query.intakeSources.length > 0) {
        const source = record.intakeSource ?? '';
        if (!query.intakeSources.includes(source)) {
          return false;
        }
      }

      if (query.recurringAgreementId) {
        if (record.recurringAgreementId !== query.recurringAgreementId) {
          return false;
        }
      }

      if (query.search) {
        const needle = query.search;
        const haystacks = [
          record.id,
          record.recurringAgreementId,
          record.provider,
          record.externalId,
          record.sourceFingerprint,
          record.giftBatchId,
          record.giftId,
          record.donorEmail,
          record.donorFirstName,
          record.donorLastName,
        ]
          .filter(Boolean)
          .map((value) => value!.toLowerCase());
        if (!haystacks.some((value) => value.includes(needle))) {
          return false;
        }
      }

      return true;
    });
  }

  private applySort(records: GiftStagingEntity[], sort?: string): GiftStagingEntity[] {
    if (records.length <= 1) {
      return records;
    }

    const [field, direction] = (sort ?? 'createdAt:desc').split(':');
    const dir = direction === 'asc' ? 1 : -1;

    const sorted = [...records];
    sorted.sort((a, b) => {
      const aValue = this.getSortableValue(a, field);
      const bValue = this.getSortableValue(b, field);

      if (aValue === undefined && bValue === undefined) {
        return 0;
      }
      if (aValue === undefined) {
        return 1;
      }
      if (bValue === undefined) {
        return -1;
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue) * dir;
      }

      const aString = String(aValue);
      const bString = String(bValue);
      return aString.localeCompare(bString) * dir;
    });

    return sorted;
  }

  private getSortableValue(entity: GiftStagingEntity, field?: string): string | number | undefined {
    switch (field) {
      case 'amountMinor':
        return entity.amountMinor;
      case 'updatedAt':
        return entity.updatedAt;
      case 'createdAt':
      default:
        return entity.createdAt;
    }
  }

  private toListItem(entity: GiftStagingEntity): GiftStagingListItem {
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
      provider: entity.provider,
      providerPaymentId: entity.providerPaymentId,
      providerContext: entity.providerContext,
      recurringAgreementId: entity.recurringAgreementId,
      rawPayloadAvailable: Boolean(entity.rawPayload && entity.rawPayload.length > 0),
      notes: entity.notes,
    };
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || !Number.isFinite(limit)) {
      return 25;
    }
    return Math.max(1, Math.min(100, Math.floor(limit)));
  }

  private normalizeStringArray(values?: string[]): string[] | undefined {
    if (!values) {
      return undefined;
    }
    const normalized = values
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value));
    return normalized.length > 0 ? normalized : undefined;
  }

  private normalizeSearch(search?: string): string | undefined {
    if (typeof search !== 'string') {
      return undefined;
    }
    const trimmed = search.trim().toLowerCase();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private normalizeSort(sort?: string): string | undefined {
    if (typeof sort !== 'string') {
      return undefined;
    }
    const trimmed = sort.trim();
    if (!trimmed) {
      return undefined;
    }
    const [field, direction] = trimmed.split(':');
    const normalizedField = ['createdAt', 'updatedAt', 'amountMinor'].includes(field)
      ? field
      : 'createdAt';
    const normalizedDirection = direction === 'asc' ? 'asc' : 'desc';
    return `${normalizedField}:${normalizedDirection}`;
  }

  private normalizeId(value?: string): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
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
