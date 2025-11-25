import { extractReceiptMeta } from './utils/receipt-extractor.util';
import type { GiftStagingRecordModel } from './gift-staging.service';

describe('receipt-extractor.util', () => {
  const base: GiftStagingRecordModel = {
    id: 'stg-1',
  };

  it('returns undefined when rawPayload missing', () => {
    expect(extractReceiptMeta(base)).toBeUndefined();
  });

  it('extracts receipt fields and warnings', () => {
    const entity: GiftStagingRecordModel = {
      ...base,
      donorEmail: '',
      rawPayload: JSON.stringify({
        receiptStatus: 'failed',
        receiptChannel: 'email',
      }),
    };

    const meta = extractReceiptMeta(entity);

    expect(meta?.receiptStatus).toBe('failed');
    expect(meta?.receiptChannel).toBe('email');
    expect(meta?.receiptWarnings).toContain('Missing email for receipt');
    expect(meta?.receiptWarnings).toContain('Receipt failed');
  });

  it('trims string fields', () => {
    const entity: GiftStagingRecordModel = {
      ...base,
      rawPayload: JSON.stringify({
        receiptStatus: ' sent ',
        receiptPolicyApplied: '  policy-1 ',
      }),
    };

    const meta = extractReceiptMeta(entity);

    expect(meta?.receiptStatus).toBe('sent');
    expect(meta?.receiptPolicyApplied).toBe('policy-1');
  });
});
