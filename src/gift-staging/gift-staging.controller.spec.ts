import { ServiceUnavailableException } from '@nestjs/common';
import { GiftStagingController } from './gift-staging.controller';
import { GiftStagingService } from './gift-staging.service';
import {
  GiftStagingPromotionService,
  PromoteGiftResult,
} from './gift-staging-promotion.service';

describe('GiftStagingController', () => {
  let controller: GiftStagingController;
  let giftStagingService: jest.Mocked<GiftStagingService>;
  let giftStagingPromotionService: jest.Mocked<GiftStagingPromotionService>;

  beforeEach(() => {
    giftStagingService = {
      isEnabled: jest.fn(),
      updateStatusById: jest.fn(),
    } as unknown as jest.Mocked<GiftStagingService>;

    giftStagingPromotionService = {
      promoteGift: jest.fn(),
    } as unknown as jest.Mocked<GiftStagingPromotionService>;

    controller = new GiftStagingController(
      giftStagingService,
      giftStagingPromotionService,
    );
  });

  it('throws ServiceUnavailableException when staging is disabled', async () => {
    giftStagingService.isEnabled.mockReturnValue(false);

    await expect(controller.promoteGift('stg-123')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(giftStagingPromotionService.promoteGift).not.toHaveBeenCalled();
  });

  it('delegates to promotion service when enabled', async () => {
    giftStagingService.isEnabled.mockReturnValue(true);
    const result: PromoteGiftResult = {
      status: 'committed',
      stagingId: 'stg-123',
      giftId: 'gift-456',
    };
    giftStagingPromotionService.promoteGift.mockResolvedValue(result);

    await expect(controller.promoteGift('stg-123')).resolves.toEqual(result);

    expect(giftStagingPromotionService.promoteGift).toHaveBeenCalledWith({ stagingId: 'stg-123' });
  });

  it('propagates errors from the promotion service', async () => {
    giftStagingService.isEnabled.mockReturnValue(true);
    const error = new ServiceUnavailableException('failed');
    giftStagingPromotionService.promoteGift.mockRejectedValue(error);

    await expect(controller.promoteGift('stg-123')).rejects.toThrow('failed');
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
