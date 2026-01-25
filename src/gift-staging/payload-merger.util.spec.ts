import { mergePayloadForUpdate } from './utils/payload-merger.util';
import type {
  GiftStagingRecordModel,
  GiftStagingUpdateInput,
} from './gift-staging.service';

describe('payload-merger.util', () => {
  const baseEntity: GiftStagingRecordModel = {
    id: 'stg-1',
    amountMicros: 10_000_000,
    currencyCode: 'GBP',
    donorId: 'donor-1',
    rawPayload: JSON.stringify({
      amount: { amountMicros: 10_000_000, currencyCode: 'GBP' },
      donorId: 'donor-1',
    }),
  };

  it('updates amountMicros', () => {
    const updates: GiftStagingUpdateInput = {
      amountMicros: 12_340_000,
    };

    const result = mergePayloadForUpdate(baseEntity, updates);

    expect(result.amount.amountMicros).toBe(12_340_000);
  });

  it('updates currencyCode', () => {
    const updates: GiftStagingUpdateInput = {
      currencyCode: 'USD',
    };

    const result = mergePayloadForUpdate(baseEntity, updates);

    expect(result.amount.currencyCode).toBe('USD');
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
