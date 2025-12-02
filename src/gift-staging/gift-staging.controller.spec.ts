import {
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GiftStagingController } from './gift-staging.controller';
import {
  GiftStagingService,
  GiftStagingListResult,
} from './gift-staging.service';
import {
  GiftStagingProcessingService,
  ProcessGiftResult,
} from './gift-staging-processing.service';
import { GiftService } from '../gift/gift.service';
import { NormalizedGiftCreatePayload } from '../gift/gift.types';

describe('GiftStagingController', () => {
  let controller: GiftStagingController;
  let giftStagingService: jest.Mocked<GiftStagingService>;
  let giftStagingProcessingService: jest.Mocked<GiftStagingProcessingService>;
  let giftService: jest.Mocked<GiftService>;
  let isEnabledMock: jest.MockedFunction<GiftStagingService['isEnabled']>;
  let listGiftStagingMock: jest.MockedFunction<
    GiftStagingService['listGiftStaging']
  >;
  let updateStatusByIdMock: jest.MockedFunction<
    GiftStagingService['updateStatusById']
  >;
  let stageGiftMock: jest.MockedFunction<GiftStagingService['stageGift']>;
  let getGiftStagingByIdMock: jest.MockedFunction<
    GiftStagingService['getGiftStagingById']
  >;
  let processGiftMock: jest.MockedFunction<
    GiftStagingProcessingService['processGift']
  >;
  let normalizeGiftPayloadMock: jest.MockedFunction<
    GiftService['normalizeCreateGiftPayload']
  >;

  beforeEach(() => {
    isEnabledMock = jest.fn();
    listGiftStagingMock = jest.fn();
    updateStatusByIdMock = jest.fn();
    stageGiftMock = jest.fn();
    getGiftStagingByIdMock = jest.fn();
    processGiftMock = jest.fn();
    normalizeGiftPayloadMock = jest.fn();

    giftStagingService = {
      isEnabled: isEnabledMock,
      listGiftStaging: listGiftStagingMock,
      updateStatusById: updateStatusByIdMock,
      stageGift: stageGiftMock,
      getGiftStagingById: getGiftStagingByIdMock,
    } as unknown as jest.Mocked<GiftStagingService>;

    giftStagingProcessingService = {
      processGift: processGiftMock,
    } as unknown as jest.Mocked<GiftStagingProcessingService>;

    giftService = {
      normalizeCreateGiftPayload: normalizeGiftPayloadMock,
    } as unknown as jest.Mocked<GiftService>;

    controller = new GiftStagingController(
      giftStagingService,
      giftStagingProcessingService,
      giftService,
    );
  });

  it('throws ServiceUnavailableException when staging is disabled', async () => {
    isEnabledMock.mockReturnValue(false);

    await expect(controller.processGift('stg-123')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(processGiftMock).not.toHaveBeenCalled();
  });

  it('throws when listing and staging is disabled', async () => {
    isEnabledMock.mockReturnValue(false);

    await expect(controller.listGiftStaging({})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(listGiftStagingMock).not.toHaveBeenCalled();
  });

  it('delegates listing to service with normalized params', async () => {
    isEnabledMock.mockReturnValue(true);
    const result: GiftStagingListResult = {
      data: [],
      meta: { hasMore: false },
    };
    listGiftStagingMock.mockResolvedValue(result);

    await expect(
      controller.listGiftStaging({
        status: ['ready_for_commit', 'commit_failed'],
        intakeSource: 'manual_ui,stripe_webhook',
        search: 'ABC',
        cursor: 'cursor123',
        limit: '50',
        sort: 'updatedAt:asc',
      }),
    ).resolves.toEqual(result);

    expect(listGiftStagingMock).toHaveBeenCalledWith({
      statuses: ['ready_for_commit', 'commit_failed'],
      intakeSources: ['manual_ui', 'stripe_webhook'],
      search: 'ABC',
      cursor: 'cursor123',
      limit: 50,
      sort: 'updatedAt:asc',
    });
  });

  it('returns single staging record when available', async () => {
    isEnabledMock.mockReturnValue(true);
    getGiftStagingByIdMock.mockResolvedValue({
      id: 'stg-200',
      promotionStatus: 'pending',
    });

    await expect(controller.getGiftStaging('stg-200')).resolves.toEqual({
      data: {
        giftStaging: {
          id: 'stg-200',
          promotionStatus: 'pending',
        },
      },
    });
  });

  it('throws NotFoundException when staging record missing', async () => {
    isEnabledMock.mockReturnValue(true);
    getGiftStagingByIdMock.mockResolvedValue(undefined);

    await expect(controller.getGiftStaging('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('delegates to processing service when enabled', async () => {
    isEnabledMock.mockReturnValue(true);
    const result: ProcessGiftResult = {
      status: 'committed',
      stagingId: 'stg-123',
      giftId: 'gift-456',
    };
    processGiftMock.mockResolvedValue(result);

    await expect(controller.processGift('stg-123')).resolves.toEqual(result);

    expect(processGiftMock).toHaveBeenCalledWith({
      stagingId: 'stg-123',
    });
  });

  it('propagates errors from the processing service', async () => {
    isEnabledMock.mockReturnValue(true);
    const error = new ServiceUnavailableException('failed');
    processGiftMock.mockRejectedValue(error);

    await expect(controller.processGift('stg-123')).rejects.toThrow('failed');
  });

  it('updates status when staging is enabled', async () => {
    isEnabledMock.mockReturnValue(true);

    await expect(
      controller.updateStatus('stg-123', {
        promotionStatus: 'ready_for_commit',
        validationStatus: 'passed',
        dedupeStatus: 'passed',
      }),
    ).resolves.toEqual({ ok: true });

    expect(updateStatusByIdMock).toHaveBeenCalledWith('stg-123', {
      promotionStatus: 'ready_for_commit',
      validationStatus: 'passed',
      dedupeStatus: 'passed',
    });
  });

  it('throws when staging disabled for status update', async () => {
    isEnabledMock.mockReturnValue(false);

    await expect(controller.updateStatus('stg-123', {})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(updateStatusByIdMock).not.toHaveBeenCalled();
  });

  it('creates a staging record when enabled', async () => {
    isEnabledMock.mockReturnValue(true);

    const normalizedPayload: NormalizedGiftCreatePayload = {
      amount: { currencyCode: 'GBP', amountMicros: 25_000_000 },
      amountMinor: 2500,
      amountMajor: 25,
      currency: 'GBP',
      intakeSource: 'manual_ui',
      sourceFingerprint: 'fp-1',
      autoPromote: true,
      donorId: 'person-1',
    };

    normalizeGiftPayloadMock.mockResolvedValue({
      ...normalizedPayload,
    });

    stageGiftMock.mockResolvedValue({
      id: 'stg-111',
      autoPromote: false,
      promotionStatus: 'pending',
      payload: { ...normalizedPayload, autoPromote: false },
    });

    getGiftStagingByIdMock.mockResolvedValue({
      id: 'stg-111',
      promotionStatus: 'pending',
      validationStatus: 'pending',
      dedupeStatus: 'pending',
      autoPromote: false,
    });

    await expect(
      controller.createGiftStaging({
        amount: { currencyCode: 'GBP', amountMicros: 25_000_000 },
      }),
    ).resolves.toEqual({
      data: {
        giftStaging: {
          id: 'stg-111',
          autoPromote: false,
          promotionStatus: 'pending',
          validationStatus: 'pending',
          dedupeStatus: 'pending',
        },
      },
      meta: {
        stagedOnly: true,
        rawPayload: undefined,
        rawPayloadAvailable: false,
      },
    });

    expect(normalizeGiftPayloadMock).toHaveBeenCalledWith({
      amount: { currencyCode: 'GBP', amountMicros: 25_000_000 },
    });
    expect(stageGiftMock).toHaveBeenCalledWith(
      expect.objectContaining({ autoPromote: false }),
    );
  });

  it('throws when staging creation fails', async () => {
    isEnabledMock.mockReturnValue(true);
    normalizeGiftPayloadMock.mockResolvedValue({
      amount: { currencyCode: 'GBP', amountMicros: 10_000_000 },
      amountMinor: 1000,
      amountMajor: 10,
      currency: 'GBP',
      intakeSource: 'manual_ui',
      sourceFingerprint: 'fp-2',
      autoPromote: false,
      donorId: 'person-2',
    });
    stageGiftMock.mockResolvedValue(undefined);

    await expect(controller.createGiftStaging({})).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('throws when staging is disabled for create', async () => {
    isEnabledMock.mockReturnValue(false);

    await expect(controller.createGiftStaging({})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(normalizeGiftPayloadMock).not.toHaveBeenCalled();
  });
});
