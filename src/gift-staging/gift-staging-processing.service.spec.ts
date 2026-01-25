import { BadRequestException } from '@nestjs/common';
import { GiftStagingProcessingService } from './gift-staging-processing.service';
import {
  GiftStagingService,
  GiftStagingRecordModel,
} from './gift-staging.service';
import { TwentyApiService } from '../twenty/twenty-api.service';
import { StructuredLoggerService } from '../logging/structured-logger.service';
import { NormalizedGiftCreatePayload } from '../gift/gift.types';
import { RecurringAgreementService } from '../recurring-agreement/recurring-agreement.service';
import { ReceiptPolicyService } from '../receipt/receipt-policy.service';

describe('GiftStagingProcessingService (manual processing)', () => {
  let service: GiftStagingProcessingService;
  let giftStagingService: jest.Mocked<GiftStagingService>;
  let twentyApiService: jest.Mocked<TwentyApiService>;
  let structuredLogger: jest.Mocked<StructuredLoggerService>;
  let recurringAgreementService: jest.Mocked<RecurringAgreementService>;
  let getGiftStagingByIdMock: jest.MockedFunction<
    GiftStagingService['getGiftStagingById']
  >;
  let markCommittedByIdMock: jest.MockedFunction<
    GiftStagingService['markCommittedById']
  >;
  let updateStatusByIdMock: jest.MockedFunction<
    GiftStagingService['updateStatusById']
  >;
  let twentyRequestMock: jest.MockedFunction<TwentyApiService['request']>;
  let updateRecurringAgreementMock: jest.MockedFunction<
    RecurringAgreementService['updateAgreement']
  >;
  let receiptPolicyService: {
    applyReceiptMetadata: jest.MockedFunction<
      (payload: NormalizedGiftCreatePayload) => NormalizedGiftCreatePayload
    >;
  };

  const basePayload: NormalizedGiftCreatePayload = {
    amount: { currencyCode: 'GBP', amountMicros: 12_340_000 },
    donorId: 'person-123',
    intakeSource: 'manual_ui',
    sourceFingerprint: 'fp-123',
  };

  const baseStaging: GiftStagingRecordModel = {
    id: 'stg-123',
    promotionStatus: 'ready_for_commit',
    validationStatus: 'passed',
    dedupeStatus: 'passed',
    rawPayload: JSON.stringify(basePayload),
  };

  beforeEach(() => {
    getGiftStagingByIdMock = jest.fn();
    markCommittedByIdMock = jest.fn().mockResolvedValue(undefined);
    updateStatusByIdMock = jest.fn().mockResolvedValue(undefined);

    giftStagingService = {
      getGiftStagingById: getGiftStagingByIdMock,
      markCommittedById: markCommittedByIdMock,
      updateStatusById: updateStatusByIdMock,
    } as unknown as jest.Mocked<GiftStagingService>;

    twentyRequestMock = jest.fn();
    twentyApiService = {
      request: twentyRequestMock,
    } as unknown as jest.Mocked<TwentyApiService>;

    structuredLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<StructuredLoggerService>;

    updateRecurringAgreementMock = jest.fn().mockResolvedValue(undefined);
    recurringAgreementService = {
      updateAgreement: updateRecurringAgreementMock,
    } as unknown as jest.Mocked<RecurringAgreementService>;

    receiptPolicyService = {
      applyReceiptMetadata: jest.fn((payload) => payload),
    };

    service = new GiftStagingProcessingService(
      giftStagingService,
      twentyApiService,
      structuredLogger,
      recurringAgreementService,
      receiptPolicyService as unknown as ReceiptPolicyService,
    );
  });

  it('rejects when stagingId is missing', async () => {
    await expect(service.processGift({ stagingId: '' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects when stagingId contains only whitespace', async () => {
    await expect(
      service.processGift({ stagingId: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns error when the staging record cannot be fetched', async () => {
    getGiftStagingByIdMock.mockResolvedValue(undefined);

    const result = await service.processGift({ stagingId: 'stg-404' });

    expect(result).toEqual({
      status: 'error',
      stagingId: 'stg-404',
      error: 'fetch_failed',
    });
    expect(getGiftStagingByIdMock).toHaveBeenCalledWith('stg-404');
  });

  it('returns committed immediately when the staging record is already committed', async () => {
    getGiftStagingByIdMock.mockResolvedValue({
      ...baseStaging,
      promotionStatus: 'committed',
      giftId: 'gift-789',
    });

    const result = await service.processGift({ stagingId: 'stg-123' });

    expect(result).toEqual({
      status: 'committed',
      stagingId: 'stg-123',
      giftId: 'gift-789',
    });
    expect(twentyRequestMock).not.toHaveBeenCalled();
    expect(markCommittedByIdMock).not.toHaveBeenCalled();
  });

  it('defers when the staging record is currently committing', async () => {
    getGiftStagingByIdMock.mockResolvedValue({
      ...baseStaging,
      promotionStatus: 'committing',
    });

    const result = await service.processGift({ stagingId: 'stg-123' });

    expect(result).toEqual({
      status: 'deferred',
      stagingId: 'stg-123',
      reason: 'locked',
    });
    expect(twentyRequestMock).not.toHaveBeenCalled();
    expect(updateStatusByIdMock).not.toHaveBeenCalled();
  });

  it('processes when marked ready even if validation/dedupe are not passed', async () => {
    getGiftStagingByIdMock.mockResolvedValue({
      ...baseStaging,
      validationStatus: 'pending',
      dedupeStatus: 'needs_review',
    });
    twentyRequestMock.mockResolvedValue({
      data: { createGift: { id: 'gift-200' } },
    });

    const result = await service.processGift({ stagingId: 'stg-123' });

    expect(result).toEqual({
      status: 'committed',
      stagingId: 'stg-123',
      giftId: 'gift-200',
    });
    expect(twentyRequestMock).toHaveBeenCalled();
    expect(markCommittedByIdMock).toHaveBeenCalledWith('stg-123', 'gift-200');
  });

  it('defers when raw payload is missing', async () => {
    getGiftStagingByIdMock.mockResolvedValue({
      ...baseStaging,
      rawPayload: undefined,
    });

    const result = await service.processGift({ stagingId: 'stg-123' });

    expect(result).toEqual({
      status: 'deferred',
      stagingId: 'stg-123',
      reason: 'missing_payload',
    });
    expect(twentyRequestMock).not.toHaveBeenCalled();
    expect(updateStatusByIdMock).toHaveBeenCalledTimes(1);
    expect(updateStatusByIdMock).toHaveBeenCalledWith('stg-123', {
      promotionStatus: 'commit_failed',
      errorDetail: 'Staging record missing raw payload',
    });
  });

  it('defers when raw payload cannot be parsed', async () => {
    getGiftStagingByIdMock.mockResolvedValue({
      ...baseStaging,
      rawPayload: '{',
    });

    const result = await service.processGift({ stagingId: 'stg-123' });

    expect(result).toEqual({
      status: 'deferred',
      stagingId: 'stg-123',
      reason: 'missing_payload',
    });
    expect(twentyRequestMock).not.toHaveBeenCalled();
    expect(updateStatusByIdMock).toHaveBeenCalledTimes(1);
    expect(updateStatusByIdMock).toHaveBeenCalledWith('stg-123', {
      promotionStatus: 'commit_failed',
      errorDetail: 'Failed to parse staging raw payload',
    });
  });

  it('returns error when parsed payload misses required fields', async () => {
    const invalidPayload = { ...basePayload };
    delete invalidPayload.donorId;

    getGiftStagingByIdMock.mockResolvedValue({
      ...baseStaging,
      rawPayload: JSON.stringify(invalidPayload),
    });

    const result = await service.processGift({ stagingId: 'stg-123' });

    expect(result).toEqual({
      status: 'error',
      stagingId: 'stg-123',
      error: 'payload_invalid',
    });
    expect(twentyRequestMock).not.toHaveBeenCalled();
    expect(updateStatusByIdMock).toHaveBeenCalledTimes(1);
    expect(updateStatusByIdMock).toHaveBeenCalledWith('stg-123', {
      promotionStatus: 'commit_failed',
      errorDetail: 'Staging payload missing required fields for gift creation',
    });
  });

  it('returns error when Twenty API call fails', async () => {
    getGiftStagingByIdMock.mockResolvedValue(baseStaging);
    twentyRequestMock.mockRejectedValue(new Error('network error'));

    const result = await service.processGift({ stagingId: 'stg-123' });

    expect(result).toEqual({
      status: 'error',
      stagingId: 'stg-123',
      error: 'gift_api_failed',
    });
    expect(twentyRequestMock).toHaveBeenCalledWith(
      'POST',
      '/gifts',
      expect.any(Object),
      'GiftStagingProcessingService',
    );
    expect(updateStatusByIdMock).toHaveBeenCalledTimes(2);
    expect(updateStatusByIdMock).toHaveBeenNthCalledWith(1, 'stg-123', {
      promotionStatus: 'committing',
    });
    expect(updateStatusByIdMock).toHaveBeenNthCalledWith(2, 'stg-123', {
      promotionStatus: 'commit_failed',
      errorDetail: 'network error',
    });
  });

  it('returns error when create gift response is invalid', async () => {
    getGiftStagingByIdMock.mockResolvedValue(baseStaging);
    twentyRequestMock.mockResolvedValue({ data: {} });

    const result = await service.processGift({ stagingId: 'stg-123' });

    expect(result).toEqual({
      status: 'error',
      stagingId: 'stg-123',
      error: 'gift_api_failed',
    });
    expect(markCommittedByIdMock).not.toHaveBeenCalled();
    expect(updateStatusByIdMock).toHaveBeenCalledTimes(2);
    expect(updateStatusByIdMock).toHaveBeenNthCalledWith(1, 'stg-123', {
      promotionStatus: 'committing',
    });
    expect(updateStatusByIdMock).toHaveBeenNthCalledWith(
      2,
      'stg-123',
      expect.objectContaining({
        promotionStatus: 'commit_failed',
        errorDetail: 'unexpected Twenty response (missing createGift)',
      }),
    );
  });

  it('returns error when create gift response is missing gift id', async () => {
    getGiftStagingByIdMock.mockResolvedValue(baseStaging);
    twentyRequestMock.mockResolvedValue({ data: { createGift: {} } });

    const result = await service.processGift({ stagingId: 'stg-123' });

    expect(result).toEqual({
      status: 'error',
      stagingId: 'stg-123',
      error: 'gift_api_failed',
    });
    expect(markCommittedByIdMock).not.toHaveBeenCalled();
    expect(updateStatusByIdMock).toHaveBeenCalledTimes(2);
    expect(updateStatusByIdMock).toHaveBeenNthCalledWith(1, 'stg-123', {
      promotionStatus: 'committing',
    });
    expect(updateStatusByIdMock).toHaveBeenNthCalledWith(
      2,
      'stg-123',
      expect.objectContaining({
        promotionStatus: 'commit_failed',
        errorDetail: 'unexpected Twenty response (missing createGift)',
      }),
    );
  });

  it('creates gift, marks staging committed, and returns success when eligible', async () => {
    getGiftStagingByIdMock.mockResolvedValue(baseStaging);
    twentyRequestMock.mockResolvedValue({
      data: { createGift: { id: 'gift-100' } },
    });

    const result = await service.processGift({ stagingId: 'stg-123' });

    expect(result).toEqual({
      status: 'committed',
      stagingId: 'stg-123',
      giftId: 'gift-100',
    });
    expect(twentyRequestMock).toHaveBeenCalledWith(
      'POST',
      '/gifts',
      expect.objectContaining({
        amount: { amountMicros: 12_340_000, currencyCode: 'GBP' },
      }),
      'GiftStagingProcessingService',
    );
    expect(markCommittedByIdMock).toHaveBeenCalledWith('stg-123', 'gift-100');
    expect(updateStatusByIdMock).toHaveBeenCalledTimes(1);
    expect(updateStatusByIdMock).toHaveBeenCalledWith('stg-123', {
      promotionStatus: 'committing',
    });
    expect(updateRecurringAgreementMock).not.toHaveBeenCalled();
  });

  it('updates recurring agreement when staging is linked', async () => {
    getGiftStagingByIdMock.mockResolvedValue({
      ...baseStaging,
      recurringAgreementId: 'ra-123',
      expectedAt: '2025-12-01',
    });
    twentyRequestMock.mockResolvedValue({
      data: { createGift: { id: 'gift-101' } },
    });

    const result = await service.processGift({ stagingId: 'stg-123' });

    expect(result).toEqual({
      status: 'committed',
      stagingId: 'stg-123',
      giftId: 'gift-101',
    });
    expect(markCommittedByIdMock).toHaveBeenCalledWith('stg-123', 'gift-101');
    expect(updateRecurringAgreementMock).toHaveBeenCalledWith('ra-123', {
      nextExpectedAt: '2025-12-01',
      status: 'active',
    });
  });
});
