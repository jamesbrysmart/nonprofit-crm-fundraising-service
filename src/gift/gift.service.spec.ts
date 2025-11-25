import { Logger } from '@nestjs/common';
import { GiftService } from './gift.service';
import { TwentyApiService } from '../twenty/twenty-api.service';
import { GiftStagingService } from '../gift-staging/gift-staging.service';
import * as giftValidation from './gift.validation';
import type { GiftCreatePayload } from './gift.validation';
import { NormalizedGiftCreatePayload } from './gift.types';
import { ReceiptPolicyService } from '../receipt/receipt-policy.service';

describe('GiftService - staging auto promote', () => {
  let giftService: GiftService;
  let twentyApiService: jest.Mocked<TwentyApiService>;
  let giftStagingService: jest.Mocked<GiftStagingService>;
  let twentyRequestMock: jest.MockedFunction<TwentyApiService['request']>;
  let stageGiftMock: jest.MockedFunction<GiftStagingService['stageGift']>;
  let markCommittedMock: jest.MockedFunction<
    GiftStagingService['markCommitted']
  >;
  let isStagingEnabledMock: jest.MockedFunction<
    GiftStagingService['isEnabled']
  >;
  let updateStatusMock: jest.MockedFunction<
    GiftStagingService['updateStatusById']
  >;

  beforeEach(() => {
    twentyRequestMock = jest.fn();
    twentyApiService = {
      request: twentyRequestMock,
    } as unknown as jest.Mocked<TwentyApiService>;

    stageGiftMock = jest.fn();
    markCommittedMock = jest.fn();
    isStagingEnabledMock = jest.fn();
    updateStatusMock = jest.fn();

    giftStagingService = {
      stageGift: stageGiftMock,
      markCommitted: markCommittedMock,
      isEnabled: isStagingEnabledMock,
      updateStatusById: updateStatusMock,
    } as unknown as jest.Mocked<GiftStagingService>;

    const receiptPolicyService = {
      applyReceiptMetadata: jest.fn(
        (value: NormalizedGiftCreatePayload) => value,
      ),
    } as unknown as jest.Mocked<ReceiptPolicyService>;

    jest.spyOn(Logger.prototype, 'log').mockImplementation(jest.fn());
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(jest.fn());
    jest.spyOn(Logger.prototype, 'error').mockImplementation(jest.fn());

    giftService = new GiftService(
      twentyApiService,
      giftStagingService,
      receiptPolicyService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns staging acknowledgement when autoPromote is false', async () => {
    const sanitizedPayload = {
      amount: { currencyCode: 'GBP', value: 15 },
    } as GiftCreatePayload;
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
      .spyOn(
        giftService as unknown as {
          prepareGiftPayload: () => Promise<NormalizedGiftCreatePayload>;
        },
        'prepareGiftPayload',
      )
      .mockResolvedValue(preparedPayload);

    isStagingEnabledMock.mockReturnValue(true);
    stageGiftMock.mockResolvedValue({
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

    expect(twentyRequestMock).not.toHaveBeenCalled();
    expect(markCommittedMock).not.toHaveBeenCalled();
    expect(updateStatusMock).not.toHaveBeenCalled();
  });

  it('commits gift immediately when autoPromote resolves true', async () => {
    const sanitizedPayload = {
      amount: { currencyCode: 'GBP', value: 20 },
    } as GiftCreatePayload;
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
      .spyOn(
        giftService as unknown as {
          prepareGiftPayload: () => Promise<NormalizedGiftCreatePayload>;
        },
        'prepareGiftPayload',
      )
      .mockResolvedValue(preparedPayload);

    isStagingEnabledMock.mockReturnValue(true);
    stageGiftMock.mockResolvedValue({
      id: 'stg-456',
      autoPromote: true,
      promotionStatus: 'committing',
      payload: preparedPayload,
    });

    twentyRequestMock.mockResolvedValue({
      data: { createGift: { id: 'gift-789' } },
    });

    const response = await giftService.createGift({});

    expect(response).toEqual({ data: { createGift: { id: 'gift-789' } } });
    expect(twentyRequestMock).toHaveBeenCalledWith(
      'POST',
      '/gifts',
      expect.any(Object),
      expect.any(String),
    );
    expect(markCommittedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'stg-456',
        autoPromote: true,
        promotionStatus: 'committing',
      }),
      'gift-789',
    );
    expect(updateStatusMock).not.toHaveBeenCalled();
  });

  it('updates dedupe status when diagnostics present', async () => {
    const sanitizedPayload = {
      amount: { currencyCode: 'GBP', value: 30 },
    } as GiftCreatePayload;
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
      .spyOn(
        giftService as unknown as {
          prepareGiftPayload: () => Promise<NormalizedGiftCreatePayload>;
        },
        'prepareGiftPayload',
      )
      .mockResolvedValue(preparedPayload);

    isStagingEnabledMock.mockReturnValue(true);
    stageGiftMock.mockResolvedValue({
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

    expect(updateStatusMock).toHaveBeenCalledWith('stg-900', {
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
      .spyOn(
        giftService as unknown as {
          prepareGiftPayload: () => Promise<NormalizedGiftCreatePayload>;
        },
        'prepareGiftPayload',
      )
      .mockResolvedValue(preparedPayload);

    isStagingEnabledMock.mockReturnValue(false);
    twentyRequestMock.mockResolvedValue({
      data: { createGift: { id: 'gift-appeal' } },
    });

    await giftService.createGift({});

    expect(twentyRequestMock).toHaveBeenCalledWith(
      'POST',
      '/gifts',
      expect.objectContaining({ appealId: 'apl-123' }),
      expect.any(String),
    );
  });
});
