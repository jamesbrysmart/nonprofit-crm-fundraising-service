import {
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GiftStagingController } from './gift-staging.controller';
import { GiftStagingService, GiftStagingListResult } from './gift-staging.service';
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

  beforeEach(() => {
    giftStagingService = {
      isEnabled: jest.fn(),
      listGiftStaging: jest.fn(),
      updateStatusById: jest.fn(),
      stageGift: jest.fn(),
      getGiftStagingById: jest.fn(),
    } as unknown as jest.Mocked<GiftStagingService>;

    giftStagingProcessingService = {
      processGift: jest.fn(),
    } as unknown as jest.Mocked<GiftStagingProcessingService>;

    giftService = {
      normalizeCreateGiftPayload: jest.fn(),
    } as unknown as jest.Mocked<GiftService>;

    controller = new GiftStagingController(
      giftStagingService,
      giftStagingProcessingService,
      giftService,
    );
  });

  it('throws ServiceUnavailableException when staging is disabled', async () => {
    giftStagingService.isEnabled.mockReturnValue(false);

    await expect(controller.processGift('stg-123')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(giftStagingProcessingService.processGift).not.toHaveBeenCalled();
  });

  it('throws when listing and staging is disabled', async () => {
    giftStagingService.isEnabled.mockReturnValue(false);

    await expect(controller.listGiftStaging({})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(giftStagingService.listGiftStaging).not.toHaveBeenCalled();
  });

  it('delegates listing to service with normalized params', async () => {
    giftStagingService.isEnabled.mockReturnValue(true);
    const result: GiftStagingListResult = {
      data: [],
      meta: { hasMore: false },
    };
    giftStagingService.listGiftStaging.mockResolvedValue(result);

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

    expect(giftStagingService.listGiftStaging).toHaveBeenCalledWith({
      statuses: ['ready_for_commit', 'commit_failed'],
      intakeSources: ['manual_ui', 'stripe_webhook'],
      search: 'ABC',
      cursor: 'cursor123',
      limit: 50,
      sort: 'updatedAt:asc',
    });
  });

  it('returns single staging record when available', async () => {
    giftStagingService.isEnabled.mockReturnValue(true);
    giftStagingService.getGiftStagingById.mockResolvedValue({
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
    giftStagingService.isEnabled.mockReturnValue(true);
    giftStagingService.getGiftStagingById.mockResolvedValue(undefined);

    await expect(controller.getGiftStaging('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('delegates to processing service when enabled', async () => {
    giftStagingService.isEnabled.mockReturnValue(true);
    const result: ProcessGiftResult = {
      status: 'committed',
      stagingId: 'stg-123',
      giftId: 'gift-456',
    };
    giftStagingProcessingService.processGift.mockResolvedValue(result);

    await expect(controller.processGift('stg-123')).resolves.toEqual(result);

    expect(giftStagingProcessingService.processGift).toHaveBeenCalledWith({ stagingId: 'stg-123' });
  });

  it('propagates errors from the processing service', async () => {
    giftStagingService.isEnabled.mockReturnValue(true);
    const error = new ServiceUnavailableException('failed');
    giftStagingProcessingService.processGift.mockRejectedValue(error);

    await expect(controller.processGift('stg-123')).rejects.toThrow('failed');
  });

  it('updates status when staging is enabled', async () => {
    giftStagingService.isEnabled.mockReturnValue(true);

    await expect(
      controller.updateStatus('stg-123', {
        promotionStatus: 'ready_for_commit',
        validationStatus: 'passed',
        dedupeStatus: 'passed',
      }),
    ).resolves.toEqual({ ok: true });

    expect(giftStagingService.updateStatusById).toHaveBeenCalledWith('stg-123', {
      promotionStatus: 'ready_for_commit',
      validationStatus: 'passed',
      dedupeStatus: 'passed',
    });
  });

  it('throws when staging disabled for status update', async () => {
    giftStagingService.isEnabled.mockReturnValue(false);

    await expect(controller.updateStatus('stg-123', {})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(giftStagingService.updateStatusById).not.toHaveBeenCalled();
  });

  it('creates a staging record when enabled', async () => {
    giftStagingService.isEnabled.mockReturnValue(true);

    const normalizedPayload: NormalizedGiftCreatePayload = {
      amount: { currencyCode: 'GBP', value: 25 },
      amountMinor: 2500,
      currency: 'GBP',
      intakeSource: 'manual_ui',
      sourceFingerprint: 'fp-1',
      autoPromote: true,
      donorId: 'person-1',
    };

    giftService.normalizeCreateGiftPayload.mockResolvedValue({
      ...normalizedPayload,
    });

    giftStagingService.stageGift.mockResolvedValue({
      id: 'stg-111',
      autoPromote: false,
      promotionStatus: 'pending',
      payload: { ...normalizedPayload, autoPromote: false },
    });

    giftStagingService.getGiftStagingById.mockResolvedValue({
      id: 'stg-111',
      promotionStatus: 'pending',
      validationStatus: 'pending',
      dedupeStatus: 'pending',
      autoPromote: false,
    });

    await expect(controller.createGiftStaging({ amount: { currencyCode: 'GBP', value: 25 } })).resolves.toEqual(
      {
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
      },
    );

    expect(giftService.normalizeCreateGiftPayload).toHaveBeenCalledWith({ amount: { currencyCode: 'GBP', value: 25 } });
    expect(giftStagingService.stageGift).toHaveBeenCalledWith(
      expect.objectContaining({ autoPromote: false }),
    );
  });

  it('throws when staging creation fails', async () => {
    giftStagingService.isEnabled.mockReturnValue(true);
    giftService.normalizeCreateGiftPayload.mockResolvedValue({
      amount: { currencyCode: 'GBP', value: 10 },
      amountMinor: 1000,
      currency: 'GBP',
      intakeSource: 'manual_ui',
      sourceFingerprint: 'fp-2',
      autoPromote: false,
      donorId: 'person-2',
    });
    giftStagingService.stageGift.mockResolvedValue(undefined);

    await expect(controller.createGiftStaging({})).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('throws when staging is disabled for create', async () => {
    giftStagingService.isEnabled.mockReturnValue(false);

    await expect(controller.createGiftStaging({})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(giftService.normalizeCreateGiftPayload).not.toHaveBeenCalled();
  });
});
