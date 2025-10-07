import { BadRequestException } from '@nestjs/common';
import { GiftStagingPromotionService, PromoteGiftArgs } from './gift-staging-promotion.service';
import { GiftStagingService, GiftStagingEntity } from './gift-staging.service';
import { TwentyApiService } from '../twenty/twenty-api.service';
import { StructuredLoggerService } from '../logging/structured-logger.service';
import { NormalizedGiftCreatePayload } from '../gift/gift.types';

describe('GiftStagingPromotionService (manual promotion)', () => {
  let service: GiftStagingPromotionService;
  let giftStagingService: jest.Mocked<GiftStagingService>;
  let twentyApiService: jest.Mocked<TwentyApiService>;
  let structuredLogger: jest.Mocked<StructuredLoggerService>;

  const basePayload: NormalizedGiftCreatePayload = {
    amount: { currencyCode: 'GBP', value: 12.34 },
    amountMinor: 1234,
    currency: 'GBP',
    donorId: 'person-123',
    intakeSource: 'manual_ui',
    sourceFingerprint: 'fp-123',
  };

  const baseStaging: GiftStagingEntity = {
    id: 'stg-123',
    promotionStatus: 'ready_for_commit',
    validationStatus: 'passed',
    dedupeStatus: 'passed',
    rawPayload: JSON.stringify(basePayload),
  };

  beforeEach(() => {
    giftStagingService = {
      getGiftStagingById: jest.fn(),
      markCommittedById: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<GiftStagingService>;

    twentyApiService = {
      request: jest.fn(),
    } as unknown as jest.Mocked<TwentyApiService>;

    structuredLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as jest.Mocked<StructuredLoggerService>;

    service = new GiftStagingPromotionService(
      giftStagingService,
      twentyApiService,
      structuredLogger,
    );
  });

  it('rejects when stagingId is missing', async () => {
    await expect(service.promoteGift({ stagingId: '' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects when stagingId contains only whitespace', async () => {
    await expect(service.promoteGift({ stagingId: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns error when the staging record cannot be fetched', async () => {
    giftStagingService.getGiftStagingById.mockResolvedValue(undefined);

    const result = await service.promoteGift({ stagingId: 'stg-404' });

    expect(result).toEqual({
      status: 'error',
      stagingId: 'stg-404',
      error: 'fetch_failed',
    });
    expect(giftStagingService.getGiftStagingById).toHaveBeenCalledWith('stg-404');
  });

  it('returns committed immediately when the staging record is already committed', async () => {
    giftStagingService.getGiftStagingById.mockResolvedValue({
      ...baseStaging,
      promotionStatus: 'committed',
      giftId: 'gift-789',
    });

    const result = await service.promoteGift({ stagingId: 'stg-123' });

    expect(result).toEqual({ status: 'committed', stagingId: 'stg-123', giftId: 'gift-789' });
    expect(twentyApiService.request).not.toHaveBeenCalled();
    expect(giftStagingService.markCommittedById).not.toHaveBeenCalled();
  });

  it('defers when the staging record is currently committing', async () => {
    giftStagingService.getGiftStagingById.mockResolvedValue({
      ...baseStaging,
      promotionStatus: 'committing',
    });

    const result = await service.promoteGift({ stagingId: 'stg-123' });

    expect(result).toEqual({
      status: 'deferred',
      stagingId: 'stg-123',
      reason: 'locked',
    });
    expect(twentyApiService.request).not.toHaveBeenCalled();
  });

  it('defers when validation or dedupe has not passed', async () => {
    giftStagingService.getGiftStagingById.mockResolvedValue({
      ...baseStaging,
      validationStatus: 'pending',
    });

    const result = await service.promoteGift({ stagingId: 'stg-123' });

    expect(result).toEqual({
      status: 'deferred',
      stagingId: 'stg-123',
      reason: 'not_ready',
    });
    expect(twentyApiService.request).not.toHaveBeenCalled();
  });

  it('defers when raw payload is missing', async () => {
    giftStagingService.getGiftStagingById.mockResolvedValue({
      ...baseStaging,
      rawPayload: undefined,
    });

    const result = await service.promoteGift({ stagingId: 'stg-123' });

    expect(result).toEqual({
      status: 'deferred',
      stagingId: 'stg-123',
      reason: 'missing_payload',
    });
    expect(twentyApiService.request).not.toHaveBeenCalled();
  });

  it('defers when raw payload cannot be parsed', async () => {
    giftStagingService.getGiftStagingById.mockResolvedValue({
      ...baseStaging,
      rawPayload: '{',
    });

    const result = await service.promoteGift({ stagingId: 'stg-123' });

    expect(result).toEqual({
      status: 'deferred',
      stagingId: 'stg-123',
      reason: 'missing_payload',
    });
    expect(twentyApiService.request).not.toHaveBeenCalled();
  });

  it('returns error when parsed payload misses required fields', async () => {
    const invalidPayload = { ...basePayload };
    delete invalidPayload.donorId;

    giftStagingService.getGiftStagingById.mockResolvedValue({
      ...baseStaging,
      rawPayload: JSON.stringify(invalidPayload),
    });

    const result = await service.promoteGift({ stagingId: 'stg-123' });

    expect(result).toEqual({
      status: 'error',
      stagingId: 'stg-123',
      error: 'payload_invalid',
    });
    expect(twentyApiService.request).not.toHaveBeenCalled();
  });

  it('returns error when Twenty API call fails', async () => {
    giftStagingService.getGiftStagingById.mockResolvedValue(baseStaging);
    twentyApiService.request.mockRejectedValue(new Error('network error'));

    const result = await service.promoteGift({ stagingId: 'stg-123' });

    expect(result).toEqual({
      status: 'error',
      stagingId: 'stg-123',
      error: 'gift_api_failed',
    });
    expect(twentyApiService.request).toHaveBeenCalledWith(
      'POST',
      '/gifts',
      expect.any(Object),
      'GiftStagingPromotionService',
    );
  });

  it('returns error when create gift response is invalid', async () => {
    giftStagingService.getGiftStagingById.mockResolvedValue(baseStaging);
    twentyApiService.request.mockResolvedValue({ data: {} });

    const result = await service.promoteGift({ stagingId: 'stg-123' });

    expect(result).toEqual({
      status: 'error',
      stagingId: 'stg-123',
      error: 'gift_api_failed',
    });
    expect(giftStagingService.markCommittedById).not.toHaveBeenCalled();
  });

  it('creates gift, marks staging committed, and returns success when eligible', async () => {
    giftStagingService.getGiftStagingById.mockResolvedValue(baseStaging);
    twentyApiService.request.mockResolvedValue({ data: { createGift: { id: 'gift-100' } } });

    const result = await service.promoteGift({ stagingId: 'stg-123' });

    expect(result).toEqual({ status: 'committed', stagingId: 'stg-123', giftId: 'gift-100' });
    expect(twentyApiService.request).toHaveBeenCalledWith(
      'POST',
      '/gifts',
      expect.objectContaining({ amount: basePayload.amount }),
      'GiftStagingPromotionService',
    );
    expect(giftStagingService.markCommittedById).toHaveBeenCalledWith('stg-123', 'gift-100');
  });
});
