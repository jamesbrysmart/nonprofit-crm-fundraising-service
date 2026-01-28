import { Logger } from '@nestjs/common';
import { GiftService } from './gift.service';
import { TwentyApiService } from '../twenty/twenty-api.service';
import { GiftStagingService } from '../gift-staging/gift-staging.service';
import * as giftValidation from './gift.validation';
import type { GiftCreatePayload } from './gift.validation';
import { NormalizedGiftCreatePayload } from './gift.types';
import { ReceiptPolicyService } from '../receipt/receipt-policy.service';

describe('GiftService - staging auto process', () => {
  let giftService: GiftService;
  let twentyApiService: jest.Mocked<TwentyApiService>;
  let giftStagingService: jest.Mocked<GiftStagingService>;
  let twentyRequestMock: jest.MockedFunction<TwentyApiService['request']>;
  let stageGiftMock: jest.MockedFunction<GiftStagingService['stageGift']>;
  let markProcessedMock: jest.MockedFunction<
    GiftStagingService['markProcessed']
  >;
  let isStagingEnabledMock: jest.MockedFunction<
    GiftStagingService['isEnabled']
  >;
  let updateStatusMock: jest.MockedFunction<
    GiftStagingService['updateStatusById']
  >;
  let resolveAutoProcessIntentMock: jest.MockedFunction<
    GiftStagingService['resolveAutoProcessIntent']
  >;

  beforeEach(() => {
    twentyRequestMock = jest.fn();
    twentyApiService = {
      request: twentyRequestMock,
    } as unknown as jest.Mocked<TwentyApiService>;

    stageGiftMock = jest.fn();
    markProcessedMock = jest.fn();
    isStagingEnabledMock = jest.fn();
    updateStatusMock = jest.fn();
    resolveAutoProcessIntentMock = jest.fn();

    giftStagingService = {
      stageGift: stageGiftMock,
      markProcessed: markProcessedMock,
      isEnabled: isStagingEnabledMock,
      updateStatusById: updateStatusMock,
      resolveAutoProcessIntent: resolveAutoProcessIntentMock,
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

    resolveAutoProcessIntentMock.mockImplementation((payload) =>
      typeof payload.autoProcess === 'boolean' ? payload.autoProcess : false,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns staging acknowledgement when autoProcess is false', async () => {
    const sanitizedPayload = {
      amount: { currencyCode: 'GBP', amountMicros: 15_000_000 },
    } as GiftCreatePayload;
    jest
      .spyOn(giftValidation, 'validateCreateGiftPayload')
      .mockReturnValue(sanitizedPayload);

    const preparedPayload: NormalizedGiftCreatePayload = {
      amount: { currencyCode: 'GBP', amountMicros: 15_000_000 },
      intakeSource: 'manual_ui',
      sourceFingerprint: 'fp-123',
      autoProcess: false,
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
      autoProcess: false,
      processingStatus: 'pending',
      payload: preparedPayload,
    });

    const response = (await giftService.createGift({})) as Record<
      string,
      any
    >;

    expect(response).toMatchObject({
      data: {
        giftStaging: {
          id: 'stg-123',
          autoProcess: false,
          processingStatus: 'pending',
        },
      },
      meta: {
        stagedOnly: true,
      },
    });
    expect(response.meta).toHaveProperty('processingDiagnostics');
    expect(response.meta.processingDiagnostics).toMatchObject({
      processingEligibility: expect.any(String),
      processingBlockers: expect.any(Array),
      processingWarnings: expect.any(Array),
      identityConfidence: expect.any(String),
    });

    expect(twentyRequestMock).not.toHaveBeenCalled();
    expect(markProcessedMock).not.toHaveBeenCalled();
    expect(updateStatusMock).not.toHaveBeenCalled();
  });

  it('processes gift immediately when autoProcess resolves true', async () => {
    const sanitizedPayload = {
      amount: { currencyCode: 'GBP', amountMicros: 20_000_000 },
    } as GiftCreatePayload;
    jest
      .spyOn(giftValidation, 'validateCreateGiftPayload')
      .mockReturnValue(sanitizedPayload);

    const preparedPayload: NormalizedGiftCreatePayload = {
      amount: { currencyCode: 'GBP', amountMicros: 20_000_000 },
      intakeSource: 'manual_ui',
      sourceFingerprint: 'fp-456',
      autoProcess: true,
      donorId: 'person-99',
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
      autoProcess: true,
      processingStatus: 'processing',
      payload: preparedPayload,
    });

    twentyRequestMock.mockResolvedValue({
      data: { createGift: { id: 'gift-789' } },
    });

    const response = (await giftService.createGift({})) as Record<
      string,
      any
    >;

    expect(response).toEqual({ data: { createGift: { id: 'gift-789' } } });
    expect(twentyRequestMock).toHaveBeenCalledWith(
      'POST',
      '/gifts',
      expect.any(Object),
      expect.any(String),
    );
    expect(markProcessedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'stg-456',
        autoProcess: true,
        processingStatus: 'processing',
      }),
      'gift-789',
    );
    expect(updateStatusMock).not.toHaveBeenCalled();
  });

  it('updates dedupe status when diagnostics present', async () => {
    const sanitizedPayload = {
      amount: { currencyCode: 'GBP', amountMicros: 30_000_000 },
    } as GiftCreatePayload;
    jest
      .spyOn(giftValidation, 'validateCreateGiftPayload')
      .mockReturnValue(sanitizedPayload);

    const preparedPayload: NormalizedGiftCreatePayload = {
      amount: { currencyCode: 'GBP', amountMicros: 30_000_000 },
      intakeSource: 'csv_import',
      sourceFingerprint: 'fp-789',
      autoProcess: false,
      dedupeDiagnostics: {
        matchType: 'email',
        matchedDonorId: 'person-42',
        matchedBy: 'email',
        confidence: 1,
      },
      donorId: 'person-42',
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
      autoProcess: false,
      processingStatus: 'pending',
      payload: preparedPayload,
    });

    const response = (await giftService.createGift({})) as Record<
      string,
      any
    >;

    expect(response).toMatchObject({
      data: {
        giftStaging: {
          id: 'stg-900',
          autoProcess: false,
          processingStatus: 'pending',
        },
      },
      meta: {
        stagedOnly: true,
      },
    });
    expect(response.meta).toHaveProperty('processingDiagnostics');
    expect(response.meta.processingDiagnostics).toMatchObject({
      processingEligibility: expect.any(String),
      processingBlockers: expect.any(Array),
      processingWarnings: expect.any(Array),
      identityConfidence: expect.any(String),
    });

    expect(updateStatusMock).toHaveBeenCalledWith('stg-900', {
      dedupeStatus: 'matched_existing',
    });
  });

  it('suppresses auto-process when eligibility is blocked', async () => {
    const sanitizedPayload = {
      amount: { currencyCode: 'GBP', amountMicros: 40_000_000 },
    } as GiftCreatePayload;
    jest
      .spyOn(giftValidation, 'validateCreateGiftPayload')
      .mockReturnValue(sanitizedPayload);

    const preparedPayload: NormalizedGiftCreatePayload = {
      amount: { currencyCode: 'GBP', amountMicros: 40_000_000 },
      intakeSource: 'manual_ui',
      sourceFingerprint: 'fp-eligibility',
      autoProcess: true,
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
      id: 'stg-eligibility',
      autoProcess: false,
      processingStatus: 'pending',
      payload: preparedPayload,
    });

    const response = (await giftService.createGift({})) as Record<
      string,
      any
    >;

    expect(response).toMatchObject({
      data: {
        giftStaging: {
          id: 'stg-eligibility',
          autoProcess: false,
          processingStatus: 'pending',
        },
      },
      meta: {
        stagedOnly: true,
      },
    });
    expect(response.meta).toHaveProperty('processingDiagnostics');
    expect(response.meta.processingDiagnostics).toMatchObject({
      processingEligibility: expect.any(String),
      processingBlockers: expect.any(Array),
      processingWarnings: expect.any(Array),
      identityConfidence: expect.any(String),
    });
    expect(twentyRequestMock).not.toHaveBeenCalled();
  });

  it('requires strong identity for medium-trust sources', async () => {
    const sanitizedPayload = {
      amount: { currencyCode: 'GBP', amountMicros: 45_000_000 },
    } as GiftCreatePayload;
    jest
      .spyOn(giftValidation, 'validateCreateGiftPayload')
      .mockReturnValue(sanitizedPayload);

    const preparedPayload: NormalizedGiftCreatePayload = {
      amount: { currencyCode: 'GBP', amountMicros: 45_000_000 },
      intakeSource: 'stripe_webhook',
      sourceFingerprint: 'fp-medium',
      autoProcess: true,
      dedupeDiagnostics: {
        matchType: 'name',
        matchedDonorId: 'person-200',
        matchedBy: 'name',
        confidence: 0.5,
      },
      donorId: 'person-200',
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
      id: 'stg-medium',
      autoProcess: false,
      processingStatus: 'pending',
      payload: preparedPayload,
    });

    const response = (await giftService.createGift({})) as Record<
      string,
      any
    >;

    expect(response).toMatchObject({
      data: {
        giftStaging: {
          id: 'stg-medium',
          autoProcess: false,
          processingStatus: 'pending',
        },
      },
      meta: {
        stagedOnly: true,
      },
    });
    expect(response.meta).toHaveProperty('processingDiagnostics');
    expect(response.meta.processingDiagnostics).toMatchObject({
      processingEligibility: expect.any(String),
      processingBlockers: expect.any(Array),
      processingWarnings: expect.any(Array),
      identityConfidence: expect.any(String),
    });
    expect(twentyRequestMock).not.toHaveBeenCalled();
  });

  it('blocks processing when recurring intent lacks agreement id', async () => {
    const sanitizedPayload = {
      amount: { currencyCode: 'GBP', amountMicros: 55_000_000 },
    } as GiftCreatePayload;
    jest
      .spyOn(giftValidation, 'validateCreateGiftPayload')
      .mockReturnValue(sanitizedPayload);

    const preparedPayload: NormalizedGiftCreatePayload = {
      amount: { currencyCode: 'GBP', amountMicros: 55_000_000 },
      intakeSource: 'manual_ui',
      sourceFingerprint: 'fp-recurring',
      autoProcess: true,
      giftIntent: 'recurring',
      donorId: 'person-recurring',
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
      id: 'stg-recurring',
      autoProcess: false,
      processingStatus: 'pending',
      payload: preparedPayload,
    });

    const response = (await giftService.createGift({})) as Record<
      string,
      any
    >;

    expect(response).toMatchObject({
      data: {
        giftStaging: {
          id: 'stg-recurring',
          autoProcess: false,
          processingStatus: 'pending',
        },
      },
      meta: {
        stagedOnly: true,
      },
    });
    expect(response.meta).toHaveProperty('processingDiagnostics');
    expect(response.meta.processingDiagnostics).toMatchObject({
      processingEligibility: expect.any(String),
      processingBlockers: expect.any(Array),
      processingWarnings: expect.any(Array),
      identityConfidence: expect.any(String),
    });
    expect(twentyRequestMock).not.toHaveBeenCalled();
  });

  it('auto-processes low-trust gifts when identity is strong', async () => {
    const sanitizedPayload = {
      amount: { currencyCode: 'GBP', amountMicros: 60_000_000 },
    } as GiftCreatePayload;
    jest
      .spyOn(giftValidation, 'validateCreateGiftPayload')
      .mockReturnValue(sanitizedPayload);

    const preparedPayload: NormalizedGiftCreatePayload = {
      amount: { currencyCode: 'GBP', amountMicros: 60_000_000 },
      intakeSource: 'csv_import',
      sourceFingerprint: 'fp-low-trust-strong',
      autoProcess: true,
      dedupeDiagnostics: {
        matchType: 'email',
        matchedDonorId: 'person-strong',
        matchedBy: 'email',
        confidence: 1,
      },
      donorId: 'person-strong',
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
      id: 'stg-low-trust-strong',
      autoProcess: true,
      processingStatus: 'processing',
      payload: preparedPayload,
    });

    twentyRequestMock.mockResolvedValue({
      data: { createGift: { id: 'gift-strong' } },
    });

    const response = await giftService.createGift({});

    expect(response).toEqual({ data: { createGift: { id: 'gift-strong' } } });
    expect(twentyRequestMock).toHaveBeenCalledWith(
      'POST',
      '/gifts',
      expect.any(Object),
      expect.any(String),
    );
  });

  it('passes appealId through to the Twenty API payload when present', async () => {
    const sanitizedPayload = {
      amount: { currencyCode: 'GBP', amountMicros: 25_000_000 },
      appealId: 'apl-123',
    } as GiftCreatePayload;

    jest
      .spyOn(giftValidation, 'validateCreateGiftPayload')
      .mockReturnValue(sanitizedPayload);

    const preparedPayload: NormalizedGiftCreatePayload = {
      amount: { currencyCode: 'GBP', amountMicros: 25_000_000 },
      appealId: 'apl-123',
      autoProcess: true,
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
