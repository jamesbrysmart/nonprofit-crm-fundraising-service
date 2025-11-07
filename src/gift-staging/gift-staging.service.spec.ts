import { ConfigService } from '@nestjs/config';
import {
  GiftStagingService,
  GiftStagingListResult,
} from './gift-staging.service';
import { StructuredLoggerService } from '../logging/structured-logger.service';
import { TwentyApiService } from '../twenty/twenty-api.service';

describe('GiftStagingService', () => {
  let configService: jest.Mocked<ConfigService>;
  let logger: jest.Mocked<StructuredLoggerService>;
  let twentyApiService: jest.Mocked<TwentyApiService>;

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<StructuredLoggerService>;

    twentyApiService = {
      request: jest.fn(),
    } as unknown as jest.Mocked<TwentyApiService>;
  });

  const createService = (enabled: boolean) => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'FUNDRAISING_ENABLE_GIFT_STAGING') {
        return enabled ? 'true' : 'false';
      }
      if (key === 'FUNDRAISING_STAGING_AUTO_PROMOTE_DEFAULT') {
        return 'true';
      }
      return undefined;
    });

    return new GiftStagingService(configService, logger, twentyApiService);
  };

  it('returns empty result when staging disabled', async () => {
    const service = createService(false);

    const result = await service.listGiftStaging({});

    expect(result).toEqual({
      data: [],
      meta: { hasMore: false },
    });
    expect(twentyApiService.request).not.toHaveBeenCalled();
  });

  it('maps records from API response', async () => {
    const service = createService(true);

    twentyApiService.request.mockResolvedValue({
      data: {
        giftStagings: [
          {
            id: 'stg-1',
            promotionStatus: 'ready_for_commit',
            validationStatus: 'passed',
            dedupeStatus: 'passed',
            createdAt: '2025-10-08T12:00:00Z',
            updatedAt: '2025-10-08T12:10:00Z',
            amountMinor: 12345,
            currency: 'GBP',
            intakeSource: 'manual_ui',
            sourceFingerprint: 'fp-1',
            externalId: 'ext-1',
            giftBatchId: 'batch-1',
            autoPromote: false,
            paymentMethod: 'card',
            dateReceived: '2025-10-08',
            giftAidEligible: true,
            donorId: 'person-1',
            rawPayload: { foo: 'bar' },
          },
        ],
        pageInfo: {
          hasNextPage: true,
          endCursor: 'cursor-2',
        },
      },
    });

    const result = await service.listGiftStaging({ limit: 10 });

    expect(result.meta).toEqual({
      hasMore: true,
      nextCursor: 'cursor-2',
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: 'stg-1',
      createdAt: '2025-10-08T12:00:00Z',
      updatedAt: '2025-10-08T12:10:00Z',
      processingStatus: 'ready_for_commit',
      validationStatus: 'passed',
      dedupeStatus: 'passed',
      intakeSource: 'manual_ui',
      sourceFingerprint: 'fp-1',
      externalId: 'ext-1',
      giftBatchId: 'batch-1',
      autoPromote: false,
      amountMinor: 12345,
      currency: 'GBP',
      dateReceived: '2025-10-08',
      paymentMethod: 'card',
      giftAidEligible: true,
      donorId: 'person-1',
      rawPayloadAvailable: true,
    });
  });

  it('applies filters and sorting', async () => {
    const service = createService(true);

    twentyApiService.request.mockResolvedValue({
      data: {
        giftStagings: [
          {
            id: 'stg-1',
            promotionStatus: 'ready_for_commit',
            validationStatus: 'passed',
            dedupeStatus: 'passed',
            createdAt: '2025-10-08T12:00:00Z',
            amountMinor: 200,
            intakeSource: 'manual_ui',
            externalId: 'match-me',
          },
          {
            id: 'stg-2',
            promotionStatus: 'commit_failed',
            validationStatus: 'passed',
            dedupeStatus: 'passed',
            createdAt: '2025-10-08T11:00:00Z',
            amountMinor: 100,
            intakeSource: 'stripe_webhook',
            externalId: 'no-match',
            errorDetail: 'network error',
          },
        ],
      },
    });

    const result: GiftStagingListResult = await service.listGiftStaging({
      statuses: ['commit_failed'],
      intakeSources: ['stripe_webhook'],
      search: 'does-not-exist',
      sort: 'amountMinor:asc',
    });

    expect(result.data).toHaveLength(0);

    const relaxed: GiftStagingListResult = await service.listGiftStaging({
      statuses: ['commit_failed'],
      sort: 'amountMinor:asc',
    });

    expect(relaxed.data).toHaveLength(1);
    expect(relaxed.data[0].id).toBe('stg-2');
    expect(relaxed.data[0].errorDetail).toBe('network error');
  });
});
