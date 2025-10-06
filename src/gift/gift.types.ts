export interface NormalizedGiftCreatePayload extends Record<string, unknown> {
  amount: {
    currencyCode: string;
    value: number;
  };
  amountMinor: number;
  currency: string;
  donorId?: string;
  externalId?: string;
  paymentMethod?: string;
  appealId?: string;
  appealSegmentId?: string;
  trackingCodeId?: string;
  fundId?: string;
  giftDate?: string;
  dateReceived?: string;
  giftBatchId?: string;
  giftAidEligible?: boolean;
}

export interface GiftStagingRecord {
  id: string;
  autoPromote: boolean;
  payload: NormalizedGiftCreatePayload;
}
