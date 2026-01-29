export interface NormalizedGiftCreatePayload extends Record<string, unknown> {
  amount: {
    amountMicros: number;
    currencyCode: string;
  };
  feeAmount?: {
    amountMicros: number;
    currencyCode: string;
  };
  donorId?: string;
  companyId?: string;
  donorFirstName?: string;
  donorLastName?: string;
  donorEmail?: string;
  externalId?: string;
  paymentMethod?: string;
  intakeSource?: string;
  sourceFingerprint?: string;
  autoProcess?: boolean;
  appealId?: string;
  appealSegmentId?: string;
  trackingCodeId?: string;
  fundId?: string;
  opportunityId?: string;
  giftDate?: string;
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
  processingDiagnostics?: ProcessingDiagnostics;
}

export interface GiftStagingRecord {
  id: string;
  autoProcess: boolean;
  processingStatus?: string;
  payload: NormalizedGiftCreatePayload;
}

export type ProcessingEligibility = 'eligible' | 'blocked';

export type IdentityConfidence = 'explicit' | 'strong' | 'weak' | 'none';

export type ProcessingBlocker =
  | 'identity_missing'
  | 'company_missing_for_org_intent'
  | 'recurring_agreement_missing'
  | 'gift_date_missing';

export type ProcessingWarning =
  | 'identity_low_confidence'
  | 'appeal_missing'
  | 'fund_missing'
  | 'opportunity_missing'
  | 'payout_missing'
  | 'payment_method_missing';

export interface ProcessingDiagnostics {
  processingEligibility: ProcessingEligibility;
  processingBlockers: ProcessingBlocker[];
  processingWarnings: ProcessingWarning[];
  identityConfidence: IdentityConfidence;
}

export interface GiftDedupeDiagnostics {
  matchType: 'email' | 'name' | 'partial';
  matchedDonorId?: string;
  matchedBy?: 'email' | 'name' | 'other';
  confidence?: number;
  candidateDonorIds?: string[];
}
