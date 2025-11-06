import { Logger } from '@nestjs/common';
import { GiftService } from './gift.service';
import { TwentyApiService } from '../twenty/twenty-api.service';
import { GiftStagingService } from '../gift-staging/gift-staging.service';
import * as giftValidation from './gift.validation';
import type { GiftCreatePayload } from './gift.validation';
import { NormalizedGiftCreatePayload } from './gift.types';

jest.mock('@nestjs/common', () => ({
  ...jest.requireActual('@nestjs/common'),
  Logger: jest.fn().mockImplementation(() => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('GiftService - staging auto promote', () => {
  let giftService: GiftService;
  let twentyApiService: jest.Mocked<TwentyApiService>;
  let giftStagingService: jest.Mocked<GiftStagingService>;

  beforeEach(() => {
    twentyApiService = {
      request: jest.fn(),
    } as unknown as jest.Mocked<TwentyApiService>;

    giftStagingService = {
      stageGift: jest.fn(),
      markCommitted: jest.fn(),
      isEnabled: jest.fn(),
      updateStatusById: jest.fn(),
    } as unknown as jest.Mocked<GiftStagingService>;

    // Silence real logger instances instantiated inside GiftService.
    (Logger as unknown as jest.Mock).mockClear();

    giftService = new GiftService(twentyApiService, giftStagingService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns staging acknowledgement when autoPromote is false', async () => {
    const sanitizedPayload = { amount: { currencyCode: 'GBP', value: 15 } } as GiftCreatePayload;
    jest
      .spyOn(giftValidation, 'validateCreateGiftPayload')
      .mockReturnValue(sanitizedPayload);

    const preparedPayload: NormalizedGiftCreatePayload = {
      amount: { currencyCode: 'GBP', value: 15 },
      amountMinor: 1500,
      currency: 'GBP',
      intakeSource: 'manual_ui',
      sourceFingerprint: 'fp-123',
      autoPromote: false,
    };

    jest
      .spyOn(giftService as unknown as { prepareGiftPayload: () => Promise<NormalizedGiftCreatePayload> }, 'prepareGiftPayload')
      .mockResolvedValue(preparedPayload);

    giftStagingService.isEnabled.mockReturnValue(true);
    giftStagingService.stageGift.mockResolvedValue({
      id: 'stg-123',
      autoPromote: false,
      promotionStatus: 'pending',
      payload: preparedPayload,
    });

    const response = await giftService.createGift({});

    expect(response).toEqual({
      data: {
        giftStaging: {
          id: 'stg-123',
          autoPromote: false,
          promotionStatus: 'pending',
        },
      },
      meta: {
        stagedOnly: true,
      },
    });

    expect(twentyApiService.request).not.toHaveBeenCalled();
    expect(giftStagingService.markCommitted).not.toHaveBeenCalled();
    expect(giftStagingService.updateStatusById).not.toHaveBeenCalled();
  });

  it('commits gift immediately when autoPromote resolves true', async () => {
    const sanitizedPayload = { amount: { currencyCode: 'GBP', value: 20 } } as GiftCreatePayload;
    jest
      .spyOn(giftValidation, 'validateCreateGiftPayload')
      .mockReturnValue(sanitizedPayload);

    const preparedPayload: NormalizedGiftCreatePayload = {
      amount: { currencyCode: 'GBP', value: 20 },
      amountMinor: 2000,
      currency: 'GBP',
      intakeSource: 'manual_ui',
      sourceFingerprint: 'fp-456',
      autoPromote: true,
    };

    jest
      .spyOn(giftService as unknown as { prepareGiftPayload: () => Promise<NormalizedGiftCreatePayload> }, 'prepareGiftPayload')
      .mockResolvedValue(preparedPayload);

    giftStagingService.isEnabled.mockReturnValue(true);
    giftStagingService.stageGift.mockResolvedValue({
      id: 'stg-456',
      autoPromote: true,
      promotionStatus: 'committing',
      payload: preparedPayload,
    });

    twentyApiService.request.mockResolvedValue({ data: { createGift: { id: 'gift-789' } } });

    const response = await giftService.createGift({});

    expect(response).toEqual({ data: { createGift: { id: 'gift-789' } } });
    expect(twentyApiService.request).toHaveBeenCalledWith(
      'POST',
      '/gifts',
      expect.any(Object),
      expect.any(String),
    );
    expect(giftStagingService.markCommitted).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'stg-456',
        autoPromote: true,
        promotionStatus: 'committing',
      }),
      'gift-789',
    );
    expect(giftStagingService.updateStatusById).not.toHaveBeenCalled();
  });

  it('updates dedupe status when diagnostics present', async () => {
    const sanitizedPayload = { amount: { currencyCode: 'GBP', value: 30 } } as GiftCreatePayload;
    jest
      .spyOn(giftValidation, 'validateCreateGiftPayload')
      .mockReturnValue(sanitizedPayload);

    const preparedPayload: NormalizedGiftCreatePayload = {
      amount: { currencyCode: 'GBP', value: 30 },
      amountMinor: 3000,
      currency: 'GBP',
      intakeSource: 'csv_import',
      sourceFingerprint: 'fp-789',
      autoPromote: false,
      dedupeDiagnostics: {
        matchType: 'email',
        matchedDonorId: 'person-42',
        matchedBy: 'email',
        confidence: 1,
      },
    };

    jest
      .spyOn(giftService as unknown as { prepareGiftPayload: () => Promise<NormalizedGiftCreatePayload> }, 'prepareGiftPayload')
      .mockResolvedValue(preparedPayload);

    giftStagingService.isEnabled.mockReturnValue(true);
    giftStagingService.stageGift.mockResolvedValue({
      id: 'stg-900',
      autoPromote: false,
      promotionStatus: 'pending',
      payload: preparedPayload,
    });

    const response = await giftService.createGift({});

    expect(response).toEqual({
      data: {
        giftStaging: {
          id: 'stg-900',
          autoPromote: false,
          promotionStatus: 'pending',
        },
      },
      meta: {
        stagedOnly: true,
      },
    });

    expect(giftStagingService.updateStatusById).toHaveBeenCalledWith('stg-900', {
      dedupeStatus: 'matched_existing',
    });
  });

  it('passes appealId through to the Twenty API payload when present', async () => {
    const sanitizedPayload = {
      amount: { currencyCode: 'GBP', value: 25 },
      appealId: 'apl-123',
    } as GiftCreatePayload;

    jest
      .spyOn(giftValidation, 'validateCreateGiftPayload')
      .mockReturnValue(sanitizedPayload);

    const preparedPayload: NormalizedGiftCreatePayload = {
      amount: { currencyCode: 'GBP', value: 25 },
      amountMinor: 2500,
      currency: 'GBP',
      appealId: 'apl-123',
      autoPromote: true,
    };

    jest
      .spyOn(giftService as unknown as { prepareGiftPayload: () => Promise<NormalizedGiftCreatePayload> }, 'prepareGiftPayload')
      .mockResolvedValue(preparedPayload);

    giftStagingService.isEnabled.mockReturnValue(false);
    twentyApiService.request.mockResolvedValue({
      data: { createGift: { id: 'gift-appeal' } },
    });

    await giftService.createGift({});

    expect(twentyApiService.request).toHaveBeenCalledWith(
      'POST',
      '/gifts',
      expect.objectContaining({ appealId: 'apl-123' }),
      expect.any(String),
    );
  });
});
