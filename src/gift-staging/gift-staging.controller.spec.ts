import { ServiceUnavailableException } from '@nestjs/common';
import { GiftStagingController } from './gift-staging.controller';
import { GiftStagingService, GiftStagingListResult } from './gift-staging.service';
import {
  GiftStagingProcessingService,
  ProcessGiftResult,
} from './gift-staging-processing.service';

describe('GiftStagingController', () => {
  let controller: GiftStagingController;
  let giftStagingService: jest.Mocked<GiftStagingService>;
  let giftStagingProcessingService: jest.Mocked<GiftStagingProcessingService>;

  beforeEach(() => {
    giftStagingService = {
      isEnabled: jest.fn(),
      listGiftStaging: jest.fn(),
      updateStatusById: jest.fn(),
    } as unknown as jest.Mocked<GiftStagingService>;

    giftStagingProcessingService = {
      processGift: jest.fn(),
    } as unknown as jest.Mocked<GiftStagingProcessingService>;

    controller = new GiftStagingController(
      giftStagingService,
      giftStagingProcessingService,
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
});
