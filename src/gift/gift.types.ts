export interface NormalizedGiftCreatePayload extends Record<string, unknown> {
  amount: {
    currencyCode: string;
    value: number;
  };
  amountMajor?: number;
  amountMinor: number;
  currency: string;
  donorId?: string;
  donorFirstName?: string;
  donorLastName?: string;
  donorEmail?: string;
  externalId?: string;
  paymentMethod?: string;
  intakeSource?: string;
  sourceFingerprint?: string;
  autoPromote?: boolean;
  appealId?: string;
  appealSegmentId?: string;
  trackingCodeId?: string;
  fundId?: string;
  giftDate?: string;
  dateReceived?: string;
  giftBatchId?: string;
  giftAidEligible?: boolean;
  dedupeDiagnostics?: GiftDedupeDiagnostics;
  notes?: string;
}

export interface GiftStagingRecord {
  id: string;
  autoPromote: boolean;
  promotionStatus?: string;
  payload: NormalizedGiftCreatePayload;
}

export interface GiftDedupeDiagnostics {
  matchType: 'email' | 'name' | 'partial';
  matchedDonorId?: string;
  matchedBy?: 'email' | 'name' | 'other';
  confidence?: number;
  candidateDonorIds?: string[];
}
