export type RecurringAgreementStatus =
  | 'active'
  | 'paused'
  | 'canceled'
  | 'completed'
  | 'delinquent';

export type RecurringAgreementCadence =
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'annual'
  | 'custom';

export interface RecurringAgreementPayload extends Record<string, unknown> {
  contactId?: string;
  status?: RecurringAgreementStatus;
  cadence?: RecurringAgreementCadence;
  intervalCount?: number;
  amountMinor?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  nextExpectedAt?: string;
  autoPromoteEnabled?: boolean;
  defaultCampaignId?: string;
  defaultFundId?: string;
  defaultSoftCreditJson?: Record<string, unknown>;
  giftAidDeclarationId?: string;
  provider?: string;
  providerAgreementId?: string;
  providerPaymentMethodId?: string;
  mandateReference?: string;
  providerContext?: Record<string, unknown>;
  source?: string;
  canceledAt?: string;
  completedAt?: string;
  statusUpdatedAt?: string;
}
