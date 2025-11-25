import { mergePayloadForUpdate } from './utils/payload-merger.util';
import type {
  GiftStagingRecordModel,
  GiftStagingUpdateInput,
} from './gift-staging.service';

describe('payload-merger.util', () => {
  const baseEntity: GiftStagingRecordModel = {
    id: 'stg-1',
    amountMinor: 1000,
    currency: 'GBP',
    donorId: 'donor-1',
    rawPayload: JSON.stringify({
      amountMinor: 1000,
      currency: 'GBP',
      donorId: 'donor-1',
    }),
  };

  it('updates amountMinor and derives amountMajor', () => {
    const updates: GiftStagingUpdateInput = {
      amountMinor: 1234,
    };

    const result = mergePayloadForUpdate(baseEntity, updates);

    expect(result.amountMinor).toBe(1234);
    expect(result.amountMajor).toBeCloseTo(12.34);
  });

  it('updates amountMajor and derives amountMinor when missing', () => {
    const updates: GiftStagingUpdateInput = {
      amountMajor: 42.5,
      amountMinor: undefined,
    };

    const result = mergePayloadForUpdate(baseEntity, updates);

    expect(result.amountMajor).toBeCloseTo(42.5);
    expect(result.amountMinor).toBe(4250);
  });

  it('null string fields clear values', () => {
    const updates: GiftStagingUpdateInput = {
      donorEmail: null,
      fundId: null,
    };

    const result = mergePayloadForUpdate(
      {
        ...baseEntity,
        donorEmail: 'keep@me.com',
        fundId: 'fund-1',
      },
      updates,
    );

    expect(result.donorEmail).toBeUndefined();
    expect(result.fundId).toBeUndefined();
  });

  it('trims strings and drops empties', () => {
    const updates: GiftStagingUpdateInput = {
      donorFirstName: '  Alice  ',
      donorLastName: '   ',
    };

    const result = mergePayloadForUpdate(baseEntity, updates);

    expect(result.donorFirstName).toBe('Alice');
    expect(result.donorLastName).toBeUndefined();
  });

  it('preserves providerContext from rawPayload when updates do not touch it', () => {
    const entityWithContext: GiftStagingRecordModel = {
      ...baseEntity,
      rawPayload: JSON.stringify({
        providerContext: { foo: 'bar' },
        donorId: 'donor-1',
      }),
    };

    const result = mergePayloadForUpdate(entityWithContext, {});

    expect(result.providerContext).toEqual({ foo: 'bar' });
  });
});
