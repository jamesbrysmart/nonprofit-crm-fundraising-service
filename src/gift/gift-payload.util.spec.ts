import { buildTwentyGiftPayload } from './gift-payload.util';

describe('buildTwentyGiftPayload', () => {
  it('preserves optional attribution and batch fields when present', () => {
    const payload = {
      amount: { currencyCode: 'GBP', value: 25 },
      amountMinor: 2500,
      amountMajor: 25,
      currency: 'GBP',
      donorId: 'person-1',
      fundId: 'fund-123',
      appealId: 'appeal-456',
      appealSegmentId: 'segment-789',
      trackingCodeId: 'track-001',
      giftBatchId: 'batch-abc',
      giftAidEligible: true,
      expectedAt: '2025-02-02',
      giftDate: '2025-02-01',
    };

    const result = buildTwentyGiftPayload(payload);

    expect(result).toMatchObject({
      giftDate: '2025-02-01',
      fundId: 'fund-123',
      appealId: 'appeal-456',
      appealSegmentId: 'segment-789',
      trackingCodeId: 'track-001',
      giftBatchId: 'batch-abc',
      giftAidEligible: true,
      expectedAt: '2025-02-02',
    });
    expect(result).toHaveProperty('amount');
    expect(result.amount).toEqual({ value: 25, currencyCode: 'GBP' });
  });
});
