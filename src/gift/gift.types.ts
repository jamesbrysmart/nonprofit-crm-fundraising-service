export interface NormalizedGiftCreatePayload extends Record<string, unknown> {
  amount: {
    amountMicros: number;
    currencyCode: string;
  };
  amountMajor?: number;
  amountMinor: number;
  currency: string;
  feeAmountMajor?: number;
  feeAmountMinor?: number;
  feeCurrency?: string;
  donorId?: string;
  companyId?: string;
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
  opportunityId?: string;
  giftDate?: string;
  dateReceived?: string;
  giftBatchId?: string;
  giftAidEligible?: boolean;
  dedupeDiagnostics?: GiftDedupeDiagnostics;
  notes?: string;
  recurringAgreementId?: string;
  expectedAt?: string;
  provider?: string;
  providerPaymentId?: string;
  providerContext?: Record<string, unknown> | string;
  recurringStatus?: string;
  recurringMetadata?: Record<string, unknown>;
  giftIntent?: string;
  isInKind?: boolean;
  inKindDescription?: string;
  estimatedValue?: number;
  giftPayoutId?: string;
  /**
   * Known values: 'pending', 'sent', 'failed', 'suppressed'
   */
  receiptStatus?: string;
  receiptPolicyApplied?: string;
  receiptChannel?: string;
  receiptTemplateVersion?: string;
  receiptError?: string;
  receiptDedupeKey?: string;
  receiptSentAt?: string;
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
